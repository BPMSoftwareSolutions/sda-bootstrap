import fs from "node:fs";
import path from "node:path";
export const LANGUAGE_ECOSYSTEMS = Object.freeze([
    "cpp",
    "csharp",
    "go",
    "java",
    "kotlin",
    "python",
    "swift",
    "typescript"
]);
export const OWNED_IMPLEMENTATION_ROOTS = Object.freeze({
    node: "languages/typescript/runtimes/node",
    browser: "languages/typescript/runtimes/browser",
    react: "languages/typescript/presentation/react",
    "browser-dom": "languages/typescript/presentation/browser-dom",
    javafx: "languages/java/presentation/javafx",
    swiftui: "languages/swift/presentation/swiftui",
    "android-compose": "languages/kotlin/presentation/android-compose"
});
export function inspectLanguageEcosystemLayout(repositoryRoot) {
    const languagesRoot = path.join(repositoryRoot, "languages");
    const observed = fs.existsSync(languagesRoot)
        ? fs.readdirSync(languagesRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
        : [];
    const admitted = new Set(LANGUAGE_ECOSYSTEMS);
    const findings = [];
    for (const root of observed) {
        if (!admitted.has(root)) {
            const owner = Object.entries(OWNED_IMPLEMENTATION_ROOTS)
                .find(([implementation]) => implementation === root)?.[1];
            findings.push(Object.freeze({
                code: "NON_LANGUAGE_ROOT",
                path: `languages/${root}`,
                ...(owner ? { owner } : {})
            }));
        }
    }
    for (const ecosystem of LANGUAGE_ECOSYSTEMS) {
        if (!observed.includes(ecosystem)) {
            findings.push(Object.freeze({ code: "LANGUAGE_ECOSYSTEM_MISSING", path: `languages/${ecosystem}` }));
        }
    }
    for (const implementationRoot of Object.values(OWNED_IMPLEMENTATION_ROOTS)) {
        if (!fs.existsSync(path.join(repositoryRoot, ...implementationRoot.split("/")))) {
            findings.push(Object.freeze({ code: "OWNED_IMPLEMENTATION_MISSING", path: implementationRoot }));
        }
    }
    return Object.freeze({
        evidenceType: "language-ecosystem-layout-evidence.v1",
        languageRoots: Object.freeze(observed),
        findings: Object.freeze(findings),
        disposition: findings.length === 0 ? "PASS" : "FAIL"
    });
}
