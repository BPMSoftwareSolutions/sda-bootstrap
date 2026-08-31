import { compareNamedShapes } from "./shape-observer-mechanics.js";
function splitTopLevelCommas(value) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const character of value) {
        if (character === "<")
            depth += 1;
        if (character === ">")
            depth -= 1;
        if (character === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
        }
        else
            current += character;
    }
    if (current.trim())
        parts.push(current.trim());
    return parts;
}
function load(files) {
    const found = new Map();
    for (const file of files) {
        const pattern = /public sealed record (\w+)\(([\s\S]*?)\)(?=\s*[;{])/g;
        let match;
        while ((match = pattern.exec(file.content))) {
            found.set(match[1], { description: splitTopLevelCommas(match[2] ?? "").join(", ") });
        }
    }
    return found;
}
export class CSharpProjectedShapeObserver {
    target = "csharp";
    observe(admittedFiles, plan) {
        return compareNamedShapes(load(admittedFiles), load(plan.files));
    }
}
