import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConformanceService } from "../../conformance/application/conformance-service.js";
export async function observeBehavioralConformance(repositoryRoot) { return new ConformanceService(repositoryRoot).observeBehavior(); }
export async function observeExecutionClosure(repositoryRoot) { return new ConformanceService(repositoryRoot).observeExecutionClosure(); }
async function main() { const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd()); const mode = process.argv[3] ?? "all"; const service = new ConformanceService(repositoryRoot); if (mode === "behavior" || mode === "all") {
    const behavior = await service.observeBehavior();
    for (const [language, result] of Object.entries(behavior))
        process.stdout.write(`[observed] [${language}] ran=${result.ran} conforming=${result.conforming} ${result.summary ?? result.reason ?? ""}\n`);
} if (mode === "closure" || mode === "all") {
    const closure = await service.observeExecutionClosure();
    for (const [language, result] of Object.entries(closure))
        process.stdout.write(`[closure] [${language}] ran=${result.ran} conforming=${result.conforming}\n`);
} }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
