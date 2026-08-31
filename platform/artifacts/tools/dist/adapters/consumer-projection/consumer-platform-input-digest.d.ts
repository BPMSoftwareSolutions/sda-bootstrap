import type { PlatformCapabilityCatalog } from "../../consumer-projection/model/consumer-workspace-facts.js";
import type { ConsumerPlatformObservation } from "../../consumer-projection/model/platform-mechanic-conformance.js";
export declare function consumerPlatformInputDigest(repositoryRoot: string, language: string, catalog: PlatformCapabilityCatalog): string;
export declare function consumerProofIsCurrent(repositoryRoot: string, language: string, observation: ConsumerPlatformObservation | undefined, catalog: PlatformCapabilityCatalog): boolean;
