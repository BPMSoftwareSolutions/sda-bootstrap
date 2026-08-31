"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const RESOLVER_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "resolve-declared-ui-presentation");
const COMPILER_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "compile-semantic-presentation");
const PROTOCOL_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "ui-presentation-protocol");

function json(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function subject() {
  const resolver = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const compiler = await import("../../../artifacts/tools/dist/ui-presentation/application/semantic-presentation-compiler.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  return {
    ...resolver,
    ...compiler,
    authority: json(path.join(COMPILER_ROOT, "compile-semantic-presentation.authority.json")),
    compilerAdmission: new AjvSchemaAdmission(path.join(COMPILER_ROOT, "contracts")),
    protocolAdmission: new AjvSchemaAdmission(path.join(PROTOCOL_ROOT, "contracts"))
  };
}

function declaredFixture(name) {
  return json(path.join(RESOLVER_ROOT, "fixtures", `${name}.declared-ui-authority.json`));
}

function findingCodes(result) {
  return result.evidence.findings.map((finding) => finding.code);
}

test("the compiler authority and evidence contracts are closed and target-neutral", async () => {
  const { authority, compilerAdmission, compilerAuthorityDigest } = await subject();
  assert.deepEqual(compilerAdmission.unresolvedSchemaFiles(), []);
  assert.equal(compilerAdmission.validate(authority, "compile-semantic-presentation.authority.schema.json").valid, true);
  assert.equal(compilerAuthorityDigest(authority), authority.authorityDigest);
  const invalidSuccess = json(path.join(COMPILER_ROOT, "fixtures", "empty.semantic-presentation-compilation-evidence.v1.json"));
  invalidSuccess.findings = [{ code: "CYCLIC_PRESENTATION_ORDER", subjectRef: "presentation.invalid" }];
  assert.equal(compilerAdmission.validate(invalidSuccess, "semantic-presentation-compilation-evidence.v1.schema.json").valid, false);
  const invalidRejection = structuredClone(invalidSuccess);
  invalidRejection.disposition = "REJECTED";
  assert.equal(compilerAdmission.validate(invalidRejection, "semantic-presentation-compilation-evidence.v1.schema.json").valid, false);
  const implementation = fs.readFileSync(path.join(REPOSITORY_ROOT, "tools", "src", "ui-presentation", "application", "semantic-presentation-compiler.ts"), "utf8");
  assert.doesNotMatch(implementation, /\b(?:react|wpf|xaml|css|html|javafx|swiftui|compose|appkit|winui|avalonia|qt|fyne|provider-registry)\b/iu);
});

test("empty semantic authority compiles to the canonical empty v3 graph", async () => {
  const { authority, compileSemanticPresentation, presentationIrV3Digest, resolveDeclaredUiPresentation, compilerAdmission, protocolAdmission } = await subject();
  const presentation = resolveDeclaredUiPresentation(declaredFixture("empty")).presentation;
  const first = compileSemanticPresentation(presentation, authority);
  const second = compileSemanticPresentation(presentation, authority);
  assert.deepEqual(second, first);
  assert.equal(first.evidence.disposition, "COMPILED");
  assert.deepEqual(first.ir.rootNodeIds, []);
  assert.deepEqual(first.ir.nodes, []);
  assert.deepEqual(first.ir.presentationProfileRefs, []);
  assert.equal(first.ir.canonicalDigest, presentationIrV3Digest(first.ir));
  assert.equal(protocolAdmission.validate(first.ir, "sda-ui-presentation-ir.v3.schema.json").valid, true);
  assert.equal(compilerAdmission.validate(first.evidence, "semantic-presentation-compilation-evidence.v1.schema.json").valid, true);
  assert.deepEqual(first.ir, json(path.join(PROTOCOL_ROOT, "fixtures", "v3-compiled", "empty.sda-ui-presentation-ir.v3.json")));
  assert.deepEqual(first.evidence, json(path.join(COMPILER_ROOT, "fixtures", "empty.semantic-presentation-compilation-evidence.v1.json")));
});

test("minimal semantic authority lowers only declared order, events, adaptation, accessibility, and profile indirection", async () => {
  const { authority, compileSemanticPresentation, resolveDeclaredUiPresentation, protocolAdmission, compilerAdmission } = await subject();
  const declared = declaredFixture("minimal");
  const presentation = resolveDeclaredUiPresentation(declared).presentation;
  const result = compileSemanticPresentation(presentation, authority);
  assert.equal(result.evidence.disposition, "COMPILED");
  assert.deepEqual(result.ir.rootNodeIds, ["node.root"]);
  assert.deepEqual(result.ir.nodes[0].semanticElementRefs, [
    "action.resolve",
    "feedback.resolution-status",
    "information.result"
  ]);
  assert.deepEqual(result.ir.nodes[0].semanticRelationshipRefs, ["relationship.action-before-feedback"]);
  assert.deepEqual(result.ir.nodes[0].accessibilityObligationRefs, [
    "accessibility.resolve-operable",
    "accessibility.result-name",
    "accessibility.status-live"
  ]);
  assert.deepEqual(result.ir.eventBindings, [{
    bindingId: "binding.action.resolve.0",
    semanticElementRef: "action.resolve",
    semanticEventRef: "event.resolve",
    trigger: "ACTIVATE"
  }]);
  assert.deepEqual(result.ir.accessibilityObligations.map((item) => item.kind), [
    "OPERABLE_ACTION",
    "NAME",
    "LIVE_FEEDBACK"
  ]);
  assert.deepEqual(result.ir.adaptationRules[0].operations, [
    { kind: "GROUPING", nodeRefs: ["node.root"] },
    { kind: "ORDER", nodeRefs: ["node.root"] }
  ]);
  assert.deepEqual(result.ir.presentationProfileRefs, []);
  assert.deepEqual(result.ir.tokenReferences, []);
  assert.equal(protocolAdmission.validate(result.ir, "sda-ui-presentation-ir.v3.schema.json").valid, true);
  assert.equal(compilerAdmission.validate(result.evidence, "semantic-presentation-compilation-evidence.v1.schema.json").valid, true);
  assert.deepEqual(result.ir, json(path.join(PROTOCOL_ROOT, "fixtures", "v3-compiled", "minimal.sda-ui-presentation-ir.v3.json")));
  assert.deepEqual(result.evidence, json(path.join(COMPILER_ROOT, "fixtures", "minimal.semantic-presentation-compilation-evidence.v1.json")));

  const reordered = structuredClone(declared);
  reordered.elements.reverse();
  reordered.relationships.reverse();
  reordered.adaptationIntents.reverse();
  const reorderedPresentation = resolveDeclaredUiPresentation(reordered).presentation;
  assert.deepEqual(compileSemanticPresentation(reorderedPresentation, authority), result);

  const profiled = structuredClone(presentation);
  profiled.presentationProfileRefs = ["profile.accessible-default"];
  profiled.canonicalDigest = (await subject()).semanticPresentationDigest(profiled);
  const profiledResult = compileSemanticPresentation(profiled, authority);
  assert.deepEqual(profiledResult.ir.presentationProfileRefs, ["profile.accessible-default"]);
  assert.deepEqual(profiledResult.ir.tokenReferences, []);
});

test("semantic-to-IR ambiguity and authority mutations return stable rejection evidence", async () => {
  const api = await subject();
  const baseline = api.resolveDeclaredUiPresentation(declaredFixture("minimal")).presentation;

  function mutatedPresentation(change) {
    const candidate = structuredClone(baseline);
    change(candidate);
    candidate.canonicalDigest = api.semanticPresentationDigest(candidate);
    return candidate;
  }

  const cases = [
    ["SEMANTIC_PRESENTATION_DIGEST_MISMATCH", () => {
      const candidate = structuredClone(baseline);
      candidate.elements[0].semanticRole = "SUPPORTING";
      return api.compileSemanticPresentation(candidate, api.authority);
    }],
    ["COMPILER_AUTHORITY_DIGEST_MISMATCH", () => {
      const candidate = structuredClone(api.authority);
      candidate.defaultComposition.axis = "INLINE";
      return api.compileSemanticPresentation(baseline, candidate);
    }],
    ["UNKNOWN_RELATIONSHIP_ENDPOINT", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.relationships[0].targetElementId = "feedback.unknown";
    }), api.authority)],
    ["UNRESOLVABLE_COMPOSITION_RELATIONSHIP", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.relationships[0].kind = "RELATED_TO";
    }), api.authority)],
    ["CYCLIC_PRESENTATION_ORDER", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.relationships.push({
        ...structuredClone(candidate.relationships[0]),
        relationshipId: "relationship.feedback-before-action",
        sourceElementId: "feedback.resolution-status",
        targetElementId: "action.resolve"
      });
    }), api.authority)],
    ["MISSING_SEMANTIC_EVENT_BINDING", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.elements.find((element) => element.elementId === "action.resolve").eventRefs = [];
    }), api.authority)],
    ["UNSUPPORTED_ADAPTATION_INTENT", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.adaptationIntents[0].allowedChangeKinds = ["DENSITY"];
    }), api.authority)],
    ["UNKNOWN_ADAPTATION_INVARIANT", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.adaptationIntents[0].invariantRefs = ["experience.unknown"];
    }), api.authority)],
    ["UNSUPPORTED_ACCESSIBILITY_OBLIGATION", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.elements[0].accessibilityObligations[0].kind = "TARGET_HINT";
    }), api.authority)],
    ["DUPLICATE_PRESENTATION_PROFILE_REF", () => api.compileSemanticPresentation(mutatedPresentation((candidate) => {
      candidate.presentationProfileRefs = ["profile.one", "profile.one"];
    }), api.authority)]
  ];

  for (const [expected, execute] of cases) {
    const result = execute();
    assert.equal(result.evidence.disposition, "REJECTED", expected);
    assert.equal(result.evidence.presentationIrDigest, null, expected);
    assert.ok(findingCodes(result).includes(expected), expected);
    assert.equal(api.compilerAdmission.validate(result.evidence, "semantic-presentation-compilation-evidence.v1.schema.json").valid, true, expected);
  }
});
