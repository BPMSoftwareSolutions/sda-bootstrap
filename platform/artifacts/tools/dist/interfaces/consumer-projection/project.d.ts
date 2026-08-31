import { type ConsumerCompilationOptions, type ConsumerCompilationResult } from "../../consumer-projection/application/consumer-capability-compiler.js";
export { parseAnnotatedGherkin } from "../../adapters/consumer-projection/annotated-gherkin-parser.js";
export { composeCapability } from "../../consumer-projection/authority/consumer-capability-composer.js";
export { projectTransitionsFromSemanticGraph } from "../../consumer-projection/authority/semantic-transition-graph-builder.js";
export { deriveMechanicRequirements, resolvePlatformMechanics } from "../../consumer-projection/authority/platform-responsibility-resolver.js";
export { projectExpectedTelemetry } from "../../consumer-projection/providers/common/expected-telemetry-projector.js";
export { projectConsumerQuery } from "../../consumer-projection/providers/common/consumer-query-projector.js";
export declare function projectConsumerCapability(workspaceRoot: string, options?: ConsumerCompilationOptions & {
    readonly repositoryRoot?: string;
}): Promise<ConsumerCompilationResult>;
