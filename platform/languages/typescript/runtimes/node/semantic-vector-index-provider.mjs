import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

// The reference embedding is deliberately integer-only. It produces no floating
// point coordinate, so a vector produced here can be compared for exact identity
// across providers and targets instead of by tolerance.
const REFERENCE_EMBEDDING_MODEL_ID = "sidefx-trigram-reference-embedding.v1";
const REFERENCE_ORDERING_RULE = "overlap score descending, then catalog ordinal ascending";

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
    if (!Number.isInteger(value)) throw new TypeError("SEMANTIC_VECTOR_NON_INTEGER_COORDINATE");
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

function decodeUtf8(bytes) {
  let value;
  try { value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error("SEMANTIC_VECTOR_UTF8_INVALID"); }
  if (value.startsWith("\uFEFF")) throw new Error("SEMANTIC_VECTOR_BOM_REJECTED");
  return value;
}

function readBoundAuthority(reference, expectedDigest, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0 || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new Error("SEMANTIC_VECTOR_AUTHORITY_BINDING_INCOMPLETE");
  }
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("SEMANTIC_VECTOR_AUTHORITY_LOCAL_FILE_REQUIRED");
  const bytes = fs.readFileSync(fileURLToPath(url));
  const actualDigest = sha256(bytes);
  if (actualDigest !== expectedDigest) throw new Error(`SEMANTIC_VECTOR_AUTHORITY_DIGEST_MISMATCH:${reference}`);
  const source = decodeUtf8(bytes);
  return { reference, digest: actualDigest, source, document: JSON.parse(source) };
}

function normalizedAjvMessage(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.keyword}: ${error.message ?? "schema validation failed"}`)
    .sort(compareCodePoints)
    .join("; ");
}

// Character n-grams over the exact admitted search representation. Case folding
// is applied only when the admitted parameters declare it, and the fold is the
// Unicode-default lowercase mapping of the profile, never a locale-sensitive one.
export function embedReferenceVector(text, parameters) {
  const gramSize = parameters.gramSize;
  const folded = parameters.caseFold ? String(text).toLowerCase() : String(text);
  const points = [...folded];
  const counts = new Map();
  if (points.length < gramSize) {
    // A representation shorter than one gram contributes its whole self as a
    // single coordinate rather than contributing nothing.
    if (points.length > 0) counts.set(points.join(""), 1);
  } else {
    for (let index = 0; index + gramSize <= points.length; index += 1) {
      const gram = points.slice(index, index + gramSize).join("");
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  const coordinates = {};
  for (const gram of [...counts.keys()].sort(compareCodePoints)) coordinates[gram] = counts.get(gram);
  return coordinates;
}

// Integer overlap similarity: the summed minimum count of every shared
// coordinate. No division, no square root, no floating point anywhere.
export function overlapScore(left, right) {
  let total = 0;
  for (const [gram, leftCount] of Object.entries(left)) {
    const rightCount = right[gram];
    if (rightCount === undefined) continue;
    total += leftCount < rightCount ? leftCount : rightCount;
  }
  return total;
}

function buildIndex(corpus, parameters) {
  return corpus.map((member) => ({
    catalogOrdinal: member.catalogOrdinal,
    coordinates: embedReferenceVector(member.searchRepresentation, parameters),
    semanticObjectId: member.semanticObjectId
  }));
}

function evaluateVectorRecall(input) {
  const payload = input.payload;
  const parameters = payload.embeddingParameters;
  if (payload.embeddingModelId !== REFERENCE_EMBEDDING_MODEL_ID) {
    throw new Error(`SEMANTIC_VECTOR_EMBEDDING_MODEL_NOT_ADMITTED:${payload.embeddingModelId}`);
  }

  const index = buildIndex(payload.corpus, parameters);
  const indexDigest = canonicalJsonDigest(index.map((entry) => ({
    catalogOrdinal: entry.catalogOrdinal,
    coordinates: entry.coordinates,
    semanticObjectId: entry.semanticObjectId
  })));

  const queryText = payload.queryTerms.join(" ");
  const queryVector = embedReferenceVector(queryText, parameters);
  const queryVectorDigest = canonicalJsonDigest(queryVector);

  const scored = index
    .map((entry) => ({
      catalogOrdinal: entry.catalogOrdinal,
      overlapScore: overlapScore(queryVector, entry.coordinates),
      semanticObjectId: entry.semanticObjectId
    }))
    .filter((entry) => entry.overlapScore >= payload.minimumOverlapScore);

  // The provider owns ordering. Consumers receive ordered testimony and never
  // re-rank, so no comparator is required beneath the semantic contracts.
  scored.sort((left, right) => {
    if (left.overlapScore !== right.overlapScore) return right.overlapScore - left.overlapScore;
    return left.catalogOrdinal - right.catalogOrdinal;
  });

  const truncated = scored.length > payload.limit;
  const candidates = scored.slice(0, payload.limit).map((entry, position) => ({
    catalogOrdinal: entry.catalogOrdinal,
    overlapScore: entry.overlapScore,
    rank: position,
    semanticObjectId: entry.semanticObjectId
  }));

  const subject = {
    candidates,
    catalogDigest: payload.catalogDigest,
    embeddingModelId: payload.embeddingModelId,
    embeddingParameters: {
      caseFold: parameters.caseFold,
      gramSize: parameters.gramSize
    },
    indexDigest,
    indexedMemberCount: index.length,
    integerCoordinatesOnly: true,
    minimumOverlapScore: payload.minimumOverlapScore,
    orderingRule: REFERENCE_ORDERING_RULE,
    queryVectorDigest,
    recordType: "semantic-vector-index-record.v1",
    snapshotDigest: payload.snapshotDigest,
    truncated
  };
  return { ...subject, recordDigest: canonicalJsonDigest(subject) };
}

export function invokeSemanticVectorIndex(configuration, input, contextOrBindingUrl, bindingUrl) {
  const authorityBaseUrl = bindingUrl ?? contextOrBindingUrl;
  const requiredBindings = [
    ["inputContractRef", "inputContractDigest"],
    ["recordContractRef", "recordContractDigest"],
    ["providerAuthorityRef", "providerAuthorityDigest"]
  ];
  const authorities = Object.fromEntries(requiredBindings.map(([referenceKey, digestKey]) =>
    [referenceKey, readBoundAuthority(configuration?.[referenceKey], configuration?.[digestKey], authorityBaseUrl)]));

  const inputAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const inputValidator = inputAjv.compile(authorities.inputContractRef.document);
  const recordAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const recordValidator = recordAjv.compile(authorities.recordContractRef.document);

  if (!inputValidator(input)) {
    throw new Error(`SEMANTIC_VECTOR_INDEX_INPUT_SCHEMA_REJECTED:${normalizedAjvMessage(inputValidator.errors)}`);
  }
  const record = evaluateVectorRecall(input);
  if (!recordValidator(record)) {
    throw new Error(`SEMANTIC_VECTOR_INDEX_RECORD_SCHEMA_REJECTED:${normalizedAjvMessage(recordValidator.errors)}`);
  }
  return record;
}
