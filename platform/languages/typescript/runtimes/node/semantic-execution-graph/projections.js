function mermaidId(value) {
    return `N_${Buffer.from(value).toString("hex")}`;
}
function escapeLabel(value) {
    return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
export function renderExecutionGraphMermaid(graph) {
    const lines = ["flowchart TD"];
    for (const cell of [...graph.cells].sort((left, right) => left.cellId.localeCompare(right.cellId))) {
        lines.push(`  ${mermaidId(cell.cellId)}["${escapeLabel(`${cell.cellId} (${cell.altitude})`)}"]`);
    }
    for (const edge of [...graph.edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId))) {
        const route = edge.selectsVariant ? `${edge.kind}: ${edge.selectsVariant}` : edge.kind;
        lines.push(`  ${mermaidId(edge.from.cellId)} -->|"${escapeLabel(`${edge.edgeId} [${route}]`)}"| ${mermaidId(edge.to.cellId)}`);
    }
    for (const decomposition of [...graph.decompositions].sort((left, right) => left.parentCellId.localeCompare(right.parentCellId))) {
        for (const entry of [...decomposition.entryCellIds].sort()) {
            lines.push(`  ${mermaidId(decomposition.parentCellId)} -. "decomposes" .-> ${mermaidId(entry)}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
export function graphProjectionData(graph) {
    return Object.freeze({
        graphId: graph.graphId,
        rootCellId: graph.rootCellId,
        cells: Object.freeze([...graph.cells].sort((left, right) => left.cellId.localeCompare(right.cellId)).map((cell) => Object.freeze({
            cellId: cell.cellId,
            altitude: cell.altitude,
            authorityId: cell.execution.authorityId
        }))),
        routes: Object.freeze([...graph.edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId)).map((edge) => Object.freeze({
            edgeId: edge.edgeId,
            kind: edge.kind,
            fromCellId: edge.from.cellId,
            toCellId: edge.to.cellId,
            variant: edge.selectsVariant ?? null
        })))
    });
}
export function reverseExecutionLineage(graph, leafCellId) {
    const byId = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
    if (!byId.has(leafCellId))
        throw new Error(`UNKNOWN_LINEAGE_CELL: '${leafCellId}'.`);
    const lineage = [];
    const visited = new Set();
    let current = leafCellId;
    while (current && !visited.has(current)) {
        visited.add(current);
        lineage.push(current);
        const cell = byId.get(current);
        if (cell.parentCellId)
            current = cell.parentCellId;
        else {
            const incoming = [...graph.edges].filter((edge) => edge.to.cellId === current && edge.kind !== "recurrence").sort((left, right) => left.edgeId.localeCompare(right.edgeId));
            current = incoming[0]?.from.cellId;
        }
    }
    return Object.freeze(lineage);
}
