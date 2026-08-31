export function projectConsumerQuery(input) {
    const requiredClosures = Array.isArray(input.queryAuthority.requiredClosures)
        ? input.queryAuthority.requiredClosures
        : [];
    const interfaces = input.interfaceAuthority.interfaces.filter((binding) => !binding.projectionTargets || binding.projectionTargets.includes(input.projectionTarget));
    return {
        queryType: "projected-consumer-conformance-query.v1",
        queryId: input.queryAuthority.queryId,
        capabilityId: input.capability.capabilityId,
        subjects: input.queryAuthority.subjects,
        requiredClosures: [...new Set([...requiredClosures, ...(input.interfaceAuthority.requiredPlatformObligations ?? [])])],
        dispositionPolicy: input.queryAuthority.dispositionPolicy,
        authorityGraph: {
            rootScenarioId: input.capability.rootScenarioId,
            scenarios: input.capability.scenarios,
            transitions: input.capability.transitions,
            ...(input.capability.edgeGroups ? { edgeGroups: input.capability.edgeGroups } : {}),
            ...(input.capability.recurrenceAuthorities ? { recurrenceAuthorities: input.capability.recurrenceAuthorities } : {}),
            ...(input.capability.scenarioOutcomes ? { scenarioOutcomes: input.capability.scenarioOutcomes } : {}),
            executionAuthorities: input.executionAuthorities.executionAuthorities,
            projectionAuthorities: input.projectionAuthorities.projectionAuthorities,
            interfaceAuthority: { ...input.interfaceAuthority, interfaces },
            contractAuthorities: input.contractAuthorities,
            admittedPlatformCapabilities: input.platformCapabilityCatalog.capabilities
        },
        expectedTelemetry: input.expectedTelemetry,
        ...(input.inspectableQueryCatalog ? { inspectableQueryCatalog: input.inspectableQueryCatalog } : {}),
        mechanicResolution: input.mechanicResolution,
        executableOrigin: input.executableOrigin
    };
}
export class ConsumerQueryProjector {
    project(input) {
        return projectConsumerQuery(input);
    }
}
