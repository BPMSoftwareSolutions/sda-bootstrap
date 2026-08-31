export function canonicalizeInterfaceKind(kind) {
    return kind === "http" ? "api" : kind;
}
