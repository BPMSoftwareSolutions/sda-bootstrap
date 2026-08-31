import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConformanceService } from "../../conformance/application/conformance-service.js";
export async function admitKernelImplementation(repositoryRoot, language) { return new ConformanceService(repositoryRoot).admit(language); }
async function main() { const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd()); const language = process.argv[3]; if (!language)
    throw new Error("Usage: admit.js <repository-root> <language>"); process.stdout.write(`${JSON.stringify(await admitKernelImplementation(repositoryRoot, language), null, 2)}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
