import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { validateCarrierSource } from "./src/validate.js";
import { validateManagedCarrierSource } from "./src/validate-managed.js";

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SOURCE_ID_PATTERN = /^(?!\/)(?![A-Za-z]:[\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+\.ts$/u;
const vendoredGrammarUrl = new URL("./schemas/semantic-carrier.schema.json", import.meta.url);
const vendoredManagedGrammarUrl = new URL("./schemas/semantic-carrier.v3.schema.json", import.meta.url);

function compareCodePoints(left, right) {
  const leftPoints = [...left].map((value) => value.codePointAt(0));
  const rightPoints = [...right].map((value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON number is not admitted.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Value is not representable as canonical JSON.");
}

export function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalJsonDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

function readBoundBytes(reference, expectedDigest, bindingUrl, findingCode) {
  if (typeof reference !== "string" || reference.length === 0 || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new Error(`${findingCode}_BINDING_INCOMPLETE`);
  }
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error(`${findingCode}_LOCAL_FILE_REQUIRED`);
  const bytes = fs.readFileSync(fileURLToPath(url));
  if (sha256(bytes) !== expectedDigest) throw new Error(`${findingCode}_DIGEST_MISMATCH`);
  return bytes;
}

function validateProviderConfiguration(configuration, bindingUrl) {
  const grammarBytes = readBoundBytes(
    configuration?.grammarAuthorityRef,
    configuration?.grammarAuthorityDigest,
    bindingUrl,
    "SEMANTIC_CARRIER_GRAMMAR_AUTHORITY",
  );
  const providerAuthorityBytes = readBoundBytes(
    configuration?.providerAuthorityRef,
    configuration?.providerAuthorityDigest,
    bindingUrl,
    "SEMANTIC_CARRIER_VALIDATOR_PROVIDER_AUTHORITY",
  );
  const vendoredGrammarBytes = fs.readFileSync(fileURLToPath(vendoredGrammarUrl));
  if (sha256(grammarBytes) !== sha256(vendoredGrammarBytes)) {
    throw new Error("SEMANTIC_CARRIER_VENDORED_GRAMMAR_DIVERGED");
  }
  const providerAuthority = JSON.parse(providerAuthorityBytes.toString("utf8"));
  if (providerAuthority.lifecycle !== "ADMITTED" ||
      providerAuthority.platformCapabilityId !== "sda-scenario-semantic-carrier-validation-port.v1") {
    throw new Error("SEMANTIC_CARRIER_VALIDATOR_PROVIDER_AUTHORITY_NOT_ADMITTED");
  }
  const managedGrammarBytes = readBoundBytes(
    providerAuthority?.managedGrammarAuthority?.grammarRef,
    providerAuthority?.managedGrammarAuthority?.grammarDigest,
    bindingUrl,
    "MANAGED_SEMANTIC_CARRIER_GRAMMAR_AUTHORITY",
  );
  const vendoredManagedGrammarBytes = fs.readFileSync(fileURLToPath(vendoredManagedGrammarUrl));
  if (sha256(managedGrammarBytes) !== sha256(vendoredManagedGrammarBytes)) {
    throw new Error("MANAGED_SEMANTIC_CARRIER_VENDORED_GRAMMAR_DIVERGED");
  }
}

function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      input.contractId !== "semantic-carrier-validation-request.v1" ||
      !input.payload || typeof input.payload !== "object" || Array.isArray(input.payload) ||
      typeof input.payload.source !== "string" || input.payload.source.length === 0 ||
      typeof input.payload.sourceId !== "string" || !SOURCE_ID_PATTERN.test(input.payload.sourceId)) {
    throw new Error("SEMANTIC_CARRIER_VALIDATION_INPUT_NOT_ADMITTED");
  }
}

export function evaluateScenarioSemanticCarrier(input) {
  validateInput(input);
  const sourceDigest = sha256(Buffer.from(input.payload.source, "utf8"));
  const managedIntent = input.payload.source.includes("scenario-semantic-carrier.v3") ||
    input.payload.source.includes("defineManagedCapability");
  const grammarVersion = managedIntent ? "scenario-semantic-carrier.v3" : "scenario-semantic-carrier.v2";
  const validation = managedIntent
    ? validateManagedCarrierSource(input.payload.source, input.payload.sourceId.replaceAll("\\", "/"))
    : validateCarrierSource(input.payload.source, input.payload.sourceId.replaceAll("\\", "/"));
  const record = validation.carrier === null
    ? {
        contractId: "semantic-carrier-validation-result.v1",
        sourceId: input.payload.sourceId.replaceAll("\\", "/"),
        sourceDigest,
        grammarVersion,
        disposition: "CARRIER_NOT_CONFORMANT",
        carrier: null,
        findings: validation.findings,
      }
    : {
        contractId: "semantic-carrier-validation-result.v1",
        sourceId: input.payload.sourceId.replaceAll("\\", "/"),
        sourceDigest,
        grammarVersion: validation.carrier.schemaVersion,
        disposition: "CONFORMANT",
        carrier: validation.carrier,
        findings: [],
      };
  return { ...record, receiptDigest: canonicalJsonDigest(record) };
}

export function invokeScenarioSemanticCarrierValidation(configuration, input, bindingUrl) {
  validateProviderConfiguration(configuration, bindingUrl);
  return evaluateScenarioSemanticCarrier(input);
}
