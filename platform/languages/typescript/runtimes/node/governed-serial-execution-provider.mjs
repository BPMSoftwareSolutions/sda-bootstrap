import { canonicalDigest, valueAt } from "./native-mechanic-primitives.mjs";

function capabilityAuthorityDigest(plan) {
  return plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
    ? plan.canonicalGraph.authority.authorityDigest
    : plan.source.capabilityAuthorityDigest;
}

export function nestedExecutionTestimony(binding, application, result) {
  const testimony = {
    testimonyType: "nested-capability-execution-testimony.v1",
    portId: binding.bindingId.replace(/^port:/, ""),
    capabilityId: application.plan.capabilityId,
    bindingRef: binding.configuration.bindingRef,
    bindingDigest: canonicalDigest(application.binding),
    capabilityAuthorityDigest: capabilityAuthorityDigest(application.plan),
    rootExecutionId: result.executions[0]?.rootExecutionId ?? null,
    disposition: result.disposition,
    outcomeDigest: result.outcome === null ? null : canonicalDigest(result.outcome),
    executions: result.executions,
    observations: result.observations,
    nestedExecutions: result.nestedExecutions ?? []
  };
  return { ...testimony, nestedExecutionDigest: canonicalDigest(testimony) };
}

export async function invokeGovernedSerialExecution(configuration, carrier, context, bindingUrl, invokeBinding) {
  if (!carrier || typeof carrier !== "object" || Array.isArray(carrier)) throw new Error("GOVERNED_SERIAL_EXECUTION_CARRIER_REQUIRED");
  const transactions = valueAt(carrier, configuration.transactionsPath ?? "boundedTransactions");
  if (!Array.isArray(transactions)) throw new Error("GOVERNED_SERIAL_EXECUTION_TRANSACTIONS_REQUIRED");
  const stableIdentityPath = configuration.stableIdentityPath ?? "capabilityId";
  const identities = transactions.map((transaction) => valueAt(transaction, stableIdentityPath));
  if (identities.some((identity) => typeof identity !== "string" || identity.length === 0)) throw new Error("GOVERNED_SERIAL_EXECUTION_IDENTITY_REQUIRED");
  if (new Set(identities).size !== identities.length) throw new Error("GOVERNED_SERIAL_EXECUTION_DUPLICATE_IDENTITY");
  const configured = new Map((configuration.transactionBindings ?? []).map((entry) => [entry.capabilityId, entry]));
  const observations = [];
  const continuationDecisions = [];
  for (const transaction of transactions) {
    const entry = configured.get(valueAt(transaction, stableIdentityPath));
    if (!entry) throw new Error(`GOVERNED_SERIAL_EXECUTION_CHILD_UNAVAILABLE: '${valueAt(transaction, stableIdentityPath)}'`);
    const request = valueAt(transaction, entry.requestPath ?? "request");
    if (request === undefined) throw new Error("GOVERNED_SERIAL_EXECUTION_CHILD_REQUEST_MISSING");
    const invocation = await invokeBinding(entry.bindingRef, request, { rootExecutionId: `${context.rootExecutionId}.${entry.capabilityId}` }, true);
    if (canonicalDigest(invocation.application.binding) !== entry.bindingDigest || capabilityAuthorityDigest(invocation.application.plan) !== entry.capabilityAuthorityDigest) {
      throw new Error("GOVERNED_SERIAL_EXECUTION_CHILD_LINEAGE_MISMATCH");
    }
    const result = await invocation.execute();
    const testimony = nestedExecutionTestimony({ bindingId: `port:${entry.capabilityId}`, configuration: { bindingRef: entry.bindingRef } }, invocation.application, result);
    context.nestedExecutions.push(testimony);
    if (!["terminated", "completed"].includes(result.disposition)) throw new Error(`GOVERNED_SERIAL_EXECUTION_CHILD_FAILED: ${result.errorCode ?? result.disposition}`);
    observations.push({ capabilityId: entry.capabilityId, transactionId: transaction.transactionId, disposition: result.disposition, outcome: result.outcome, nestedExecutionDigest: testimony.nestedExecutionDigest });
    const decision = valueAt(transaction, entry.continuationDecisionPath ?? "continuationDecision") ?? "STOP";
    continuationDecisions.push({ capabilityId: entry.capabilityId, decision, suppliedBy: configuration.continuationAuthorityRef ?? null });
    if (decision !== "CONTINUE") break;
  }
  return { ...structuredClone(carrier), observations, continuationDecisions, effectLineage: [...(carrier.effectLineage ?? []), context.rootExecutionId] };
}
