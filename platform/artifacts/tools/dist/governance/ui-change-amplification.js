const targetPrefixes = {
    wpf: ["languages/csharp/src/ScenarioKernel.Wpf", "languages/csharp/tests/ScenarioKernel.Wpf"],
    react: ["languages/typescript/presentation/react/"], html: ["languages/typescript/presentation/browser-dom/"], javafx: ["languages/java/presentation/javafx/"],
    swiftui: ["languages/swift/presentation/swiftui/"], "android-compose": ["languages/kotlin/presentation/android-compose/"],
    "cpp-appkit": ["languages/cpp/ui/", "languages/cpp/conformance/ui_parity_test.cpp", "languages/cpp/projection/target-toolchain-profile.json"]
};
function under(path, prefixes) {
    return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}
export function evaluateUiChangeAmplification(policy, declaration, changedPaths) {
    const normalized = [...new Set(changedPaths.map((path) => path.replaceAll("\\", "/")))].sort();
    const relevant = normalized.filter((path) => under(path, policy.relevantPrefixes));
    if (relevant.length === 0)
        return Object.freeze({ evidenceType: "sda-ui-change-amplification-evidence.v1",
            changeClass: declaration?.changeClass ?? null, relevantPaths: Object.freeze([]), unexpectedPaths: Object.freeze([]), disposition: "NOT_APPLICABLE" });
    if (!declaration || !normalized.includes(policy.declarationRef))
        return Object.freeze({ evidenceType: "sda-ui-change-amplification-evidence.v1",
            changeClass: declaration?.changeClass ?? null, relevantPaths: Object.freeze(relevant),
            unexpectedPaths: Object.freeze(declaration ? [policy.declarationRef] : relevant), disposition: "CHANGE_AMPLIFICATION_VIOLATION" });
    const budget = policy.classes.find((candidate) => candidate.changeClass === declaration.changeClass);
    if (!budget)
        throw new Error(`Unknown UI change class '${declaration.changeClass}'.`);
    const dynamic = declaration.changeClass === "TARGET_PROVIDER_EVOLUTION"
        ? declaration.targets.flatMap((target) => targetPrefixes[target] ?? []) : [];
    const allowed = [...budget.allowedPrefixes, ...dynamic];
    const unexpected = relevant.filter((path) => !under(path, allowed));
    return Object.freeze({ evidenceType: "sda-ui-change-amplification-evidence.v1", changeClass: declaration.changeClass,
        relevantPaths: Object.freeze(relevant), unexpectedPaths: Object.freeze(unexpected),
        disposition: unexpected.length === 0 ? "PASS" : "CHANGE_AMPLIFICATION_VIOLATION" });
}
