import { compareNamedShapes } from "./shape-observer-mechanics.js";
function load(files) {
    const found = new Map();
    for (const file of files) {
        const interfacePattern = /export interface (\w+) \{([\s\S]*?)\n\}/g;
        let match;
        while ((match = interfacePattern.exec(file.content))) {
            const body = match[2] ?? "";
            const fields = body.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
                const field = /^(\w+)(\?)?:\s*(.+);$/.exec(line);
                return field ? `${field[1]}${field[2] ?? ""}: ${field[3]}` : "";
            }).filter(Boolean);
            found.set(match[1], { description: fields.join(", ") });
        }
        const enumPattern = /export type (\w+) =\s*([\s\S]*?);/g;
        while ((match = enumPattern.exec(file.content))) {
            found.set(match[1], {
                description: (match[2] ?? "").split("|").map((value) => value.trim()).filter(Boolean).join(" | ")
            });
        }
    }
    return found;
}
export class NodeProjectedShapeObserver {
    target = "node";
    observe(admittedFiles, plan) {
        return compareNamedShapes(admittedFiles.length ? load(admittedFiles) : new Map(), load(plan.files));
    }
}
