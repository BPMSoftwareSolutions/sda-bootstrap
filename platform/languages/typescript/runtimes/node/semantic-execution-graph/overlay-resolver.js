import { sha256 } from "./canonical-json.js";
import { canonicalGraphDigest, normalizeOverlay } from "./normalizer.js";
export function resolveRealizationOverlay(graph, targetId, profiles) {
    const providerBindings = graph.requiredProviderSlots.map((slot) => {
        const matches = profiles.filter((profile) => profile.targetId === targetId && profile.mechanicIds.includes(slot.mechanicId));
        if (matches.length !== 1)
            throw new Error(`PROVIDER_BINDING_DIVERGENCE: '${slot.slotId}' resolved ${matches.length} provider profiles.`);
        const profile = matches[0];
        return Object.freeze({
            slotId: slot.slotId,
            cellId: slot.cellId,
            mechanicId: slot.mechanicId,
            providerProfileId: profile.profileId,
            providerProfileDigest: profile.profileDigest ?? sha256(profile),
            implementationRef: profile.implementationRef
        });
    });
    const physicalCells = profiles.flatMap((profile) => profile.targetId === targetId ? [...(profile.physicalCells ?? [])] : []);
    const physicalEdges = profiles.flatMap((profile) => profile.targetId === targetId ? [...(profile.physicalEdges ?? [])] : []);
    const base = Object.freeze({
        overlayType: "execution-graph-realization-overlay.v1",
        overlayId: `overlay:${graph.graphId}:${targetId}`,
        graphId: graph.graphId,
        canonicalGraphDigest: canonicalGraphDigest(graph),
        targetId,
        providerBindings: Object.freeze(providerBindings),
        physicalCells: Object.freeze(physicalCells),
        physicalEdges: Object.freeze(physicalEdges)
    });
    const normalized = normalizeOverlay(base);
    return Object.freeze({ ...normalized, overlayDigest: sha256(normalized) });
}
