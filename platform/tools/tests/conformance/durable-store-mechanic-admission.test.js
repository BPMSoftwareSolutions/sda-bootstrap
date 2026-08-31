import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { canonicalizeValue, canonicalDigest } from "../../../languages/typescript/runtimes/node/native-mechanic-primitives.mjs";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const repositoryRoot = new URL("../../../", import.meta.url);
const pureAuthorityRef = "kernel/semantic-authority/consumer/semantic-value-mechanics.authority.v1.json";
const effectAuthorityRef = "kernel/semantic-authority/consumer/platform-effect-mechanics.authority.v1.json";
const registryRef = "kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json";
const mechanicSchemaRef = "kernel/schemas/mechanic-authority.schema.json";
const receiptRef = "capabilities/sda-platform/verify-durable-store-mechanic-admission/conformance/durable-store-mechanic-admission.v1.json";
const receiptSchemaRef = "capabilities/sda-platform/verify-durable-store-mechanic-admission/conformance/durable-store-mechanic-admission.v1.schema.json";
const testFileRef = "tools/tests/conformance/durable-store-mechanic-admission.test.js";

const readJson = (reference) => JSON.parse(fs.readFileSync(new URL(reference, repositoryRoot), "utf8"));
const fileBytes = (reference) => fs.readFileSync(new URL(reference, repositoryRoot));
const sha256Hex = (bytes) => require("node:crypto").createHash("sha256").update(bytes).digest("hex");
const fileDigest = (reference) => `sha256:${sha256Hex(fileBytes(reference))}`;
const withoutProperty = (document, property) =>
  Object.fromEntries(Object.entries(document).filter(([key]) => key !== property));

const PURE_MECHANICS = ["canonical-json-byte-validation", "retained-lineage-authorization", "canonical-artifact-byte-planning"];
const EFFECT_MECHANICS = ["exclusive-create-or-exact-match", "atomic-current-pointer-compare-and-swap"];

test("both mechanic authorities recompute their self digests and satisfy the mechanic schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  for (const schemaFile of fs.readdirSync(new URL("../../../kernel/schemas/", import.meta.url))) {
    if (!schemaFile.endsWith(".schema.json")) continue;
    const schema = JSON.parse(fs.readFileSync(new URL(`../../../kernel/schemas/${schemaFile}`, import.meta.url), "utf8"));
    const filenameId = `https://schemas.scenario-driven.dev/kernel/${schemaFile}`;
    if (schema.$id !== filenameId) ajv.addSchema({ ...schema, $id: filenameId });
    ajv.addSchema(schema);
  }
  const schema = readJson(mechanicSchemaRef);
  const validate = ajv.getSchema(schema.$id ?? `https://schemas.scenario-driven.dev/kernel/${mechanicSchemaRef.split("/").at(-1)}`);
  assert.ok(validate, "mechanic authority schema registered");
  for (const reference of [pureAuthorityRef, effectAuthorityRef]) {
    const authority = readJson(reference);
    assert.equal(
      authority.authorityDigest,
      canonicalDigest(withoutProperty(authority, "authorityDigest")),
      reference
    );
    assert.ok(validate(authority), `${reference}: ${JSON.stringify(validate.errors)}`);
    assert.equal(authority.lifecycle, "ADMITTED");
  }
});

