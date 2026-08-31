import type { ResponsibilityProvider } from "../ports/capability-ports.js";
export declare function loadBoundProvider<TInput, TEvidence>(repositoryRoot: string, groupId: string, legacyProvider: ResponsibilityProvider<TInput, TEvidence>): Promise<ResponsibilityProvider<TInput, TEvidence>>;
