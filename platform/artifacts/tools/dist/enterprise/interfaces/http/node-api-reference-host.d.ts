import type { ClockPort } from "../../../ports/infrastructure-ports.js";
import { ExecutionApiApplication } from "./execution-api-application.js";
import { RealizationApiApplication } from "./realization-api-application.js";
import { type NodeApiReferenceHostProfile } from "./model.js";
import type { AccessTokenVerificationPort, ExecutionIdentityPort } from "./ports.js";
import { type NodeRealizationApiReferenceHostProfile } from "./realization-api-model.js";
import type { RealizationPlanIdentityPort } from "./realization-api-ports.js";
type ReferenceHostProfile = NodeApiReferenceHostProfile | NodeRealizationApiReferenceHostProfile;
type ReferenceHostApplication = ExecutionApiApplication | RealizationApiApplication;
type ReferenceHostIdentities = ExecutionIdentityPort | RealizationPlanIdentityPort;
export interface NodeApiReferenceHostHandle {
    readonly origin: string;
    readonly profileDigest: string;
    readonly operationGraphDigest: string;
    readonly openApiDocumentDigest: string;
    readonly close: () => Promise<void>;
}
export declare function startNodeApiReferenceHost(options: {
    readonly repositoryRoot: string;
    readonly profile: ReferenceHostProfile;
    readonly application: ReferenceHostApplication;
    readonly accessTokens: AccessTokenVerificationPort;
    readonly identities: ReferenceHostIdentities;
    readonly clock: ClockPort;
    readonly port?: number;
    readonly projectionFixtureRef?: string;
}): Promise<NodeApiReferenceHostHandle>;
export {};
