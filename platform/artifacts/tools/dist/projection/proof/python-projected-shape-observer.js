import { compareNamedShapes } from "./shape-observer-mechanics.js";
function load(files) {
    const found = new Map();
    for (const file of files) {
        const dataclassPattern = /@dataclass\(frozen=True\)\r?\nclass (\w+):\r?\n([\s\S]*?)(?=\r?\n@dataclass|$)/g;
        let match;
        while ((match = dataclassPattern.exec(file.content))) {
            const fields = (match[2] ?? "").split("\n").map((line) => line.trim())
                .filter((line) => line && !line.startsWith("#") && !line.startsWith("\"\"\""))
                .filter((line) => /^(\w+):/.test(line));
            found.set(match[1], { description: fields.join(", ") });
        }
        const literalPattern = /^(\w+) = Literal\[([\s\S]*?)\]$/gm;
        while ((match = literalPattern.exec(file.content))) {
            found.set(match[1], {
                description: (match[2] ?? "").split(",").map((value) => value.trim()).filter(Boolean).join(", ")
            });
        }
    }
    return found;
}
export class PythonProjectedShapeObserver {
    target = "python";
    observe(admittedFiles, plan) {
        return compareNamedShapes(load(admittedFiles), load(plan.files));
    }
}
