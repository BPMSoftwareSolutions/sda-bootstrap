import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { AdmitConsumerSourceFactsEvidence, AdmitConsumerSourceFactsInput } from "./model.js";
export declare class AdmitConsumerSourceFactsProvider implements ResponsibilityProvider<AdmitConsumerSourceFactsInput, AdmitConsumerSourceFactsEvidence> {
    readonly responsibilityId = "load-validate-digest-and-relate-consumer-authority";
    execute(input: AdmitConsumerSourceFactsInput): Promise<AdmitConsumerSourceFactsEvidence>;
}
