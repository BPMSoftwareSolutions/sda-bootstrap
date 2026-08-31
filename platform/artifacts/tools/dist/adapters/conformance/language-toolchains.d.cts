import type { SpawnSyncReturns } from "node:child_process";
import type { LanguageToolchain } from "../../ports/conformance/language-toolchain.js";
import type { LanguageObligation } from "../../conformance/model/conformance-evidence-set.js";
import type { BehavioralObservation } from "../../capabilities/kernel-implementation-admission/determine-behavioral-conformance/model.js";
import type { LanguageExecutionClosureObservation } from "../../capabilities/kernel-implementation-admission/determine-execution-closure/model.js";
type Execution = SpawnSyncReturns<string>;
declare function compileJavaConformance(packageRoot: string, outputDirectory: string, repositoryRoot: string): Execution;
declare function runJavaConformance(packageRoot: string, suite?: string, repositoryRoot?: string): Execution;
declare class NodeLanguageToolchains implements LanguageToolchain {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    observeBehavior(obligation: LanguageObligation): BehavioralObservation;
    observeExecutionClosure(language: string): Promise<LanguageExecutionClosureObservation>;
    private pythonExecutable;
    private observeNodeClosure;
}
declare const _default: {
    NodeLanguageToolchains: typeof NodeLanguageToolchains;
    compileJavaConformance: typeof compileJavaConformance;
    runJavaConformance: typeof runJavaConformance;
};
export = _default;
