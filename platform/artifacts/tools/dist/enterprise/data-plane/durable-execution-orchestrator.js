export class DurableExecutionOrchestrator {
    bundles;
    executions;
    providers;
    policy;
    host;
    executionPolicy;
    clock;
    constructor(bundles, executions, providers, policy, host, executionPolicy, clock) {
        this.bundles = bundles;
        this.executions = executions;
        this.providers = providers;
        this.policy = policy;
        this.host = host;
        this.executionPolicy = executionPolicy;
        this.clock = clock;
        const leaseMilliseconds = executionPolicy.claimLeaseMilliseconds ?? 60_000;
        const heartbeatMilliseconds = executionPolicy.claimHeartbeatMilliseconds ??
            Math.max(1, Math.floor(leaseMilliseconds / 3));
        if (!Number.isSafeInteger(executionPolicy.maximumAttempts) || executionPolicy.maximumAttempts < 1) {
            throw new Error("maximumAttempts must be a positive safe integer.");
        }
        if (!Number.isSafeInteger(leaseMilliseconds) || leaseMilliseconds < 2) {
            throw new Error("claimLeaseMilliseconds must be a safe integer of at least 2.");
        }
        if (!Number.isSafeInteger(heartbeatMilliseconds) ||
            heartbeatMilliseconds < 1 ||
            heartbeatMilliseconds >= leaseMilliseconds) {
            throw new Error("claimHeartbeatMilliseconds must be positive and shorter than the claim lease.");
        }
    }
    event(options) {
        return {
            eventType: "sda-orchestration-event.v1",
            executionId: options.request.executionId,
            rootExecutionId: options.request.executionId,
            tenantId: options.request.tenant.tenantId,
            bundleDigest: options.request.bundleDigest,
            scenarioId: options.request.scenarioId,
            ...(options.providerId ? { providerId: options.providerId } : {}),
            ...(options.evaluatorIds ? { evaluatorIds: options.evaluatorIds } : {}),
            attempt: options.attempt,
            kind: options.kind,
            occurredAt: this.clock.now(),
            ...(options.reasonCode ? { reasonCode: options.reasonCode } : {}),
            ...(options.detail ? { detail: options.detail } : {})
        };
    }
    async submit(request) {
        const bundle = this.bundles.resolve(request.bundleDigest);
        if (!bundle)
            throw new Error(`Bundle '${request.bundleDigest}' is not admitted.`);
        if (bundle.capability.capabilityId !== request.capabilityId) {
            throw new Error(`Request capability '${request.capabilityId}' does not match pinned bundle.`);
        }
        const scenario = bundle.capability.scenarios.find((candidate) => candidate.scenarioId === request.scenarioId);
        if (!scenario)
            throw new Error(`Scenario '${request.scenarioId}' is not present in the pinned bundle.`);
        const decision = await this.policy.decide(request, bundle);
        if (decision.disposition === "DENY") {
            const reasonCode = decision.reasonCodes[0] ?? "policy-denied";
            const record = this.executions.deny(request, this.event({ request, kind: "POLICY_DENIED", attempt: 0, reasonCode }), reasonCode);
            return { record, duplicate: false };
        }
        const result = this.executions.admit(request, this.event({ request, kind: "REQUEST_ADMITTED", attempt: 0 }));
        if (!result.duplicate)
            return result;
        const original = result.record.request;
        this.executions.appendTestimony(original.executionId, this.event({
            request: original,
            kind: "DUPLICATE_SUPPRESSED",
            attempt: result.record.attempt,
            reasonCode: "idempotency-key-reused"
        }));
        return result;
    }
    async processNext() {
        const claimedAt = this.clock.now();
        const leaseMilliseconds = this.executionPolicy.claimLeaseMilliseconds ?? 60_000;
        const claim = this.executions.claimNext({
            claimedAt,
            leaseExpiresAt: new Date(Date.parse(claimedAt) + leaseMilliseconds).toISOString()
        });
        if (!claim)
            return null;
        const request = claim.record.request;
        if (claim.record.attempt >= this.executionPolicy.maximumAttempts) {
            return this.quarantineExhaustedClaim(claim);
        }
        const attemptRecord = {
            ...claim.record,
            status: "RUNNING",
            attempt: claim.record.attempt + 1
        };
        const bundle = this.requireBundle(request.bundleDigest);
        const scenario = bundle.capability.scenarios.find((candidate) => candidate.scenarioId === request.scenarioId);
        if (!scenario)
            throw new Error(`Pinned scenario '${request.scenarioId}' disappeared from immutable bundle.`);
        const providerResolution = this.resolveProvider(bundle, scenario);
        if ("error" in providerResolution) {
            return this.failOrRetry(claim, attemptRecord, undefined, [], providerResolution.error, providerResolution.detail);
        }
        const observationResolution = this.resolveObservationPlan(bundle, scenario);
        if ("error" in observationResolution) {
            return this.failOrRetry(claim, attemptRecord, undefined, [], observationResolution.error, observationResolution.detail);
        }
        const provider = providerResolution.provider;
        const plan = observationResolution.plan;
        const running = this.executions.commit({
            executionId: request.executionId,
            expectedVersion: claim.record.version,
            committedAt: this.clock.now(),
            fencingToken: claim.fencingToken,
            next: this.withoutVersion({
                ...attemptRecord,
                providerId: provider.providerId,
                evaluatorIds: plan.evaluatorIds
            }),
            events: [
                this.event({
                    request,
                    kind: "DISPATCHED",
                    attempt: attemptRecord.attempt,
                    providerId: provider.providerId,
                    evaluatorIds: plan.evaluatorIds
                }),
                this.event({
                    request,
                    kind: "ATTEMPT_STARTED",
                    attempt: attemptRecord.attempt,
                    providerId: provider.providerId,
                    evaluatorIds: plan.evaluatorIds
                })
            ]
        });
        const controller = new AbortController();
        const boundProvider = {
            responsibilityId: provider.responsibilityId,
            execute: (input, signal) => provider.execute(input, {
                executionId: `${request.executionId}.attempt-${running.attempt}`,
                rootExecutionId: request.executionId,
                attempt: running.attempt,
                idempotencyKey: request.idempotencyKey,
                bundleDigest: request.bundleDigest,
                fencingToken: claim.fencingToken,
                ...(signal ? { signal } : {})
            })
        };
        const heartbeatMilliseconds = this.executionPolicy.claimHeartbeatMilliseconds ??
            Math.max(1, Math.floor(leaseMilliseconds / 3));
        const heartbeatState = { failure: null };
        let activeLeaseExpiresAt = claim.leaseExpiresAt;
        const renewLease = () => {
            const renewedAt = this.clock.now();
            const leaseExpiresAt = new Date(Date.parse(renewedAt) + leaseMilliseconds).toISOString();
            if (leaseExpiresAt <= activeLeaseExpiresAt)
                return;
            const renewed = this.executions.renewClaim({
                executionId: request.executionId,
                fencingToken: claim.fencingToken,
                renewedAt,
                leaseExpiresAt
            });
            activeLeaseExpiresAt = renewed.leaseExpiresAt;
        };
        const heartbeat = setInterval(() => {
            if (heartbeatState.failure)
                return;
            try {
                renewLease();
            }
            catch (error) {
                heartbeatState.failure = error instanceof Error ? error : new Error(String(error));
                controller.abort(heartbeatState.failure);
            }
        }, heartbeatMilliseconds);
        heartbeat.unref();
        let closure;
        try {
            closure = await this.host.executeScenario({
                scenario,
                input: request.input,
                provider: boundProvider,
                obligation: plan.obligation,
                executionId: `${request.executionId}.attempt-${running.attempt}`,
                rootExecutionId: request.executionId,
                signal: controller.signal
            });
        }
        catch (error) {
            clearInterval(heartbeat);
            if (heartbeatState.failure)
                throw heartbeatState.failure;
            renewLease();
            return this.failOrRetry({ ...claim, record: running }, running, provider.providerId, plan.evaluatorIds, "orchestration-attempt-failed", error instanceof Error ? error.message : String(error));
        }
        clearInterval(heartbeat);
        if (heartbeatState.failure)
            throw heartbeatState.failure;
        renewLease();
        if ((closure.kernelDisposition === "completed" || closure.kernelDisposition === "terminated") &&
            closure.obligationDisposition.kind === "SATISFIED") {
            return this.executions.commit({
                executionId: request.executionId,
                expectedVersion: running.version,
                committedAt: this.clock.now(),
                fencingToken: claim.fencingToken,
                releaseClaim: true,
                next: this.withoutVersion({
                    ...running,
                    status: "COMPLETED",
                    providerId: provider.providerId,
                    evaluatorIds: plan.evaluatorIds,
                    closure
                }),
                events: [this.event({
                        request,
                        kind: "ATTEMPT_COMPLETED",
                        attempt: running.attempt,
                        providerId: provider.providerId,
                        evaluatorIds: plan.evaluatorIds
                    })]
            });
        }
        return this.failOrRetry({ ...claim, record: running }, { ...running, closure }, provider.providerId, plan.evaluatorIds, closure.kernelDisposition === "failed" ? "scenario-execution-failed" : "obligation-not-satisfied");
    }
    resolveProvider(bundle, scenario) {
        const responsibilityId = scenario.event.responsibility.responsibilityId;
        const bindings = bundle.providerBindings.bindings.filter((binding) => binding.responsibilityId === responsibilityId);
        if (bindings.length !== 1) {
            return {
                error: "provider-binding-incomplete",
                detail: `Responsibility '${responsibilityId}' requires exactly one provider binding; found ${bindings.length}.`
            };
        }
        const binding = bindings[0];
        if (!binding)
            throw new Error("Provider binding resolution invariant failed.");
        const provider = this.providers.resolveProvider(binding.providerId);
        if (!provider) {
            return { error: "provider-resolution-failed", detail: `Provider '${binding.providerId}' is not registered.` };
        }
        const requirementsMatch = JSON.stringify([...provider.requires].sort()) ===
            JSON.stringify([...binding.requires].sort());
        if (provider.providerId !== binding.providerId ||
            provider.responsibilityId !== binding.responsibilityId ||
            provider.implementationRef !== binding.implementationRef ||
            !requirementsMatch) {
            return {
                error: "provider-binding-mismatch",
                detail: `Resolved provider '${provider.providerId}' does not match bundle binding '${binding.providerId}'.`
            };
        }
        return { provider };
    }
    resolveObservationPlan(bundle, scenario) {
        const evaluators = [];
        for (const condition of scenario.outcome.obligation.observableConditions) {
            const bindings = bundle.observationBindings.bindings.filter((binding) => binding.conditionId === condition.conditionId);
            if (bindings.length !== 1) {
                return {
                    error: "observation-binding-incomplete",
                    detail: `Condition '${condition.conditionId}' requires exactly one observation binding; found ${bindings.length}.`
                };
            }
            const binding = bindings[0];
            if (!binding)
                throw new Error("Observation binding resolution invariant failed.");
            if (binding.evidenceContractId !== scenario.outcome.evidence.contract.contractId) {
                return {
                    error: "observation-contract-mismatch",
                    detail: `Condition '${condition.conditionId}' binds evidence contract '${binding.evidenceContractId}', expected '${scenario.outcome.evidence.contract.contractId}'.`
                };
            }
            const evaluator = this.providers.resolveEvaluator(binding.evaluatorId);
            if (!evaluator || evaluator.evaluatorId !== binding.evaluatorId ||
                evaluator.evidenceContractId !== binding.evidenceContractId ||
                !evaluator.conditionIds.includes(condition.conditionId)) {
                return {
                    error: "evaluator-binding-mismatch",
                    detail: `Evaluator '${binding.evaluatorId}' does not match the binding for condition '${condition.conditionId}'.`
                };
            }
            evaluators.push({
                conditionId: condition.conditionId,
                evaluator,
                ...(binding.configurationRef ? { configurationRef: binding.configurationRef } : {})
            });
        }
        const evaluatorIds = [...new Set(evaluators.map(({ evaluator }) => evaluator.evaluatorId))];
        return {
            plan: {
                evaluatorIds,
                obligation: {
                    obligationId: scenario.outcome.obligation.obligationId,
                    evaluate: (evidence) => {
                        const results = evaluators.map(({ conditionId, evaluator, configurationRef }) => {
                            const result = evaluator.evaluateCondition(conditionId, evidence, configurationRef);
                            return result.conditionId === conditionId
                                ? result
                                : {
                                    conditionId,
                                    disposition: "NOT_OBSERVABLE",
                                    detail: `Evaluator '${evaluator.evaluatorId}' returned condition '${result.conditionId}' for bound condition '${conditionId}'.`
                                };
                        });
                        if (results.some((result) => result.disposition === "NOT_SATISFIED")) {
                            return { kind: "NOT_SATISFIED", conditionEvidence: results };
                        }
                        if (results.some((result) => result.disposition === "NOT_OBSERVABLE")) {
                            return {
                                kind: "NOT_OBSERVABLE",
                                reasons: results
                                    .filter((result) => result.disposition === "NOT_OBSERVABLE")
                                    .map((result) => ({ conditionId: result.conditionId, reason: result.detail ?? "condition was not observable" }))
                            };
                        }
                        return { kind: "SATISFIED", conditionEvidence: results };
                    }
                }
            }
        };
    }
    failOrRetry(claim, record, providerId, evaluatorIds, reasonCode, detail) {
        const request = record.request;
        const retry = record.attempt < this.executionPolicy.maximumAttempts;
        const committedAt = this.clock.now();
        const retryDelay = this.executionPolicy.retryDelayMilliseconds ?? 0;
        const next = this.withoutVersion({
            ...record,
            status: retry ? "RETRY_PENDING" : "QUARANTINED",
            ...(providerId ? { providerId } : {}),
            ...(evaluatorIds.length > 0 ? { evaluatorIds } : {}),
            ...(retry ? { nextAttemptAt: new Date(Date.parse(committedAt) + retryDelay).toISOString() } : {}),
            reasonCode
        });
        return this.executions.commit({
            executionId: request.executionId,
            expectedVersion: claim.record.version,
            committedAt,
            fencingToken: claim.fencingToken,
            releaseClaim: true,
            next,
            events: [
                this.event({
                    request,
                    kind: "ATTEMPT_FAILED",
                    attempt: record.attempt,
                    ...(providerId ? { providerId } : {}),
                    ...(evaluatorIds.length > 0 ? { evaluatorIds } : {}),
                    reasonCode,
                    ...(detail ? { detail } : {})
                }),
                this.event({
                    request,
                    kind: retry ? "RETRY_SCHEDULED" : "QUARANTINED",
                    attempt: record.attempt,
                    ...(providerId ? { providerId } : {}),
                    ...(evaluatorIds.length > 0 ? { evaluatorIds } : {}),
                    reasonCode: retry ? reasonCode : "attempts-exhausted"
                })
            ]
        });
    }
    quarantineExhaustedClaim(claim) {
        const request = claim.record.request;
        const reasonCode = "attempt-limit-reached-before-dispatch";
        return this.executions.commit({
            executionId: request.executionId,
            expectedVersion: claim.record.version,
            committedAt: this.clock.now(),
            fencingToken: claim.fencingToken,
            releaseClaim: true,
            next: this.withoutVersion({
                ...claim.record,
                status: "QUARANTINED",
                reasonCode
            }),
            events: [this.event({
                    request,
                    kind: "QUARANTINED",
                    attempt: claim.record.attempt,
                    ...(claim.record.providerId ? { providerId: claim.record.providerId } : {}),
                    ...(claim.record.evaluatorIds ? { evaluatorIds: claim.record.evaluatorIds } : {}),
                    reasonCode
                })]
        });
    }
    withoutVersion(record) {
        const { version: _version, ...withoutVersion } = record;
        return withoutVersion;
    }
    requireBundle(digest) {
        const bundle = this.bundles.resolve(digest);
        if (!bundle)
            throw new Error(`Previously admitted bundle '${digest}' is unavailable.`);
        return bundle;
    }
}