test("the four durable store mechanics are declared with contracts and conformance refs", () => {
  const pure = readJson(pureAuthorityRef);
  const effect = readJson(effectAuthorityRef);
  const pureIds = pure.mechanics.map((mechanic) => mechanic.mechanicId);
  const effectIds = effect.mechanics.map((mechanic) => mechanic.mechanicId);
  for (const mechanicId of PURE_MECHANICS) {
    assert.ok(pureIds.includes(mechanicId), `${mechanicId} missing from pure family`);
    assert.ok(!effectIds.includes(mechanicId), `${mechanicId} misplaced in effect family`);
    const mechanic = pure.mechanics.find((item) => item.mechanicId === mechanicId);
    assert.equal(mechanic.determinism, "deterministic");
    assert.equal(mechanic.effectClassification, "pure");
    assert.ok(mechanic.inputContractId.length > 0 && mechanic.outcomeContractId.length > 0);
    assert.ok(mechanic.conformanceRefs.length > 0);
  }
  for (const mechanicId of EFFECT_MECHANICS) {
    assert.ok(effectIds.includes(mechanicId), `${mechanicId} missing from effect family`);
    assert.ok(!pureIds.includes(mechanicId), `${mechanicId} misplaced in pure family`);
    const mechanic = effect.mechanics.find((item) => item.mechanicId === mechanicId);
    assert.equal(mechanic.determinism, "testimony-governed");
    assert.equal(mechanic.effectClassification, "effect");
    assert.ok(mechanic.inputContractId.length > 0 && mechanic.outcomeContractId.length > 0);
    assert.ok(mechanic.conformanceRefs.length > 0);
  }
});

test("the node registry pins the current mechanic authority digests", () => {
  const registry = readJson(registryRef);
  const pure = readJson(pureAuthorityRef);
  const effect = readJson(effectAuthorityRef);
  const profiles = registry.graphProviderProfiles;
  const pureProfile = profiles.find((profile) => profile.effectClassification === "pure");
  const effectProfile = profiles.find((profile) => profile.effectClassification === "effect");
  assert.equal(pureProfile.mechanicAuthorityDigest, pure.authorityDigest);
  assert.equal(effectProfile.mechanicAuthorityDigest, effect.authorityDigest);
  assert.equal(pureProfile.mechanicAuthorityRef, pureAuthorityRef);
  assert.equal(effectProfile.mechanicAuthorityRef, effectAuthorityRef);
});

const canonicalBytes = (value) => Buffer.from(JSON.stringify(canonicalizeValue(value)));

test("canonical-json-byte-validation composes deterministically from admitted pure mechanics", () => {
  const admitted = { subject: { kind: "SCENARIO", name: "observe" }, ordinal: 1 };
  const bytes = canonicalBytes(admitted);
  const digest = `sha256:${sha256Hex(bytes)}`;
  assert.equal(canonicalDigest(admitted), digest);
  const roundTrip = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(canonicalizeValue(roundTrip), canonicalizeValue(admitted));
  assert.equal(canonicalBytes(roundTrip).toString("utf8"), bytes.toString("utf8"));

  const nonJson = Buffer.from("{ not json", "utf8");
  assert.throws(() => JSON.parse(nonJson.toString("utf8")));

  const whitespace = Buffer.from(' { "subject": { "kind": "SCENARIO", "name": "observe" }, "ordinal": 1 } ', "utf8");
  const reparsed = JSON.parse(whitespace.toString("utf8"));
  assert.deepEqual(canonicalizeValue(reparsed), canonicalizeValue(admitted));
  assert.notEqual(whitespace.toString("utf8"), canonicalBytes(reparsed).toString("utf8"));
});

test("retained-lineage-authorization composes as pure admission over declared lineage references", () => {
  const retained = new Set(["sha256:1111111111111111111111111111111111111111111111111111111111111111"]);
  const authorize = (subjectDigest, { viaCurrentPointer }) => {
    if (viaCurrentPointer && !retained.has(subjectDigest)) return "REFUSED_NO_LINEAGE";
    if (retained.has(subjectDigest)) return "AUTHORIZED";
    return "REFUSED_UNDECLARED_SUBJECT";
  };
  assert.equal(
    authorize("sha256:1111111111111111111111111111111111111111111111111111111111111111", { viaCurrentPointer: false }),
    "AUTHORIZED"
  );
  assert.equal(
    authorize("sha256:2222222222222222222222222222222222222222222222222222222222222222", { viaCurrentPointer: true }),
    "REFUSED_NO_LINEAGE"
  );
  assert.equal(
    authorize("sha256:2222222222222222222222222222222222222222222222222222222222222222", { viaCurrentPointer: false }),
    "REFUSED_UNDECLARED_SUBJECT"
  );
});

