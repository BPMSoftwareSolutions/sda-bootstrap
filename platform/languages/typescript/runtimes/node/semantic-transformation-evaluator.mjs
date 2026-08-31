import crypto from "node:crypto";
import { valueAt } from "./native-mechanic-primitives.mjs";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function directedGraphClosure(value) {
  const graphInputValid = Boolean(value && typeof value === "object" && !Array.isArray(value));
  const graph = graphInputValid ? value : {};
  const declaredNodeIds = Array.isArray(graph.nodeIds) ? graph.nodeIds : [];
  const declaredEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const declaredRootNodeIds = Array.isArray(graph.rootNodeIds) ? graph.rootNodeIds : [];
  const declaredTerminalNodeIds = Array.isArray(graph.terminalNodeIds) ? graph.terminalNodeIds : [];
  const findings = [];
  const findingKeys = new Set();
  const addFinding = (code, subjectId) => {
    const key = `${code}\u0000${subjectId}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push({ code, subjectId });
  };
  const lexical = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  if (!graphInputValid) addFinding("GRAPH_INPUT_INVALID", "input");
  if (!Array.isArray(graph.nodeIds)) addFinding("GRAPH_NODE_IDS_REQUIRED", "nodeIds");
  if (!Array.isArray(graph.edges)) addFinding("GRAPH_EDGES_REQUIRED", "edges");
  if (!Array.isArray(graph.rootNodeIds)) addFinding("GRAPH_ROOT_NODE_IDS_REQUIRED", "rootNodeIds");
  if (!Array.isArray(graph.terminalNodeIds)) addFinding("GRAPH_TERMINAL_NODE_IDS_REQUIRED", "terminalNodeIds");

  const nodeCounts = new Map();
  for (const nodeId of declaredNodeIds) {
    if (typeof nodeId !== "string" || nodeId.length === 0) {
      addFinding("GRAPH_NODE_ID_INVALID", String(nodeId));
      continue;
    }
    nodeCounts.set(nodeId, (nodeCounts.get(nodeId) ?? 0) + 1);
  }
  for (const [nodeId, count] of nodeCounts) {
    if (count > 1) addFinding("GRAPH_NODE_ID_DUPLICATE", nodeId);
  }
  const nodeIds = [...nodeCounts.keys()].sort(lexical);
  const nodeSet = new Set(nodeIds);

  const edgeCounts = new Map();
  const edges = [];
  for (const edge of declaredEdges) {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)
      || typeof edge.edgeId !== "string" || edge.edgeId.length === 0
      || typeof edge.from !== "string" || edge.from.length === 0
      || typeof edge.to !== "string" || edge.to.length === 0) {
      addFinding("GRAPH_EDGE_INVALID", String(edge?.edgeId ?? ""));
      continue;
    }
    edgeCounts.set(edge.edgeId, (edgeCounts.get(edge.edgeId) ?? 0) + 1);
    edges.push({ edgeId: edge.edgeId, from: edge.from, to: edge.to });
  }
  for (const [edgeId, count] of edgeCounts) {
    if (count > 1) addFinding("GRAPH_EDGE_ID_DUPLICATE", edgeId);
  }
  edges.sort((left, right) => lexical(left.edgeId, right.edgeId)
    || lexical(left.from, right.from) || lexical(left.to, right.to));
  for (const edge of edges) {
    if (!nodeSet.has(edge.from)) addFinding("GRAPH_EDGE_SOURCE_UNRESOLVED", edge.edgeId);
    if (!nodeSet.has(edge.to)) addFinding("GRAPH_EDGE_TARGET_UNRESOLVED", edge.edgeId);
  }

  const normalizeDeclaredNodes = (values, invalidCode, invalidIdentityCode) => {
    for (const nodeId of values) {
      if (typeof nodeId !== "string" || nodeId.length === 0) addFinding(invalidIdentityCode, String(nodeId));
    }
    const normalized = [...new Set(values.filter((nodeId) => typeof nodeId === "string" && nodeId.length > 0))].sort(lexical);
    for (const nodeId of normalized) if (!nodeSet.has(nodeId)) addFinding(invalidCode, nodeId);
    return normalized.filter((nodeId) => nodeSet.has(nodeId));
  };
  const rootNodeIds = normalizeDeclaredNodes(declaredRootNodeIds, "GRAPH_ROOT_NODE_UNRESOLVED", "GRAPH_ROOT_NODE_ID_INVALID");
  const terminalNodeIds = normalizeDeclaredNodes(declaredTerminalNodeIds, "GRAPH_TERMINAL_NODE_UNRESOLVED", "GRAPH_TERMINAL_NODE_ID_INVALID");
  const terminalNodeSet = new Set(terminalNodeIds);

  findings.sort((left, right) => lexical(left.code, right.code) || lexical(left.subjectId, right.subjectId));
  if (findings.length > 0) {
    return {
      disposition: "REJECTED",
      nodeIds,
      edgeIds: [...new Set(edges.map((edge) => edge.edgeId))].sort(lexical),
      rootNodeIds,
      terminalNodeIds,
      reachableNodeIds: [],
      unreachableNodeIds: nodeIds,
      traversalNodeIds: [],
      traversalEdgeIds: [],
      reachablePairs: [],
      terminalReachability: [],
      cycleComponents: [],
      cycleEdgeIds: [],
      fixedPointPasses: 0,
      findings
    };
  }

  const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, []]));
  for (const edge of edges) adjacency.get(edge.from).push(edge);
  for (const outgoing of adjacency.values()) outgoing.sort((left, right) => lexical(left.to, right.to) || lexical(left.edgeId, right.edgeId));

  const closureFrom = (startNodeId) => {
    const reached = new Set([startNodeId]);
    let frontier = [startNodeId];
    let passes = 0;
    while (frontier.length > 0) {
      const next = new Set();
      for (const nodeId of frontier.sort(lexical)) {
        for (const edge of adjacency.get(nodeId)) {
          if (!reached.has(edge.to)) {
            reached.add(edge.to);
            next.add(edge.to);
          }
        }
      }
      frontier = [...next];
      passes += 1;
    }
    return { reached: [...reached].sort(lexical), passes };
  };

  const closures = new Map(nodeIds.map((nodeId) => [nodeId, closureFrom(nodeId)]));
  const reachablePairs = nodeIds.flatMap((from) => closures.get(from).reached.map((to) => ({ from, to })));
  const reachableNodeSet = new Set(rootNodeIds.flatMap((rootNodeId) => closures.get(rootNodeId).reached));
  const reachableNodeIds = [...reachableNodeSet].sort(lexical);
  const unreachableNodeIds = nodeIds.filter((nodeId) => !reachableNodeSet.has(nodeId));

  const traversalNodeIds = [];
  const traversalEdgeIds = [];
  const traversedNodes = new Set();
  const traversedEdges = new Set();
  let frontier = [...rootNodeIds];
  while (frontier.length > 0) {
    const nodeId = frontier.shift();
    if (traversedNodes.has(nodeId)) continue;
    traversedNodes.add(nodeId);
    traversalNodeIds.push(nodeId);
    for (const edge of adjacency.get(nodeId)) {
      if (!traversedEdges.has(edge.edgeId)) {
        traversedEdges.add(edge.edgeId);
        traversalEdgeIds.push(edge.edgeId);
      }
      if (!traversedNodes.has(edge.to)) frontier.push(edge.to);
    }
    frontier.sort(lexical);
  }

  const terminalReachability = nodeIds.map((nodeId) => ({
    nodeId,
    terminalNodeIds: closures.get(nodeId).reached.filter((reachableNodeId) => terminalNodeSet.has(reachableNodeId))
  }));
  const assignedCycleNodes = new Set();
  const cycleComponents = [];
  for (const nodeId of nodeIds) {
    if (assignedCycleNodes.has(nodeId)) continue;
    const mutuallyReachable = nodeIds.filter((candidateNodeId) =>
      closures.get(nodeId).reached.includes(candidateNodeId)
      && closures.get(candidateNodeId).reached.includes(nodeId));
    const hasSelfLoop = edges.some((edge) => edge.from === nodeId && edge.to === nodeId);
    if (mutuallyReachable.length > 1 || hasSelfLoop) {
      for (const member of mutuallyReachable) assignedCycleNodes.add(member);
      cycleComponents.push(mutuallyReachable);
    }
  }
  cycleComponents.sort((left, right) => lexical(left.join("\u0000"), right.join("\u0000")));
  const cycleComponentByNode = new Map(cycleComponents.flatMap((component, index) => component.map((nodeId) => [nodeId, index])));
  const cycleEdgeIds = edges
    .filter((edge) => cycleComponentByNode.has(edge.from)
      && cycleComponentByNode.get(edge.from) === cycleComponentByNode.get(edge.to))
    .map((edge) => edge.edgeId)
    .sort(lexical);

  return {
    disposition: "CLOSED",
    nodeIds,
    edgeIds: edges.map((edge) => edge.edgeId),
    rootNodeIds,
    terminalNodeIds,
    reachableNodeIds,
    unreachableNodeIds,
    traversalNodeIds,
    traversalEdgeIds,
    reachablePairs,
    terminalReachability,
    cycleComponents,
    cycleEdgeIds,
    fixedPointPasses: Math.max(0, ...[...closures.values()].map((closure) => closure.passes)),
    findings: []
  };
}

export function evaluateExpression(expression, scope) {
  if (expression === null || typeof expression !== "object" || Array.isArray(expression)) return expression;
  const evaluate = (value, nextScope = scope) => evaluateExpression(value, nextScope);
  switch (expression.op) {
    case "literal": return structuredClone(expression.value);
    case "path": return valueAt(scope[expression.from ?? "input"], expression.path);
    case "object": return Object.fromEntries(Object.entries(expression.fields).map(([key, value]) => [key, evaluate(value)]));
    case "array": return expression.items.map((item) => evaluate(item));
    case "merge": return Object.assign({}, ...expression.values.map((value) => evaluate(value)));
    case "map": return evaluate(expression.from).map((item, index) => evaluate(expression.value, {
      ...scope, [expression.as]: item, [`${expression.as}Index`]: index
    }));
    case "flat-map": return evaluate(expression.from).flatMap((item, index) => evaluate(expression.value, {
      ...scope, [expression.as]: item, [`${expression.as}Index`]: index
    }));
    case "filter": return evaluate(expression.from).filter((item, index) => Boolean(evaluate(expression.where, {
      ...scope, [expression.as]: item, [`${expression.as}Index`]: index
    })));
    case "find": return evaluate(expression.from).find((item) => Boolean(evaluate(expression.where, { ...scope, [expression.as]: item })));
    case "some": return evaluate(expression.from).some((item) => Boolean(evaluate(expression.where, { ...scope, [expression.as]: item })));
    case "every": return evaluate(expression.from).every((item) => Boolean(evaluate(expression.where, { ...scope, [expression.as]: item })));
    case "includes": return evaluate(expression.in).includes(evaluate(expression.value));
    case "intersects": {
      const right = new Set(evaluate(expression.right));
      return evaluate(expression.left).some((value) => right.has(value));
    }
    case "equals": return evaluate(expression.left) === evaluate(expression.right);
    case "length": return evaluate(expression.value).length;
    case "greater-than": return evaluate(expression.left) > evaluate(expression.right);
    case "if": return evaluate(expression.when) ? evaluate(expression.then) : evaluate(expression.else);
    case "unique": return [...new Set(evaluate(expression.value))];
    case "object-values": {
      const value = evaluate(expression.value);
      return Object.keys(value).sort().map((key) => value[key]);
    }
    case "join": return evaluate(expression.value).join(expression.separator ?? "");
    case "format": return Object.entries(expression.values).reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(evaluate(value))),
      expression.template
    );
    case "trim": return String(evaluate(expression.value)).trim();
    case "lower-case": return String(evaluate(expression.value)).toLowerCase();
    case "escape-html": return String(evaluate(expression.value))
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    case "sha256": return crypto.createHash("sha256").update(String(evaluate(expression.value))).digest("hex");
    case "base64-decode-utf8": return Buffer.from(String(evaluate(expression.value)), "base64").toString("utf8");
    case "json-stringify": return JSON.stringify(evaluate(expression.value));
    case "canonicalize": return canonicalize(evaluate(expression.value));
    case "directed-graph-closure": return directedGraphClosure(evaluate(expression.value));
    case "parse-json": return JSON.parse(evaluate(expression.value));
    case "try-parse-json": {
      try { return { disposition: "PARSED", value: JSON.parse(evaluate(expression.value)) }; }
      catch { return { disposition: "NOT_PARSED", value: null }; }
    }
    case "let": {
      let nextScope = { ...scope };
      for (const [name, value] of Object.entries(expression.bindings)) nextScope = { ...nextScope, [name]: evaluate(value, nextScope) };
      return evaluate(expression.value, nextScope);
    }
    default: throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: transformation operation '${expression.op}'`);
  }
}
