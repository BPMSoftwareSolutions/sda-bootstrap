import { compareNamedShapes } from "./shape-observer-mechanics.js";
function splitTopLevelCommas(value) {
    const result = [];
    let depth = 0;
    let current = "";
    for (const character of value) {
        if (character === "<")
            depth += 1;
        if (character === ">")
            depth -= 1;
        if (character === "," && depth === 0) {
            result.push(current.trim());
            current = "";
        }
        else
            current += character;
    }
    if (current.trim())
        result.push(current.trim());
    return result;
}
function load(files) {
    const found = new Map();
    for (const file of files) {
        const record = /public record (\w+)\s*\(([\s\S]*?)\)\s*\{/.exec(file.content);
        if (record) {
            const constants = [...file.content.matchAll(/public static final String (\w+) = ([^;]+);/g)]
                .map((match) => `${match[1]}=${match[2]}`);
            found.set(record[1], {
                description: `${splitTopLevelCommas(record[2] ?? "").join(", ")};${constants.join(",")}`
            });
            continue;
        }
        const enumeration = /public enum (\w+)\s*\{([\s\S]*?);/.exec(file.content);
        if (enumeration)
            found.set(enumeration[1], { description: splitTopLevelCommas(enumeration[2] ?? "").join(", ") });
    }
    return found;
}
export class JavaProjectedShapeObserver {
    target = "java";
    observe(admittedFiles, plan) {
        return compareNamedShapes(load(admittedFiles), load(plan.files));
    }
}
