import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { evaluateExpression } from "./semantic-transformation-evaluator.mjs";

test("the transformation authority schema admits every implemented record operation added after the original enum", () => {
  const schema = JSON.parse(fs.readFileSync(new URL(
    "../../../../kernel/schemas/semantic-transformation-authority.schema.json",
    import.meta.url
  ), "utf8"));
  const admitted = new Set(schema.$defs.expression.properties.op.enum);

  assert.deepEqual(
    ["object-values", "canonicalize", "directed-graph-closure", "try-parse-json"].filter((operation) => !admitted.has(operation)),
    []
  );
});

test("canonicalize realizes the declared recursive sorted-key semantic mechanic", () => {
  const input = {
    z: { beta: 2, alpha: 1 },
    a: [{ delta: 4, charlie: 3 }]
  };

  const outcome = evaluateExpression({
    op: "canonicalize",
    value: { op: "path", from: "input", path: "" }
  }, { input });

  assert.deepEqual(outcome, {
    a: [{ charlie: 3, delta: 4 }],
    z: { alpha: 1, beta: 2 }
  });
  assert.deepEqual(input, {
    z: { beta: 2, alpha: 1 },
    a: [{ delta: 4, charlie: 3 }]
  });
});

test("canonicalize composes with JSON serialization and SHA-256 deterministically", () => {
  const digest = (input) => evaluateExpression({
    op: "sha256",
    value: {
      op: "json-stringify",
      value: {
        op: "canonicalize",
        value: { op: "path", from: "input", path: "" }
      }
    }
  }, { input });

  assert.equal(digest({ beta: 2, alpha: 1 }), digest({ alpha: 1, beta: 2 }));
  assert.match(digest({ beta: 2, alpha: 1 }), /^[a-f0-9]{64}$/);
});

test("trim and lower-case realize admitted locale-independent query normalization", () => {
  const schema = JSON.parse(fs.readFileSync(new URL(
    "../../../../kernel/schemas/semantic-transformation-authority.schema.json",
    import.meta.url
  ), "utf8"));
  const mechanicAuthority = JSON.parse(fs.readFileSync(new URL(
    "../../../../kernel/semantic-authority/consumer/semantic-value-mechanics.authority.v1.json",
    import.meta.url
  ), "utf8"));
  const authorityPayload = Object.fromEntries(
    Object.entries(mechanicAuthority).filter(([key]) => key !== "authorityDigest")
  );
  const canonicalize = (value) => Array.isArray(value)
    ? value.map(canonicalize)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
      : value;
  const observedAuthorityDigest = `sha256:${crypto.createHash("sha256")
    .update(JSON.stringify(canonicalize(authorityPayload)))
    .digest("hex")}`;
  assert.equal(mechanicAuthority.authorityDigest, observedAuthorityDigest);
  const admittedMechanics = new Set(mechanicAuthority.mechanics.map((mechanic) => mechanic.mechanicId));
  assert.deepEqual(
    ["trim", "lower-case"].filter((operation) => !schema.$defs.expression.properties.op.enum.includes(operation)),
    []
  );
  assert.deepEqual(
    ["trim", "lower-case"].filter((operation) => !admittedMechanics.has(operation)),
    []
  );
  const outcome = evaluateExpression({
    op: "lower-case",
    value: {
      op: "trim",
      value: { op: "path", from: "input", path: "query" }
    }
  }, { input: { query: "  MIXED-Case  " } });

  assert.equal(outcome, "mixed-case");
});

test("directed graph closure derives stable reachability, terminal paths, cycles, and fixed point", () => {
  const expression = {
    op: "directed-graph-closure",
    value: { op: "path", from: "input", path: "" }
  };
  const firstInput = {
    nodeIds: ["terminal", "root", "isolated", "branch"],
    edges: [
      { edgeId: "e3", from: "branch", to: "root" },
      { edgeId: "e1", from: "root", to: "branch" },
      { edgeId: "e2", from: "branch", to: "terminal" }
    ],
    rootNodeIds: ["root"],
    terminalNodeIds: ["terminal"]
  };
  const secondInput = {
    nodeIds: ["branch", "isolated", "terminal", "root"],
    edges: [
      { edgeId: "e2", from: "branch", to: "terminal" },
      { edgeId: "e1", from: "root", to: "branch" },
      { edgeId: "e3", from: "branch", to: "root" }
    ],
    rootNodeIds: ["root"],
    terminalNodeIds: ["terminal"]
  };

  const firstOutcome = evaluateExpression(expression, { input: firstInput });
  const secondOutcome = evaluateExpression(expression, { input: secondInput });

  assert.deepEqual(firstOutcome, secondOutcome);
  assert.deepEqual(firstOutcome, {
    disposition: "CLOSED",
    nodeIds: ["branch", "isolated", "root", "terminal"],
    edgeIds: ["e1", "e2", "e3"],
    rootNodeIds: ["root"],
    terminalNodeIds: ["terminal"],
    reachableNodeIds: ["branch", "root", "terminal"],
    unreachableNodeIds: ["isolated"],
    traversalNodeIds: ["root", "branch", "terminal"],
    traversalEdgeIds: ["e1", "e3", "e2"],
    reachablePairs: [
      { from: "branch", to: "branch" },
      { from: "branch", to: "root" },
      { from: "branch", to: "terminal" },
      { from: "isolated", to: "isolated" },
      { from: "root", to: "branch" },
      { from: "root", to: "root" },
      { from: "root", to: "terminal" },
      { from: "terminal", to: "terminal" }
    ],
    terminalReachability: [
      { nodeId: "branch", terminalNodeIds: ["terminal"] },
      { nodeId: "isolated", terminalNodeIds: [] },
      { nodeId: "root", terminalNodeIds: ["terminal"] },
      { nodeId: "terminal", terminalNodeIds: ["terminal"] }
    ],
    cycleComponents: [["branch", "root"]],
    cycleEdgeIds: ["e1", "e3"],
    fixedPointPasses: 3,
    findings: []
  });
  assert.deepEqual(firstInput, {
    nodeIds: ["terminal", "root", "isolated", "branch"],
    edges: [
      { edgeId: "e3", from: "branch", to: "root" },
      { edgeId: "e1", from: "root", to: "branch" },
      { edgeId: "e2", from: "branch", to: "terminal" }
    ],
    rootNodeIds: ["root"],
    terminalNodeIds: ["terminal"]
  });
});

