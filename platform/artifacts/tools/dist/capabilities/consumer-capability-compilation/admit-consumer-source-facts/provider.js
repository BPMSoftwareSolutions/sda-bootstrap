export class AdmitConsumerSourceFactsProvider {
    responsibilityId = "load-validate-digest-and-relate-consumer-authority";
    async execute(input) {
        const facts = input.facts;
        const sources = [
            facts.workspace, facts.feature, facts.semanticGraph, facts.capabilityAuthority, facts.executionAuthorities,
            facts.projectionAuthorities, facts.interfaceAuthority, facts.fixtures, facts.queryAuthority,
            facts.telemetryAuthority, facts.platformCapabilityCatalog, facts.mandatoryMechanicProfile, facts.executionVector,
            ...facts.uiAuthorities.map((authority) => authority.fact),
            ...(facts.inspectableQueryCatalog ? [facts.inspectableQueryCatalog] : [])
        ];
        return Object.freeze({
            evidenceType: "consumer-source-admission-evidence.v1",
            workspaceId: facts.workspace.value.consumerId,
            sourceFacts: Object.freeze(sources.map(({ sourceRef, digest }) => ({ sourceRef, digest }))),
            facts,
            disposition: "ADMITTED"
        });
    }
}
