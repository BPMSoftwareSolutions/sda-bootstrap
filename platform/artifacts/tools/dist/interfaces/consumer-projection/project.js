import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ConsumerCapabilityCompiler } from "../../consumer-projection/application/consumer-capability-compiler.js";
export { parseAnnotatedGherkin } from "../../adapters/consumer-projection/annotated-gherkin-parser.js";
export { composeCapability } from "../../consumer-projection/authority/consumer-capability-composer.js";
export { projectTransitionsFromSemanticGraph } from "../../consumer-projection/authority/semantic-transition-graph-builder.js";
export { deriveMechanicRequirements, resolvePlatformMechanics } from "../../consumer-projection/authority/platform-responsibility-resolver.js";
export { projectExpectedTelemetry } from "../../consumer-projection/providers/common/expected-telemetry-projector.js";
export { projectConsumerQuery } from "../../consumer-projection/providers/common/consumer-query-projector.js";
function inferredRepositoryRoot() {
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, "kernel", "schemas")))
        return cwd;
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}
export async function projectConsumerCapability(workspaceRoot, options = {}) {
    const repositoryRoot = options.repositoryRoot ?? inferredRepositoryRoot();
    const compilerOptions = {
        ...(options.projectionTargets ? { projectionTargets: options.projectionTargets } : {}),
        ...(options.failureInjection ? { failureInjection: options.failureInjection } : {}),
        ...(options.executionId ? { executionId: options.executionId } : {}),
        ...(options.proofProfile ? { proofProfile: options.proofProfile } : {})
    };
    return new ConsumerCapabilityCompiler(repositoryRoot).compile(workspaceRoot, compilerOptions);
}
async function main() {
    const workspaceRoot = process.argv[2];
    if (!workspaceRoot)
        throw new Error("Usage: project-consumer-capability <workspace-root> [--targets=node,csharp,python]");
    const targetOption = process.argv.find((argument) => argument.startsWith("--targets="));
    const projectionTargets = targetOption
        ? targetOption.slice("--targets=".length).split(",").filter(Boolean)
        : undefined;
    const proofProfileOption = process.argv.find((argument) => argument.startsWith("--proof-profile="));
    const proofProfile = proofProfileOption
        ? JSON.parse(fs.readFileSync(path.resolve(proofProfileOption.slice("--proof-profile=".length)), "utf8"))
        : undefined;
    const result = await projectConsumerCapability(workspaceRoot, {
        ...(projectionTargets ? { projectionTargets } : {}),
        ...(proofProfile ? { proofProfile } : {})
    });
    process.stdout.write(`Projected executable consumer capability '${String(result.capability.capabilityId)}' with ` +
        `${result.scenarios.length} scenario(s), ${result.transitions.length} transition(s), ${Object.keys(result.queries).join("+")} runtime(s), and tests into ` +
        `${path.relative(process.cwd(), result.outDir)}.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        process.stderr.write(`Consumer compilation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
