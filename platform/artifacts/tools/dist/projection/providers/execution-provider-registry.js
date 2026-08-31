import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
import { ProcessJsonExecutionProjectionProvider } from "../../adapters/projection/process-json-projection-provider.js";
import { CsharpExecutionProjectionProvider } from "./csharp/execution-projection-provider.js";
import { GoExecutionProjectionProvider } from "./go/execution-projection-provider.js";
import { JavaExecutionProjectionProvider } from "./java/execution-projection-provider.js";
import { NodeExecutionProjectionProvider } from "./node/execution-projection-provider.js";
import { PythonExecutionProjectionProvider } from "./python/execution-projection-provider.js";
const providers = new Map([
    ["sda-csharp-execution-renderer.v1", new CsharpExecutionProjectionProvider()],
    ["sda-go-execution-renderer.v1", new GoExecutionProjectionProvider()],
    ["sda-java-execution-renderer.v1", new JavaExecutionProjectionProvider()],
    ["sda-node-execution-renderer.v1", new NodeExecutionProjectionProvider()],
    ["sda-python-execution-renderer.v1", new PythonExecutionProjectionProvider()]
]);
export function executionProjectionProvider(target, repositoryRoot = process.cwd()) {
    const binding = new NodeLanguageTargetRegistry(repositoryRoot).verifiedProvider(target, "executionRenderer");
    if (binding.transport === "process-json-v1")
        return new ProcessJsonExecutionProjectionProvider(repositoryRoot, target, binding);
    const provider = providers.get(binding.providerId);
    if (!provider || provider.target !== target)
        throw new Error(`No admitted execution projection provider is registered for '${target}'.`);
    return provider;
}
