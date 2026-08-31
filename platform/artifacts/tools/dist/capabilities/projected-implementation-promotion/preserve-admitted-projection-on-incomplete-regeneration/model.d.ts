export interface PreserveAdmittedProjectionInput {
    readonly beforeDigests: Readonly<Record<string, string>>;
    readonly afterDigests: Readonly<Record<string, string>>;
    readonly proofConforming: boolean;
}
export interface PreservationEvidence extends PreserveAdmittedProjectionInput {
    readonly preserved: boolean;
}
export declare const isPreserveAdmittedProjectionInput: (value: unknown) => value is PreserveAdmittedProjectionInput;
export declare const isPreservationEvidence: (value: unknown) => value is PreservationEvidence;
