import type { CapabilityBundle } from "../control-plane/capability-bundle.js";
import type { ExecutionRequest } from "../data-plane/model.js";
import type { InvocationPolicyPort } from "../data-plane/ports.js";
export declare class AllowAllInvocationPolicy implements InvocationPolicyPort {
    decide(request: ExecutionRequest, _bundle: CapabilityBundle): Promise<{
        readonly disposition: "ALLOW";
        readonly decisionId: string;
        readonly reasonCodes: readonly string[];
    }>;
}
