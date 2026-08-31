import type { CanonicalConsumerCapability } from "../../model/canonical-consumer-capability.js";
import type { JsonRecord } from "../../model/consumer-workspace-facts.js";
export declare function projectExpectedTelemetry(telemetryAuthority: JsonRecord, executionVector: JsonRecord, capability: CanonicalConsumerCapability): JsonRecord;
export declare class ExpectedTelemetryProjector {
    project(telemetryAuthority: JsonRecord, executionVector: JsonRecord, capability: CanonicalConsumerCapability): JsonRecord;
}