test("directed graph closure rejects duplicate and unresolved graph identities with exact findings", () => {
  const outcome = evaluateExpression({
    op: "directed-graph-closure",
    value: { op: "path", from: "input", path: "" }
  }, {
    input: {
      nodeIds: ["root", "root"],
      edges: [
        { edgeId: "edge", from: "root", to: "missing" },
        { edgeId: "edge", from: "unknown", to: "root" }
      ],
      rootNodeIds: ["absent-root"],
      terminalNodeIds: ["absent-terminal"]
    }
  });

  assert.equal(outcome.disposition, "REJECTED");
  assert.deepEqual(outcome.findings, [
    { code: "GRAPH_EDGE_ID_DUPLICATE", subjectId: "edge" },
    { code: "GRAPH_EDGE_SOURCE_UNRESOLVED", subjectId: "edge" },
    { code: "GRAPH_EDGE_TARGET_UNRESOLVED", subjectId: "edge" },
    { code: "GRAPH_NODE_ID_DUPLICATE", subjectId: "root" },
    { code: "GRAPH_ROOT_NODE_UNRESOLVED", subjectId: "absent-root" },
    { code: "GRAPH_TERMINAL_NODE_UNRESOLVED", subjectId: "absent-terminal" }
  ]);
  assert.deepEqual(outcome.reachableNodeIds, []);
  assert.deepEqual(outcome.unreachableNodeIds, ["root"]);
});

test("directed graph closure rejects missing carrier fields instead of fabricating an empty graph", () => {
  const outcome = evaluateExpression({
    op: "directed-graph-closure",
    value: { op: "path", from: "input", path: "" }
  }, { input: null });

  assert.equal(outcome.disposition, "REJECTED");
  assert.deepEqual(outcome.findings, [
    { code: "GRAPH_EDGES_REQUIRED", subjectId: "edges" },
    { code: "GRAPH_INPUT_INVALID", subjectId: "input" },
    { code: "GRAPH_NODE_IDS_REQUIRED", subjectId: "nodeIds" },
    { code: "GRAPH_ROOT_NODE_IDS_REQUIRED", subjectId: "rootNodeIds" },
    { code: "GRAPH_TERMINAL_NODE_IDS_REQUIRED", subjectId: "terminalNodeIds" }
  ]);
});

test("directed graph closure admits empty and self-loop boundary graphs deterministically", () => {
  const evaluateGraph = (input) => evaluateExpression({
    op: "directed-graph-closure",
    value: { op: "path", from: "input", path: "" }
  }, { input });

  assert.deepEqual(evaluateGraph({ nodeIds: [], edges: [], rootNodeIds: [], terminalNodeIds: [] }), {
    disposition: "CLOSED",
    nodeIds: [],
    edgeIds: [],
    rootNodeIds: [],
    terminalNodeIds: [],
    reachableNodeIds: [],
    unreachableNodeIds: [],
    traversalNodeIds: [],
    traversalEdgeIds: [],
    reachablePairs: [],
    terminalReachability: [],
    cycleComponents: [],
    cycleEdgeIds: [],
    fixedPointPasses: 0,
    findings: []
  });

  const selfLoop = evaluateGraph({
    nodeIds: ["only"],
    edges: [{ edgeId: "loop", from: "only", to: "only" }],
    rootNodeIds: ["only"],
    terminalNodeIds: ["only"]
  });
  assert.deepEqual(selfLoop.cycleComponents, [["only"]]);
  assert.deepEqual(selfLoop.cycleEdgeIds, ["loop"]);
  assert.deepEqual(selfLoop.reachableNodeIds, ["only"]);
  assert.deepEqual(selfLoop.terminalReachability, [{ nodeId: "only", terminalNodeIds: ["only"] }]);
});
