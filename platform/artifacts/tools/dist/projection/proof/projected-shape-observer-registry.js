import { CSharpProjectedShapeObserver } from "./csharp-projected-shape-observer.js";
import { GoProjectedShapeObserver } from "./go-projected-shape-observer.js";
import { JavaProjectedShapeObserver } from "./java-projected-shape-observer.js";
import { NodeProjectedShapeObserver } from "./node-projected-shape-observer.js";
import { PythonProjectedShapeObserver } from "./python-projected-shape-observer.js";
import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
import { ProcessJsonProjectedShapeObserver } from "../../adapters/projection/process-json-projection-provider.js";
const observers = new Map([
    ["sda-csharp-shape-observer.v1", new CSharpProjectedShapeObserver()],
    ["sda-go-shape-observer.v1", new GoProjectedShapeObserver()],
    ["sda-java-shape-observer.v1", new JavaProjectedShapeObserver()],
    ["sda-node-shape-observer.v1", new NodeProjectedShapeObserver()],
    ["sda-python-shape-observer.v1", new PythonProjectedShapeObserver()]
]);
export function projectedShapeObserver(target, repositoryRoot = process.cwd()) {
    const binding = new NodeLanguageTargetRegistry(repositoryRoot).verifiedProvider(target, "shapeObserver");
    if (binding.transport === "process-json-v1")
        return new ProcessJsonProjectedShapeObserver(repositoryRoot, target, binding);
    const observer = observers.get(binding.providerId);
    if (!observer || observer.target !== target)
        throw new Error(`No admitted projected-shape observer is bound for '${target}'.`);
    return observer;
}
