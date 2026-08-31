import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
import { ProcessJsonStructuralProjectionProvider } from "../../adapters/projection/process-json-projection-provider.js";
import { CSharpStructuralProjectionProvider } from "./csharp/structural-projection-provider.js";
import { GoStructuralProjectionProvider } from "./go/structural-projection-provider.js";
import { JavaStructuralProjectionProvider } from "./java/structural-projection-provider.js";
import { NodeStructuralProjectionProvider } from "./node/structural-projection-provider.js";
import { PythonStructuralProjectionProvider } from "./python/structural-projection-provider.js";
const providers = new Map([
    ["sda-csharp-structural-renderer.v1", new CSharpStructuralProjectionProvider()],
    ["sda-go-structural-renderer.v1", new GoStructuralProjectionProvider()],
    ["sda-java-structural-renderer.v1", new JavaStructuralProjectionProvider()],
    ["sda-node-structural-renderer.v1", new NodeStructuralProjectionProvider()],
    ["sda-python-structural-renderer.v1", new PythonStructuralProjectionProvider()]
]);
export function structuralProjectionProvider(target, repositoryRoot = process.cwd()) {
    const binding = new NodeLanguageTargetRegistry(repositoryRoot).verifiedProvider(target, "structuralRenderer");
    if (binding.transport === "process-json-v1")
        return new ProcessJsonStructuralProjectionProvider(repositoryRoot, target, binding);
    const provider = providers.get(binding.providerId);
    if (!provider || provider.target !== target)
        throw new Error(`No admitted structural projection provider is bound for '${target}'.`);
    return provider;
}
