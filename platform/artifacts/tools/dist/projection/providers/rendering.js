import { sha256 } from "../../primitives/sha256.js";
export function projectionFile(relativePath, content, definition) {
    const sourcePointers = [
        definition.sourcePointer,
        ...(definition.kind === "object"
            ? [
                ...definition.fields.map((field) => field.sourcePointer),
                ...definition.constants.map((constant) => constant.sourcePointer)
            ]
            : [])
    ];
    return {
        relativePath,
        content,
        digest: sha256(content),
        sourcePointers: [...new Set(sourcePointers)]
    };
}
export function encodedLiteral(target, value) {
    if (typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "boolean" && target === "python")
        return value ? "True" : "False";
    return String(value);
}
