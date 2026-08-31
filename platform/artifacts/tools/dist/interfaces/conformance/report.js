import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConformanceService } from "../../conformance/application/conformance-service.js";
import { ConformanceReportBuilder } from "../../conformance/publication/conformance-report-builder.js";
export async function publishConformanceReport(repositoryRoot, languages = []) { const result = await new ConformanceService(repositoryRoot).report(languages); return { result, report: new ConformanceReportBuilder().build(result) }; }
async function main() { const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd()); const result = await new ConformanceService(repositoryRoot).report(process.argv.slice(3)); process.stdout.write(new ConformanceReportBuilder().build(result)); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
