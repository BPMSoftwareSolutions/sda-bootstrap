function declarations(authority) {
    return Array.isArray(authority.transitions) ? authority.transitions : [];
}
export class SemanticTransitionGraphBuilder {
    build(authority, projectedScenariosById) {
        return Object.freeze(declarations(authority).map((declared) => {
            const fromScenario = projectedScenariosById[declared.from.scenarioId];
            if (!fromScenario)
                throw new Error(`Transition "${declared.transitionId}" references unknown from scenario "${declared.from.scenarioId}".`);
            if (fromScenario.outcome.outcomeId !== declared.from.outcomeId) {
                throw new Error(`Transition "${declared.transitionId}" from outcome does not match scenario "${declared.from.scenarioId}".`);
            }
            const toScenario = projectedScenariosById[declared.to.scenarioId];
            if (!toScenario)
                throw new Error(`Transition "${declared.transitionId}" references unknown to scenario "${declared.to.scenarioId}".`);
            if (toScenario.input.inputId !== declared.to.inputId) {
                throw new Error(`Transition "${declared.transitionId}" to input does not match scenario "${declared.to.scenarioId}".`);
            }
            return {
                transitionId: declared.transitionId,
                from: {
                    scenarioId: declared.from.scenarioId,
                    outcomeId: declared.from.outcomeId,
                    contractId: fromScenario.outcome.contract.contractId
                },
                to: {
                    scenarioId: declared.to.scenarioId,
                    inputId: declared.to.inputId,
                    contractId: toScenario.input.contract.contractId
                },
                semanticProgress: declared.semanticProgress,
                ...(declared.bindingAuthorityId ? { bindingAuthorityId: declared.bindingAuthorityId } : {}),
                // Preserve declared v2 topology. Dropping these here is what forced
                // scenario-level selection and recurrence to stay ordered operation
                // lists: the compiler never saw a route it could admit as an edge.
                ...(declared.topologyKind ? { topologyKind: declared.topologyKind } : {}),
                ...(declared.selectsVariant ? { selectsVariant: declared.selectsVariant } : {}),
                ...(declared.edgeGroupId ? { edgeGroupId: declared.edgeGroupId } : {}),
                ...(declared.joinSlotId ? { joinSlotId: declared.joinSlotId } : {}),
                ...(declared.recurrenceAuthorityId ? { recurrenceAuthorityId: declared.recurrenceAuthorityId } : {})
            };
        }));
    }
}
export function projectTransitionsFromSemanticGraph(authority, projectedScenariosById) {
    return new SemanticTransitionGraphBuilder().build(authority, projectedScenariosById);
}
