import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { KernelSpecificationAdmissionEvidence, KernelSpecificationAdmissionInput } from "./model.js";
export declare class KernelSpecificationAdmissionProvider implements ResponsibilityProvider<KernelSpecificationAdmissionInput, KernelSpecificationAdmissionEvidence> {
    readonly responsibilityId = "validate-canonical-kernel-specification";
    execute(input: KernelSpecificationAdmissionInput): Promise<KernelSpecificationAdmissionEvidence>;
}
