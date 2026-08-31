import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { canonicalDigest } from "../../../languages/typescript/runtimes/node/native-mechanic-primitives.mjs";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const repositoryRoot = new URL("../../../", import.meta.url);
const effectAuthorityRef = "kernel/semantic-authority/consumer/platform-effect-mechanics.authority.v1.json";
const registryRef = "kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json";
const receiptRef = "capabilities/sda-platform/verify-os-environment-credential-conformance/conformance/os-environment-credential-conformance.v1.json";
const receiptSchemaRef = "capabilities/sda-platform/verify-os-environment-credential-conformance/conformance/os-environment-credential-conformance.v1.schema.json";

const readJson = (reference) => JSON.parse(fs.readFileSync(new URL(reference, repositoryRoot), "utf8"));
const fileBytes = (reference) => fs.readFileSync(new URL(reference, repositoryRoot));
const fileDigest = (reference) => `sha256:${crypto.createHash("sha256").update(fileBytes(reference)).digest("hex")}`;
const withoutProperty = (document, property) =>
  Object.fromEntries(Object.entries(document).filter(([key]) => key !== property));

test("the OS environment credential mechanic is declared in the admitted effect family", () => {
  const authority = readJson(effectAuthorityRef);
  assert.equal(authority.lifecycle, "ADMITTED");
  const mechanic = authority.mechanics.find((entry) => entry.mechanicId === "read-os-environment-credential");
  assert.ok(mechanic, "mechanic missing from effect family");
  assert.equal(mechanic.effectClassification, "observation");
  assert.equal(mechanic.determinism, "testimony-governed");
  assert.ok(mechanic.inputContractId.length > 0 && mechanic.outcomeContractId.length > 0);
  assert.ok(mechanic.conformanceRefs.length > 0);
  assert.equal(mechanic.nativeFloor, true);
  assert.match(mechanic.meaning, /process environment, then operating-system user scope, then operating-system machine scope/);
  assert.match(mechanic.meaning, /without disclosure/);
});

test("the mechanic family and registry contain no credential material", () => {
  const authorityText = fileBytes(effectAuthorityRef).toString("utf8");
  const registryText = fileBytes(registryRef).toString("utf8");
  const receiptText = fileBytes(receiptRef).toString("utf8");
  for (const text of [authorityText, registryText, receiptText]) {
    assert.ok(!text.includes("LOC_GEMINI_API_KEY"), "credential reference name leaked into authority");
    assert.ok(!text.includes("AIza"), "credential material leaked into authority");
  }
});

test("the node registry pins the current effect family digest", () => {
  const registry = readJson(registryRef);
  const authority = readJson(effectAuthorityRef);
  assert.equal(authority.authorityDigest, canonicalDigest(withoutProperty(authority, "authorityDigest")));
  const effectProfile = registry.graphProviderProfiles.find((profile) => profile.effectClassification === "effect");
  assert.equal(effectProfile.mechanicAuthorityDigest, authority.authorityDigest);
  assert.equal(effectProfile.mechanicAuthorityRef, effectAuthorityRef);
});

test("the conformance receipt recomputes and records the held lowering honestly", () => {
  const receipt = readJson(receiptRef);
  assert.equal(receipt.conformanceType, "os-environment-credential-conformance.v1");
  assert.equal(receipt.lifecycle, "ADMITTED");
  assert.equal(
    receipt.receiptDigest,
    canonicalDigest(withoutProperty(withoutProperty(receipt, "receiptDigest"), "receiptDigestAlgorithm"))
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  assert.ok(ajv.compile(readJson(receiptSchemaRef))(receipt), JSON.stringify(ajv.errors));
  assert.equal(receipt.registryBinding.registryDigest, fileDigest(registryRef));
  const partitions = Object.fromEntries(receipt.partitions.map((partition) => [partition.partitionId, partition.disposition]));
  assert.equal(partitions.MECHANIC_DECLARED_IN_EFFECT_FAMILY, "SATISFIED");
  assert.equal(partitions.RESOLUTION_ORDER_FIXED_BY_MEANING, "SATISFIED");
  assert.equal(partitions.NON_DISCLOSURE_CONTRACT, "SATISFIED");
  assert.equal(partitions.REGISTRY_PINS_FAMILY_DIGEST, "SATISFIED");
  assert.equal(partitions.LOWERING_ADMITTED, "SATISFIED");
  assert.equal(partitions.RECEIPT_SELF_DIGEST_REPRODUCES, "SATISFIED");
  assert.equal(receipt.disposition, "SDA_OS_ENVIRONMENT_CREDENTIAL_CONFORMANT");
  assert.deepEqual(receipt.findings, []);
});
