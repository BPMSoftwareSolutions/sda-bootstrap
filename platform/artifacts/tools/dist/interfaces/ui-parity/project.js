#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UiParityProjector } from "../../ui-parity/application/ui-parity-projector.js";
function defaultRepositoryRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}
export function projectUiParity(workspaceRoot, targets) {
    return new UiParityProjector(defaultRepositoryRoot()).project(workspaceRoot, targets ? { targets } : {});
}
function requestedTargets(args) {
    const option = args.find((value) => value.startsWith("--targets="));
    if (!option)
        return undefined;
    const aliases = { csharp: "wpf", wpf: "wpf", react: "react", html: "html", javafx: "javafx", swiftui: "swiftui", "android-compose": "android-compose" };
    return option.slice("--targets=".length).split(",").filter(Boolean).map((value) => {
        const target = aliases[value.trim().toLowerCase()];
        if (!target)
            throw new Error(`Unknown UI projection target '${value}'.`);
        return target;
    });
}
async function main() {
    const workspace = process.argv[2];
    if (!workspace)
        throw new Error("Usage: project-ui-parity <consumer-workspace> [--targets=wpf,react,javafx]");
    const result = projectUiParity(path.resolve(workspace), requestedTargets(process.argv.slice(3)));
    process.stdout.write(`${JSON.stringify({
        applicationId: result.applicationId,
        authorityDigest: result.authorityDigest,
        vectorCorpusDigest: result.vectorCorpusDigest,
        targets: result.targets,
        declaredTargets: result.declaredTargets,
        projectedTargets: result.projectedTargets,
        executableOrigin: result.executableOrigin,
        disposition: result.disposition,
        repositoryRoot: defaultRepositoryRoot()
    })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
