import type { CanonicalConsumerCapability } from "../../model/canonical-consumer-capability.js";
import type { PlatformResponsibilityResolution } from "../../model/platform-responsibility-resolution.js";
import type { ConsumerContractAuthorities, ConsumerExecutableOrigin, ConsumerInterfaceAuthority, ConsumerProjectionTarget, JsonRecord, PlatformCapabilityCatalog } from "../../model/consumer-workspace-facts.js";
export interface ConsumerQueryProjectionInput {
    readonly queryAuthority: JsonRecord;
    readonly capability: CanonicalConsumerCapability;
    readonly executionAuthorities: JsonRecord;
    readonly projectionAuthorities: JsonRecord;
    readonly interfaceAuthority: ConsumerInterfaceAuthority;
    readonly contractAuthorities: ConsumerContractAuthorities | null;
    readonly platformCapabilityCatalog: PlatformCapabilityCatalog;
    readonly mechanicResolution: PlatformResponsibilityResolution;
    readonly expectedTelemetry: JsonRecord;
    readonly executableOrigin: ConsumerExecutableOrigin;
    readonly projectionTarget: ConsumerProjectionTarget;
    readonly inspectableQueryCatalog: JsonRecord | null;
}
export declare function projectConsumerQuery(input: ConsumerQueryProjectionInput): JsonRecord;
export declare class ConsumerQueryProjector {
    project(input: ConsumerQueryProjectionInput): JsonRecord;
}
