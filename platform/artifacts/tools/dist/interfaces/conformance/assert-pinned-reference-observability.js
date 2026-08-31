import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConformanceService } from "../../conformance/application/conformance-service.js";
export function assertPinnedReferenceObservability(repositoryRoot) { const requiredLanguages = [...new Set(new ConformanceService(repositoryRoot).obligations().map((item) => item.language))].sort(); const sets = [{ name: "behavioral conformance", ref: "artifacts/conformance/behavioral-observations.json", satisfied: (result) => result["toolchainAvailable"] === true && result["ran"] === true && result["conforming"] === true }, { name: "structural projection", ref: "artifacts/projection/projection-observations.json", satisfied: satisfiedDisposition }, { name: "execution-vector projection", ref: "artifacts/projection/execution-vector-observations.json", satisfied: satisfiedDisposition }, { name: "execution closure", ref: "artifacts/conformance/execution-closure-observations.json", satisfied: satisfiedDisposition }, { name: "consumer platform", ref: "artifacts/conformance/consumer-platform-observations.json", satisfied: satisfiedDisposition }]; const failures = []; for (const set of sets) {
    const source = path.join(repositoryRoot, set.ref);
    if (!fs.existsSync(source)) {
        failures.push(`${set.name}: evidence was not produced`);
        continue;
    }
    const document = JSON.parse(fs.readFileSync(source, "utf8"));
    for (const language of requiredLanguages) {
        const result = document.results?.[language];
        if (!result)
            failures.push(`${set.name}/${language}: observation is absent`);
        else if (!set.satisfied(result))
            failures.push(`${set.name}/${language}: ${String(result["disposition"] ?? result["reason"] ?? "not satisfied")}`);
    }
} return failures; }
function satisfiedDisposition(result) { return result["disposition"] === "SATISFIED" && result["conforming"] === true; }
function main() { const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd()); const failures = assertPinnedReferenceObservability(repositoryRoot); if (failures.length) {
    process.stderr.write(`Pinned reference environment is not fully observable:\n- ${failures.join("\n- ")}\n`);
    process.exitCode = 1;
}
else
    process.stdout.write("Pinned reference environment is fully observable.\n"); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main();
