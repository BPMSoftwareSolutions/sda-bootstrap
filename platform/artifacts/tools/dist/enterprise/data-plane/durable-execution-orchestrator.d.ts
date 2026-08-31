import type { ToolCapabilityHost } from "../../host/tool-capability-host.js";
import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { ExecutionRecord, ExecutionRequest, PhysicalExecutionPolicy, SubmissionResult } from "./model.js";
import type { CapabilityBundleRegistry, EnterpriseProviderRegistry, ExecutionRepository, InvocationPolicyPort } from "./ports.js";
export declare class DurableExecutionOrchestrator {
    private readonly bundles;
    private readonly executions;
    private readonly providers;
    private readonly policy;
    private readonly host;
    private readonly executionPolicy;
    private readonly clock;
    constructor(bundles: CapabilityBundleRegistry, executions: ExecutionRepository, providers: EnterpriseProviderRegistry, policy: InvocationPolicyPort, host: ToolCapabilityHost, executionPolicy: PhysicalExecutionPolicy, clock: ClockPort);
    private event;
    submit(request: ExecutionRequest): Promise<SubmissionResult>;
    processNext(): Promise<ExecutionRecord | null>;
    private resolveProvider;
    private resolveObservationPlan;
    private failOrRetry;
    private quarantineExhaustedClaim;
    private withoutVersion;
    private requireBundle;
}
