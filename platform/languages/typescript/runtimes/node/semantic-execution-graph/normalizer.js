import { sha256 } from "./canonical-json.js";
function by(selector) {
    return (left, right) => selector(left).localeCompare(selector(right));
}
export function normalizeGraph(graph) {
    return Object.freeze({
        ...graph,
        authority: Object.freeze({ ...graph.authority, sourceRefs: Object.freeze([...graph.authority.sourceRefs].sort()) }),
        cells: Object.freeze([...graph.cells].map((cell) => Object.freeze({
            ...cell,
            sourcePointers: Object.freeze([...cell.sourcePointers].sort()),
            sourceAuthorityDigests: Object.freeze([...cell.sourceAuthorityDigests].sort()),
            ...(cell.outcome.variants ? { outcome: Object.freeze({ ...cell.outcome, variants: Object.freeze([...cell.outcome.variants].sort()) }) } : {})
        })).sort(by((cell) => cell.cellId))),
        edges: Object.freeze([...graph.edges].map((edge) => Object.freeze({
            ...edge,
            sourcePointers: Object.freeze([...edge.sourcePointers].sort())
        })).sort(by((edge) => edge.edgeId))),
        decompositions: Object.freeze([...graph.decompositions].map((item) => Object.freeze({
            ...item,
            entryCellIds: Object.freeze([...item.entryCellIds].sort()),
            exitCellIds: Object.freeze([...item.exitCellIds].sort())
        })).sort(by((item) => item.parentCellId))),
        edgeGroups: Object.freeze([...graph.edgeGroups].map((group) => Object.freeze({
            ...group,
            edgeIds: Object.freeze([...group.edgeIds].sort()),
            ...(group.requiredSlotIds ? { requiredSlotIds: Object.freeze([...group.requiredSlotIds].sort()) } : {})
        })).sort(by((group) => group.groupId))),
        recurrenceAuthorities: Object.freeze([...graph.recurrenceAuthorities].sort(by((item) => item.recurrenceAuthorityId))),
        requiredProviderSlots: Object.freeze([...graph.requiredProviderSlots].map((slot) => Object.freeze({
            ...slot,
            profileConstraints: Object.freeze([...slot.profileConstraints].sort())
        })).sort(by((slot) => slot.slotId)))
    });
}
export function canonicalGraphDigest(graph) {
    return sha256(normalizeGraph(graph));
}
export function normalizeOverlay(overlay) {
    const normalized = {
        ...overlay,
        providerBindings: Object.freeze([...overlay.providerBindings].sort(by((item) => item.slotId))),
        physicalCells: Object.freeze([...overlay.physicalCells].sort(by((item) => item.cellId))),
        physicalEdges: Object.freeze([...overlay.physicalEdges].sort(by((item) => item.edgeId)))
    };
    return Object.freeze(normalized);
}
export function realizedGraphDigest(graph, overlay) {
    return sha256({ canonicalGraphDigest: canonicalGraphDigest(graph), overlay: normalizeOverlay(overlay) });
}
