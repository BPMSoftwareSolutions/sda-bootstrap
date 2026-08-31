/**
 * Raised when a value does not satisfy a ContractReference. Translated to
 * the "rejected" disposition by the kernel — never a domain-specific error
 * type, since the kernel has no domain to be specific about.
 */
export class ContractAdmissionException extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "ContractAdmissionException";
    }
}
