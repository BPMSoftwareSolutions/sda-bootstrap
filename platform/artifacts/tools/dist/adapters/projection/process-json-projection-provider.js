import { spawnSync } from "node:child_process";
import { NodeLanguageTargetRegistry } from "./node-language-target-registry.js";
function invoke(repositoryRoot, target, provider, fallbackOperation, payload) {
    if (provider.transport !== "process-json-v1")
        throw new Error(`Provider '${provider.providerId}' is not a process-json-v1 provider.`);
    const implementationPath = new NodeLanguageTargetRegistry(repositoryRoot).repositoryPath(provider.implementationRef);
    const operation = provider.operation ?? fallbackOperation;
    const child = spawnSync(process.execPath, [implementationPath, operation], {
        cwd: repositoryRoot,
        encoding: "utf8",
        input: JSON.stringify(payload),
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024
    });
    if (child.error || child.status !== 0) {
        throw new Error(`Registered provider '${provider.providerId}' failed for '${target}/${operation}': ${child.error?.message ?? child.stderr.trim() ?? `exit ${child.status}`}`);
    }
    try {
        return JSON.parse(child.stdout);
    }
    catch (error) {
        throw new Error(`Registered provider '${provider.providerId}' returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export class ProcessJsonStructuralProjectionProvider {
    repositoryRoot;
    target;
    provider;
    constructor(repositoryRoot, target, provider) {
        this.repositoryRoot = repositoryRoot;
        this.target = target;
        this.provider = provider;
    }
    render(graph, profile) {
        return invoke(this.repositoryRoot, this.target, this.provider, "render-structural", { graph, profile });
    }
}
export class ProcessJsonExecutionProjectionProvider {
    repositoryRoot;
    target;
    provider;
    constructor(repositoryRoot, target, provider) {
        this.repositoryRoot = repositoryRoot;
        this.target = target;
        this.provider = provider;
    }
    render(graph, profile) {
        return invoke(this.repositoryRoot, this.target, this.provider, "render-execution", { graph, profile });
    }
}
export class ProcessJsonProjectedShapeObserver {
    repositoryRoot;
    target;
    provider;
    constructor(repositoryRoot, target, provider) {
        this.repositoryRoot = repositoryRoot;
        this.target = target;
        this.provider = provider;
    }
    observe(admittedFiles, plan) {
        return invoke(this.repositoryRoot, this.target, this.provider, "observe-shape", { admittedFiles, plan });
    }
}
