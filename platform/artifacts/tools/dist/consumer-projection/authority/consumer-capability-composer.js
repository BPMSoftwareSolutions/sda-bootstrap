export const CONSUMER_CAPABILITY_TYPE = "scenario-driven-capability.v1";
export class ConsumerCapabilityComposer {
    compose(authority, scenarios, transitions, semanticGraphAuthority) {
        if (typeof authority.capabilityId !== "string")
            throw new Error("Consumer capability authority has no capabilityId.");
        const edgeGroups = Array.isArray(semanticGraphAuthority?.edgeGroups)
            ? semanticGraphAuthority.edgeGroups : undefined;
        const recurrenceAuthorities = Array.isArray(semanticGraphAuthority?.recurrenceAuthorities)
            ? semanticGraphAuthority.recurrenceAuthorities : undefined;
        const scenarioOutcomes = Array.isArray(semanticGraphAuthority?.scenarioOutcomes)
            ? semanticGraphAuthority.scenarioOutcomes : undefined;
        return {
            capabilityType: CONSUMER_CAPABILITY_TYPE,
            capabilityId: authority.capabilityId,
            userStory: authority.userStory,
            scenarios,
            transitions,
            ...(edgeGroups ? { edgeGroups } : {}),
            ...(recurrenceAuthorities ? { recurrenceAuthorities } : {}),
            ...(scenarioOutcomes ? { scenarioOutcomes } : {}),
            ...(semanticGraphAuthority?.executionTopologyAuthority === "graph-v3"
                ? { executionTopologyAuthority: "graph-v3" }
                : {}),
            ...(typeof authority.rootScenarioId === "string" ? { rootScenarioId: authority.rootScenarioId } : {}),
            ...(typeof authority.name === "string" ? { name: authority.name } : {}),
            ...(typeof authority.mode === "string" ? { mode: authority.mode } : {}),
            ...(authority.experience && typeof authority.experience === "object"
                ? { experience: authority.experience }
                : {})
        };
    }
}
export function composeCapability(authority, scenarios, transitions = []) {
    return new ConsumerCapabilityComposer().compose(authority, scenarios, transitions);
}
