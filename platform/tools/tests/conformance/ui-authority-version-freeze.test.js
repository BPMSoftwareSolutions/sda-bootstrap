"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FREEZE_PATH = path.join(REPO_ROOT, "governance", "ui", "consumer-ui-authority-v1.freeze.json");
const V2_FREEZE_PATH = path.join(REPO_ROOT, "governance", "ui", "sda-ui-presentation-ir-v2.freeze.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalDigest(value) {
  const content = JSON.stringify(canonicalize(value));
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

test("consumer-ui-authority.v1 remains frozen at the ADR-0007 schema digest", () => {
  const freeze = readJson(FREEZE_PATH);
  assert.deepEqual(Object.keys(freeze), [
    "freezeType",
    "status",
    "authorityType",
    "schemaRef",
    "schemaId",
    "canonicalization",
    "schemaDigest",
    "decisionRef",
    "violationCode"
  ]);
  assert.equal(freeze.freezeType, "sda-ui-authority-schema-freeze.v1");
  assert.equal(freeze.status, "FROZEN");
  assert.equal(freeze.authorityType, "consumer-ui-authority.v1");
  assert.equal(freeze.canonicalization, "recursive-key-order.v1");
  assert.equal(freeze.violationCode, "UI_PROTOCOL_V1_MUTATION");

  const governance = readJson(path.join(REPO_ROOT, "governance", "workspace", "governance-rules.json"));
  assert.deepEqual(governance.rules.find((rule) => rule.id === "K023"), {
    id: "K023",
    name: "Consumer UI authority v1 freeze",
    description: "consumer-ui-authority.v1 must match its governed canonical schema digest. New presentation or interaction semantics require a separately versioned UI presentation protocol; an unapproved v1 mutation yields UI_PROTOCOL_V1_MUTATION.",
    enabled: true,
    enforcement: "hard"
  });

  const decisionPath = path.join(REPO_ROOT, freeze.decisionRef);
  assert.ok(fs.existsSync(decisionPath), `Freeze decision is missing: ${freeze.decisionRef}`);
  assert.match(fs.readFileSync(decisionPath, "utf8"), /\*\*Status:\*\* Accepted/u);

  const schemaPath = path.join(REPO_ROOT, freeze.schemaRef);
  const schema = readJson(schemaPath);
  assert.equal(schema.$id, freeze.schemaId);
  assert.equal(schema.properties?.uiAuthorityType?.const, freeze.authorityType);

  const observedDigest = canonicalDigest(schema);
  assert.equal(
    observedDigest,
    freeze.schemaDigest,
    `${freeze.violationCode}: ${freeze.schemaRef} expected ${freeze.schemaDigest} but observed ${observedDigest}. ` +
      "Do not extend v1; introduce the separately versioned UI presentation protocol required by ADR-0007."
  );
});

test("sda-ui-presentation-ir.v2 remains frozen while the semantic successor evolves separately", () => {
  const freeze = readJson(V2_FREEZE_PATH);
  assert.deepEqual(Object.keys(freeze), [
    "freezeType",
    "status",
    "contractType",
    "schemaRef",
    "schemaId",
    "canonicalization",
    "schemaDigest",
    "protocolIdentityRef",
    "decisionRef",
    "violationCode"
  ]);
  assert.equal(freeze.freezeType, "sda-ui-presentation-contract-freeze.v1");
  assert.equal(freeze.status, "FROZEN");
  assert.equal(freeze.contractType, "sda-ui-presentation-ir.v2");
  assert.equal(freeze.canonicalization, "recursive-key-order.v1");
  assert.equal(freeze.violationCode, "UI_PRESENTATION_IR_V2_MUTATION");

  const governance = readJson(path.join(REPO_ROOT, "governance", "workspace", "governance-rules.json"));
  assert.deepEqual(governance.rules.find((rule) => rule.id === "K028"), {
    id: "K028",
    name: "UI presentation IR v2 freeze",
    description: "sda-ui-presentation-ir.v2 must match its governed canonical schema digest. Successor semantic-presentation or normalized-mechanic concepts require separately identified contracts; an unapproved v2 mutation yields UI_PRESENTATION_IR_V2_MUTATION.",
    enabled: true,
    enforcement: "hard"
  });

  const schema = readJson(path.join(REPO_ROOT, freeze.schemaRef));
  assert.equal(schema.$id, freeze.schemaId);
  assert.equal(schema.properties?.presentationIrType?.const, freeze.contractType);
  assert.equal(canonicalDigest(schema), freeze.schemaDigest);

  const identity = readJson(path.join(REPO_ROOT, freeze.protocolIdentityRef));
  assert.equal(identity.protocolType, freeze.contractType);
  assert.equal(identity.schemaRef, freeze.schemaRef);
  assert.equal(identity.schemaDigest, freeze.schemaDigest);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, freeze.decisionRef)));
});
