import type { BindingStatus } from "./binding-status.js";
import type { LanguageBindingProjectReferences } from "./language-binding-project-references.js";
export declare const BINDING_TYPE: "scenario-kernel-language-binding.v1";
export interface LanguageBinding {
    kernelSpecification: string;
    language: string;
    implementationId: string;
    implements: string[];
    conformanceCorpus: string;
    name?: string;
    status?: BindingStatus;
    implementationVersion?: string;
    implementationDigest?: string;
    projectReferences?: LanguageBindingProjectReferences;
    created?: string;
}
