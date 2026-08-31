#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
function repositoryRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}
function run(command, args, cwd, timeout) {
    const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout });
    if (result.error || result.status !== 0)
        throw new Error(result.error?.message ?? result.stderr ?? result.stdout ?? `${command} failed.`);
    return result.stdout;
}
export function collectWpfUiTestimony(workspaceRoot) {
    if (process.platform !== "win32")
        throw new Error("Native WPF testimony requires Windows.");
    const repository = repositoryRoot();
    const root = path.resolve(workspaceRoot);
    const projectedProject = path.join(root, "projected", "csharp", "ProjectedConsumerWpf.generated.csproj");
    if (!fs.existsSync(projectedProject))
        throw new Error("Projected WPF application does not exist. Run consumer projection first.");
    const output = path.join(repository, "artifacts", "ui-parity", "wpf-app", path.basename(root));
    fs.mkdirSync(output, { recursive: true });
    run("dotnet", ["build", projectedProject, "--nologo", "--output", output], repository, 180_000);
    const executable = path.join(output, "ProjectedConsumerWpf.generated.exe");
    if (!fs.existsSync(executable))
        throw new Error(`Projected WPF executable '${executable}' was not materialized.`);
    const harness = path.join(repository, "languages", "csharp", "src", "ScenarioKernel.Wpf.Conformance", "ScenarioKernel.Wpf.Conformance.csproj");
    run("dotnet", ["build", harness, "--nologo"], repository, 180_000);
    return run("dotnet", ["run", "--project", harness, "--no-build", "--", root, executable], repository, 600_000).trim();
}
async function main() {
    const workspace = process.argv[2];
    if (!workspace)
        throw new Error("Usage: collect-wpf-ui-testimony <consumer-workspace>");
    process.stdout.write(`${collectWpfUiTestimony(workspace)}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
