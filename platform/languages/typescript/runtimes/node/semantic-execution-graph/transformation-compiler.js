import { sha256 } from "./canonical-json.js";
const CONTROL_KEYS = new Set(["op", "as", "path", "separator", "template"]);
const COLLECTION_OPERATORS = new Set(["map", "flat-map", "filter", "find", "some", "every"]);
function expression(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.op === "string"
        ? value : null;
}
function childExpressions(node) {
    const children = [];
    for (const key of Object.keys(node).sort()) {
        if (CONTROL_KEYS.has(key))
            continue;
        const value = node[key];
        const direct = expression(value);
        if (direct)
            children.push([key, direct]);
        else if (Array.isArray(value))
            value.forEach((item, index) => {
                const nested = expression(item);
                if (nested)
                    children.push([`${key}/${index}`, nested]);
            });
        else if (value !== null && typeof value === "object")
            for (const [nestedKey, item] of Object.entries(value)) {
                const nested = expression(item);
                if (nested)
                    children.push([`${key}/${nestedKey}`, nested]);
            }
    }
    return children;
}
function merge(target, source) {
    target.cells.push(...source.cells);
    target.edges.push(...source.edges);
    target.edgeGroups.push(...source.edgeGroups);
    target.recurrenceAuthorities.push(...source.recurrenceAuthorities);
    target.requiredProviderSlots.push(...source.requiredProviderSlots);
}
export class SemanticTransformationGraphCompiler {
    // `scopeId` separates cell identity from transformation identity. One
    // transformation authority may be invoked from many operations; each
    // invocation is its own execution site and needs distinct, content-stable cell
    // identity, while provenance still resolves to the shared authority.
    compile(transformationId, root, parentCellId, authorityDigest = sha256(root), maximumCollectionIterations = 10_000, scopeId = transformationId) {
        const compiled = this.compileNode(transformationId, root, parentCellId, "expression", authorityDigest, maximumCollectionIterations, scopeId);
        return Object.freeze({
            entryCellIds: Object.freeze(compiled.entryCellIds),
            exitCellIds: Object.freeze(compiled.exitCellIds),
            cells: Object.freeze(compiled.cells),
            edges: Object.freeze(compiled.edges),
            edgeGroups: Object.freeze(compiled.edgeGroups),
            recurrenceAuthorities: Object.freeze(compiled.recurrenceAuthorities),
            requiredProviderSlots: Object.freeze(compiled.requiredProviderSlots)
        });
    }
    compileNode(transformationId, node, parentCellId, pointer, authorityDigest, maximumCollectionIterations, scopeId) {
        const op = String(node.op);
        const safePointer = pointer.replace(/[^a-zA-Z0-9._-]+/g, ".").replace(/^\.+|\.+$/g, "");
        const cellId = `cell:mechanic:${scopeId}:${safePointer}`;
        if (op === "if")
            return this.compileIf(transformationId, node, parentCellId, pointer, cellId, authorityDigest, maximumCollectionIterations, scopeId);
        const result = { entryCellIds: [], exitCellIds: [cellId], cells: [], edges: [], edgeGroups: [], recurrenceAuthorities: [], requiredProviderSlots: [] };
        const children = childExpressions(node).map(([key, child]) => this.compileNode(transformationId, child, parentCellId, `${pointer}/${key}`, authorityDigest, maximumCollectionIterations, scopeId));
        for (const child of children)
            merge(result, child);
        const providerSlotId = `slot:mechanic:${scopeId}:${safePointer}`;
        const variants = COLLECTION_OPERATORS.has(op) ? ["CONTINUE", "STOP"] : ["VALUE"];
        result.cells.push(Object.freeze({
            cellId,
            semanticAddress: `${transformationId}#/${pointer}`,
            altitude: "mechanic",
            parentCellId,
            input: Object.freeze({ portId: `${cellId}:input`, contractId: "semantic-value.v1", cardinality: children.length > 1 ? "named-product" : "one" }),
            execution: Object.freeze({
                kind: "mechanic",
                authorityId: `mechanic:${op}.v1`,
                authorityDigest: sha256(node),
                protocolRef: "cell-execution-protocol.v1",
                providerSlotId,
                configuration: node
            }),
            outcome: Object.freeze({ portId: `${cellId}:outcome`, contractId: "semantic-value.v1", variants: Object.freeze(variants) }),
            sourcePointers: Object.freeze([`semantic-transformation.authority.json#/${pointer}`]),
            sourceAuthorityDigests: Object.freeze([authorityDigest])
        }));
        result.requiredProviderSlots.push(Object.freeze({
            slotId: providerSlotId,
            cellId,
            mechanicId: op,
            profileConstraints: Object.freeze(["target-neutral", ...(COLLECTION_OPERATORS.has(op) ? [] : ["deterministic"])])
        }));
        if (children.length === 0)
            result.entryCellIds = [cellId];
        else {
            result.entryCellIds = [...children[0].entryCellIds];
            for (let index = 0; index < children.length - 1; index += 1) {
                const current = children[index];
                const next = children[index + 1];
                result.edges.push(this.edge(`${cellId}:dependency:${index + 1}`, "sequence", current.exitCellIds[0], next.entryCellIds[0], authorityDigest, pointer));
            }
            result.edges.push(this.edge(`${cellId}:dependency:result`, "sequence", children.at(-1).exitCellIds[0], cellId, authorityDigest, pointer));
        }
        if (COLLECTION_OPERATORS.has(op)) {
            const recurrenceAuthorityId = `recurrence:${scopeId}:${safePointer}`;
            const groupId = `group:${recurrenceAuthorityId}`;
            const recur = this.edge(`${cellId}:recur`, "recurrence", cellId, cellId, authorityDigest, pointer, {
                selectsVariant: "CONTINUE", groupId, recurrenceAuthorityId
            });
            result.edges.push(recur);
            result.edgeGroups.push(Object.freeze({ groupId, kind: "recurrence", edgeIds: Object.freeze([recur.edgeId]), policy: "bounded" }));
            result.recurrenceAuthorities.push(Object.freeze({
                recurrenceAuthorityId,
                continuationVariant: "CONTINUE",
                stopVariant: "STOP",
                maximumIterations: maximumCollectionIterations,
                cancellationPolicy: "immediate",
                authorityDigest: sha256({ transformationId, scopeId, pointer, maximumCollectionIterations })
            }));
        }
        return result;
    }
    compileIf(transformationId, node, parentCellId, pointer, cellId, authorityDigest, maximumCollectionIterations, scopeId) {
        const when = expression(node.when);
        const thenValue = expression(node.then);
        const elseValue = expression(node.else);
        if (!when || !thenValue || !elseValue)
            throw new Error(`TRANSFORMATION_IF_INCOMPLETE: '${pointer}'.`);
        const predicate = this.compileNode(transformationId, when, parentCellId, `${pointer}/when`, authorityDigest, maximumCollectionIterations, scopeId);
        const selected = this.compileNode(transformationId, thenValue, parentCellId, `${pointer}/then`, authorityDigest, maximumCollectionIterations, scopeId);
        const alternate = this.compileNode(transformationId, elseValue, parentCellId, `${pointer}/else`, authorityDigest, maximumCollectionIterations, scopeId);
        const result = { entryCellIds: [...predicate.entryCellIds], exitCellIds: [cellId], cells: [], edges: [], edgeGroups: [], recurrenceAuthorities: [], requiredProviderSlots: [] };
        merge(result, predicate);
        merge(result, selected);
        merge(result, alternate);
        const routerId = `${cellId}:selection`;
        result.cells.push(Object.freeze({
            cellId: routerId,
            semanticAddress: `${transformationId}#/${pointer}/selection`,
            altitude: "mechanic",
            parentCellId,
            input: Object.freeze({ portId: `${routerId}:input`, contractId: "semantic-value.v1" }),
            execution: Object.freeze({ kind: "junction", authorityId: "junction:boolean-selection.v1", authorityDigest: sha256(node.when), protocolRef: "cell-execution-protocol.v1" }),
            outcome: Object.freeze({ portId: `${routerId}:outcome`, contractId: "semantic-value.v1", variants: Object.freeze(["TRUE", "FALSE"]) }),
            sourcePointers: Object.freeze([`semantic-transformation.authority.json#/${pointer}/when`]),
            sourceAuthorityDigests: Object.freeze([authorityDigest])
        }));
        const resultSlotId = `slot:mechanic:${scopeId}:${pointer.replace(/[^a-zA-Z0-9._-]+/g, ".")}:result`;
        result.cells.push(Object.freeze({
            cellId,
            semanticAddress: `${transformationId}#/${pointer}`,
            altitude: "mechanic",
            parentCellId,
            input: Object.freeze({ portId: `${cellId}:input`, contractId: "semantic-value.v1" }),
            execution: Object.freeze({ kind: "mechanic", authorityId: "mechanic:identity.v1", authorityDigest: sha256(node), protocolRef: "cell-execution-protocol.v1", providerSlotId: resultSlotId }),
            outcome: Object.freeze({ portId: `${cellId}:outcome`, contractId: "semantic-value.v1", variants: Object.freeze(["VALUE"]) }),
            sourcePointers: Object.freeze([`semantic-transformation.authority.json#/${pointer}`]),
            sourceAuthorityDigests: Object.freeze([authorityDigest])
        }));
        result.requiredProviderSlots.push(Object.freeze({ slotId: resultSlotId, cellId, mechanicId: "identity", profileConstraints: Object.freeze(["deterministic", "target-neutral"]) }));
        result.edges.push(this.edge(`${routerId}:predicate`, "sequence", predicate.exitCellIds[0], routerId, authorityDigest, pointer));
        const groupId = `group:${routerId}`;
        const trueEdge = this.edge(`${routerId}:true`, "selection", routerId, selected.entryCellIds[0], authorityDigest, pointer, { selectsVariant: "TRUE", groupId });
        const falseEdge = this.edge(`${routerId}:false`, "selection", routerId, alternate.entryCellIds[0], authorityDigest, pointer, { selectsVariant: "FALSE", groupId });
        result.edges.push(trueEdge, falseEdge);
        result.edgeGroups.push(Object.freeze({
            groupId, kind: "selection", edgeIds: Object.freeze([trueEdge.edgeId, falseEdge.edgeId]), policy: "exactly-one",
            exhaustive: true, exclusive: true, defaultEdgeId: falseEdge.edgeId
        }));
        result.edges.push(this.edge(`${cellId}:then-result`, "sequence", selected.exitCellIds[0], cellId, authorityDigest, pointer));
        result.edges.push(this.edge(`${cellId}:else-result`, "sequence", alternate.exitCellIds[0], cellId, authorityDigest, pointer));
        return result;
    }
    edge(edgeId, kind, fromCellId, toCellId, authorityDigest, pointer, options = {}) {
        return Object.freeze({
            edgeId,
            kind,
            from: Object.freeze({ cellId: fromCellId, portId: `${fromCellId}:outcome` }),
            to: Object.freeze({ cellId: toCellId, portId: `${toCellId}:input` }),
            edgeContractId: "semantic-value.v1",
            authorityDigest,
            sourcePointers: Object.freeze([`semantic-transformation.authority.json#/${pointer}`]),
            ...(options.selectsVariant ? { selectsVariant: options.selectsVariant } : {}),
            ...(options.groupId ? { groupId: options.groupId } : {}),
            ...(options.recurrenceAuthorityId ? { recurrenceAuthorityId: options.recurrenceAuthorityId } : {})
        });
    }
}
