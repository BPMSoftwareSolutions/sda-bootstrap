import type { ImplementationAdmission, LanguageObligation } from "../model/conformance-evidence-set.js";
import { type BehavioralObservation } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/model.js";
import { type LanguageExecutionClosureObservation } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/model.js";
import { type PublishedImplementationEvidence } from "../../capabilities/conformance-evidence-publication/publish-implementation-evidence/model.js";
import { type CrossLanguageEquivalenceEvidence } from "../../capabilities/conformance-evidence-publication/derive-cross-language-equivalence/model.js";
export interface ConformanceReportResult {
    readonly admissions: readonly PublishedImplementationEvidence[];
    readonly crossLanguage: CrossLanguageEquivalenceEvidence | null;
}
export declare class ConformanceService {
    private readonly repositoryRoot;
    private readonly clock;
    private readonly repository;
    private readonly store;
    private readonly toolchains;
    constructor(repositoryRoot: string);
    obligations(): readonly LanguageObligation[];
    observeBehavior(): Promise<Readonly<Record<string, BehavioralObservation>>>;
    observeExecutionClosure(): Promise<Readonly<Record<string, LanguageExecutionClosureObservation>>>;
    admit(language: string): Promise<ImplementationAdmission>;
    publish(language: string): Promise<PublishedImplementationEvidence>;
    report(requestedLanguages?: readonly string[]): Promise<ConformanceReportResult>;
    private execute;
    private scenario;
    private evidence;
}
