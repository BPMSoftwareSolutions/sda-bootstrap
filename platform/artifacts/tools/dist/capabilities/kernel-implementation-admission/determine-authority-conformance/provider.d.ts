import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { AuthorityAssertion, AuthorityConformanceEvidence, AuthorityConformanceInput } from "./model.js";
declare function assertionKey(assertion: AuthorityAssertion): string;
export declare class AuthorityConformanceProvider implements ResponsibilityProvider<AuthorityConformanceInput, AuthorityConformanceEvidence> {
    readonly responsibilityId = "compare-observed-and-canonical-authority";
    execute(input: AuthorityConformanceInput): Promise<AuthorityConformanceEvidence>;
}
export { assertionKey };
