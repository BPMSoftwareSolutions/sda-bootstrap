import path from "node:path";
import { pathToFileURL } from "node:url";
import { ConsumerAssuranceService } from "../../consumer-projection/application/consumer-assurance-service.js";
export async function observeLanguageMechanicProfiles(repositoryRoot) {
    return new ConsumerAssuranceService(path.resolve(repositoryRoot)).determinePlatformMechanicConformance();
}
async function main() {
    const result = await observeLanguageMechanicProfiles(process.cwd());
    const evidence = result.closure.evidence;
    for (const language of evidence?.languages ?? []) {
        process.stdout.write(`[${String(language.language)}] kernel=${String(language.kernelAdmission)} consumer=${String(language.disposition)} ` +
            `resolved=${String(language.resolved)}/${String(language.required)}\n`);
    }
    if (result.closure.obligationDisposition.kind === "NOT_SATISFIED")
        process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