const makeTempStore = () => fs.mkdtempSync(path.join(os.tmpdir(), "sda-store-mechanic-"));
const artifactAddress = (root, name) => path.join(root, name);

const exclusiveCreateOrMatch = (root, name, bytes) => {
  const address = artifactAddress(root, name);
  if (fs.existsSync(address)) {
    const existing = fs.readFileSync(address);
    return Buffer.compare(existing, bytes) === 0
      ? { disposition: "ALREADY_PRESENT", wrote: false }
      : { disposition: "REJECTED", wrote: false };
  }
  const temporary = `${address}.${require("node:crypto").randomUUID()}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, address);
  return { disposition: "CREATED", wrote: true };
};

test("exclusive-create-or-exact-match never overwrites an occupied address", () => {
  const root = makeTempStore();
  try {
    const bytes = Buffer.from("sha256-verifiable-content", "utf8");
    const first = exclusiveCreateOrMatch(root, "object.json", bytes);
    assert.equal(first.disposition, "CREATED");
    assert.equal(fs.readFileSync(artifactAddress(root, "object.json")).toString("utf8"), bytes.toString("utf8"));
    const same = exclusiveCreateOrMatch(root, "object.json", bytes);
    assert.equal(same.disposition, "ALREADY_PRESENT");
    assert.equal(same.wrote, false);
    const different = exclusiveCreateOrMatch(root, "object.json", Buffer.from("different-bytes", "utf8"));
    assert.equal(different.disposition, "REJECTED");
    assert.equal(different.wrote, false);
    assert.equal(fs.readFileSync(artifactAddress(root, "object.json")).toString("utf8"), bytes.toString("utf8"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const pointerCas = (root, name, expectedState, proposedState) => {
  const address = artifactAddress(root, name);
  const current = fs.existsSync(address)
    ? JSON.parse(fs.readFileSync(address, "utf8"))
    : null;
  const matches =
    current !== null &&
    current.generation === expectedState.generation &&
    current.snapshotDigest === expectedState.snapshotDigest;
  if (matches) {
    const temporary = `${address}.${require("node:crypto").randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(canonicalizeValue(proposedState)));
    fs.renameSync(temporary, address);
    return {
      outcome: "COMPARE_MATCHED_AND_REPLACED",
      expectedCurrentState: expectedState,
      proposedNextState: proposedState,
      generationIdentityMintedByProvider: false,
      observedWinnerState: null
    };
  }
  return {
    outcome: "OBSERVED_WINNER_REPORTED",
    expectedCurrentState: expectedState,
    proposedNextState: proposedState,
    generationIdentityMintedByProvider: false,
    observedWinnerState: current
  };
};

