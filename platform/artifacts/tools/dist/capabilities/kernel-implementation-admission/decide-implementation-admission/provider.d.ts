import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ImplementationAdmissionEvidence, ImplementationAdmissionInput } from "./model.js";
export declare class ImplementationAdmissionProvider implements ResponsibilityProvider<ImplementationAdmissionInput, ImplementationAdmissionEvidence> {
    readonly responsibilityId = "derive-admission-without-hiding-failed-or-unobservable-obligations";
    execute(input: ImplementationAdmissionInput): Promise<ImplementationAdmissionEvidence>;
}
