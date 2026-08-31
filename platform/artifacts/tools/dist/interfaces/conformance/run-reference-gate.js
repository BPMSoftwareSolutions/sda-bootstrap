import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const suites = [
    "test:tools",
    // Named explicitly so a dropped or renamed graph suite fails the gate loudly
    // rather than disappearing into the top-level tooling discovery glob.
    "test:execution-graph",
    "test:projection",
    "test:execution-projection",
    "test:execution-closure",
    // Admission runs after projection so its proof-input digests describe the
    // final generated language sources left by the aggregate gate.
    "test:kernel",
    "test:consumer-projection"
];
export function runReferenceGate(repositoryRoot) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    let failed = null;
    for (const suite of suites) {
        const result = spawnSync(npm, ["run", suite], {
            cwd: repositoryRoot,
            stdio: "inherit",
            timeout: 600000,
            shell: process.platform === "win32"
        });
        if (result.error || result.status !== 0) {
            failed = suite;
            break;
        }
    }
    if (failed)
        throw new Error(`Aggregate verification failed in ${failed}.`);
}
function main() {
    try {
        runReferenceGate(path.resolve(process.argv[2] ?? process.cwd()));
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main();
