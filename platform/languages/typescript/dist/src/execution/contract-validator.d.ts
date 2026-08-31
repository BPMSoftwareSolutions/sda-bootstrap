import type { ContractReference } from "../contracts/index.js";
/**
 * Raised when a value does not satisfy a ContractReference. Translated to
 * the "rejected" disposition by the kernel — never a domain-specific error
 * type, since the kernel has no domain to be specific about.
 */
export declare class ContractAdmissionException extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * Embodies both admit-input and admit-outcome from the canonical execution
 * vector. Both steps are the same responsibility applied to a different
 * contract and value — validate/admit a runtime value against a declared
 * ContractReference — so one port serves both rather than two near-
 * identical interfaces.
 */
export interface ContractValidator {
    admit(contract: ContractReference, value: unknown, signal?: AbortSignal): Promise<unknown>;
}