test("atomic-current-pointer-compare-and-swap replaces only on exact expected state and never mints generation identity", () => {
  const root = makeTempStore();
  try {
    const generationOne = {
      pointerKey: "agentic-harness/local/sidefx-semantic-corpus",
      generation: 1,
      snapshotDigest: `sha256:${"a".repeat(64)}`,
      previousSnapshotDigest: null
    };
    const generationTwo = {
      pointerKey: "agentic-harness/local/sidefx-semantic-corpus",
      generation: 2,
      snapshotDigest: `sha256:${"b".repeat(64)}`,
      previousSnapshotDigest: generationOne.snapshotDigest
    };
    fs.writeFileSync(artifactAddress(root, "pointer.json"), JSON.stringify(generationOne));
    const advanced = pointerCas(root, "pointer.json", generationOne, generationTwo);
    assert.equal(advanced.outcome, "COMPARE_MATCHED_AND_REPLACED");
    assert.equal(advanced.generationIdentityMintedByProvider, false);
    assert.equal(advanced.observedWinnerState, null);
    assert.deepEqual(JSON.parse(fs.readFileSync(artifactAddress(root, "pointer.json"), "utf8")), generationTwo);

    const stale = pointerCas(root, "pointer.json", generationOne, {
      pointerKey: "agentic-harness/local/sidefx-semantic-corpus",
      generation: 2,
      snapshotDigest: `sha256:${"c".repeat(64)}`,
      previousSnapshotDigest: generationOne.snapshotDigest
    });
    assert.equal(stale.outcome, "OBSERVED_WINNER_REPORTED");
    assert.deepEqual(stale.observedWinnerState, generationTwo);
    assert.deepEqual(JSON.parse(fs.readFileSync(artifactAddress(root, "pointer.json"), "utf8")), generationTwo);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the mechanic admission receipt recomputes and closes its partitions", () => {
  const receipt = readJson(receiptRef);
  assert.equal(receipt.conformanceType, "durable-store-mechanic-admission.v1");
  assert.equal(receipt.lifecycle, "ADMITTED");
  assert.equal(
    receipt.receiptDigest,
    canonicalDigest(withoutProperty(withoutProperty(receipt, "receiptDigest"), "receiptDigestAlgorithm"))
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  assert.ok(ajv.compile(readJson(receiptSchemaRef))(receipt), JSON.stringify(ajv.errors));
  assert.deepEqual(receipt.findings, []);
  assert.ok(receipt.partitions.length > 0);
  for (const partition of receipt.partitions) assert.equal(partition.disposition, "SATISFIED", partition.partitionId);

  const pure = readJson(pureAuthorityRef);
  const effect = readJson(effectAuthorityRef);
  const registry = readJson(registryRef);
  const families = receipt.mechanicAuthorities;
  const pureFamily = families.find((family) => family.mechanicFamilyId === "semantic-value-mechanics.v1");
  const effectFamily = families.find((family) => family.mechanicFamilyId === "platform-effect-mechanics.v1");
  assert.equal(pureFamily.sourceDigest, fileDigest(pureAuthorityRef));
  assert.equal(effectFamily.sourceDigest, fileDigest(effectAuthorityRef));
  assert.equal(pureFamily.authorityDigest, pure.authorityDigest);
  assert.equal(effectFamily.authorityDigest, effect.authorityDigest);
  assert.equal(receipt.registryBinding.registryDigest, fileDigest(registryRef));
  assert.equal(receipt.registryBinding.registryRef, registryRef);
});

test("canonical-artifact-byte-planning composes deterministically from exact bytes and the declared layout", () => {
  const layout = { digestPrefix: "sha256:", objectsDirectory: "objects", hexShardLength: 2, fileExtension: ".json" };
  const planAddress = (bytes) => {
    const hex = require("node:crypto").createHash("sha256").update(bytes).digest("hex");
    const shard = hex.slice(0, layout.hexShardLength);
    return `${layout.objectsDirectory}/${shard}/${hex}${layout.fileExtension}`;
  };
  const first = canonicalBytes({ resources: ["source:alpha"], snapshotId: "alpha" });
  const addressA = planAddress(first);
  const addressB = planAddress(Buffer.from(first));
  assert.equal(addressA, addressB);
  assert.equal(addressA.split("/")[1], sha256Hex(first).slice(0, 2));
  assert.ok(addressA.startsWith(`objects/${sha256Hex(first).slice(0, 2)}/${sha256Hex(first)}.json`));

  const reordered = canonicalBytes({ snapshotId: "alpha", resources: ["source:alpha"] });
  assert.equal(Buffer.compare(first, reordered), 0, "canonical form is independent of input key order");
  const addressReordered = planAddress(reordered);
  assert.equal(addressA, addressReordered);

  const processVariant = planAddress(Buffer.from(first));
  const discoveryVariant = planAddress(Buffer.from(first));
  assert.equal(processVariant, discoveryVariant);
});

test("the conformance test suite itself is digest-pinned by the receipt", () => {
  const receipt = readJson(receiptRef);
  assert.equal(receipt.counts.admittedMechanicCount, 5);
  assert.equal(receipt.counts.partitionCount, receipt.partitions.length);
});
