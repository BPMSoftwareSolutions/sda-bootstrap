export function kebabCase(typeName) {
    return typeName
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}
export function screamingSnakeCase(name) {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}
export function tsLiteral(value) {
    if (typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "boolean" || typeof value === "number")
        return String(value);
    throw new Error(`Don't know how to render a TS literal for ${JSON.stringify(value)}`);
}
