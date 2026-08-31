export function valueAt(source, dottedPath) {
    return dottedPath.split(".").filter(Boolean).reduce((value, segment) => {
        if (Array.isArray(value) && /^\d+$/.test(segment))
            return value[Number(segment)];
        return value && typeof value === "object" ? value[segment] : undefined;
    }, source);
}
export function satisfies(actual, assertion) {
    if (assertion.operator === "equals")
        return JSON.stringify(actual) === JSON.stringify(assertion.value);
    if (assertion.operator === "contains")
        return Array.isArray(actual)
            ? actual.includes(assertion.value)
            : typeof actual === "string" && typeof assertion.value === "string" && actual.includes(assertion.value);
    if (assertion.operator === "not-contains")
        return !satisfies(actual, { operator: "contains", value: assertion.value });
    return false;
}
