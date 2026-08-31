import { compareNamedShapes } from "./shape-observer-mechanics.js";
function load(files) {
    const found = new Map();
    for (const file of files) {
        const structure = /type\s+(\w+)\s+struct\s*\{([\s\S]*?)\}/.exec(file.content);
        if (structure) {
            found.set(structure[1], {
                description: (structure[2] ?? "").split("\n")
                    .map((line) => line.trim().replace(/\s+/g, " "))
                    .filter(Boolean)
                    .join(", ")
            });
            continue;
        }
        const enumeration = /type\s+(\w+)\s+string/.exec(file.content);
        if (enumeration) {
            const values = [...file.content.matchAll(/^\s*(\w+)\s+\w+\s+=\s+(.+)$/gm)].map((match) => `${match[1]}=${match[2]}`);
            found.set(enumeration[1], { description: values.join(", ") });
        }
    }
    return found;
}
export class GoProjectedShapeObserver {
    target = "go";
    observe(admittedFiles, plan) {
        return compareNamedShapes(load(admittedFiles), load(plan.files));
    }
}
