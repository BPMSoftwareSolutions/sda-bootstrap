import type { ConsumerExecutionEmbodimentPlan } from "../model/consumer-execution-embodiment-plan.js";
import type { ConsumerProjectionTarget, JsonRecord } from "../model/consumer-workspace-facts.js";
import { type ConsumerExecutionEmbodimentPlanV3, type ProviderProfileProjection } from "@sda/semantic-execution-graph-resolver";
export declare class ConsumerExecutionEmbodimentCompiler {
    compileV3(query: JsonRecord, target: ConsumerProjectionTarget, capabilityAuthority: JsonRecord, providerProfiles?: readonly ProviderProfileProjection[]): ConsumerExecutionEmbodimentPlanV3;
    compile(query: JsonRecord, target: ConsumerProjectionTarget, capabilityAuthority: JsonRecord): ConsumerExecutionEmbodimentPlan;
}
