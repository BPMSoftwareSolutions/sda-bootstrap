import type { DomainIsolationSourceFile } from "../../ports/consumer-projection/domain-isolation-repository.js";
export declare const BANNED_DOMAIN_TERMS: readonly string[];
export declare const BANNED_DOMAIN_ALGORITHM_MARKERS: readonly string[];
export interface DomainIsolationEvidence {
    readonly evidenceType: "consumer-domain-isolation-evidence.v1";
    readonly scannedFiles: number;
    readonly violations: readonly {
        readonly file: string;
        readonly term: string;
    }[];
    readonly valid: boolean;
    readonly disposition: "DOMAIN_ISOLATED" | "DOMAIN_LEAKAGE_DETECTED";
}
export declare class DomainIsolationEvaluator {
    evaluate(files: readonly DomainIsolationSourceFile[]): DomainIsolationEvidence;
}
