import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CANONICAL_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const SOURCE_CLASSES = new Set([
  "CANONICAL_AUTHORITY",
  "ADMITTED_EVIDENCE",
  "PROJECTION_EVIDENCE",
  "MODEL_TESTIMONY",
  "DUPLICATE_OR_SUPERSEDED",
  "UNSUPPORTED",
  "EXCLUDED"
]);

class LosslessNumber {
  constructor(lexeme) {
    this.lexeme = lexeme;
    this.canonicalLexeme = canonicalNumberLexeme(lexeme);
    this.hostValue = Number(lexeme);
  }
}

function canonicalNumberLexeme(source) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(source);
  if (!match) throw new TypeError(`Invalid decimal lexeme '${source}'.`);
  const negative = match[1] === "-";
  const fraction = match[3] ?? "";
  let digits = `${match[2]}${fraction}`.replace(/^0+/u, "");
  let exponent = Number.parseInt(match[4] ?? "0", 10) - fraction.length;
  if (digits.length === 0) return "0";
  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    exponent += 1;
  }
  const sign = negative ? "-" : "";
  const decimalPoint = digits.length + exponent;
  if (decimalPoint > 0 && decimalPoint <= 21) {
    return decimalPoint >= digits.length
      ? `${sign}${digits}${"0".repeat(decimalPoint - digits.length)}`
      : `${sign}${digits.slice(0, decimalPoint)}.${digits.slice(decimalPoint)}`;
  }
  if (decimalPoint <= 0 && decimalPoint > -6) {
    return `${sign}0.${"0".repeat(-decimalPoint)}${digits}`;
  }
  const mantissa = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
  const scientificExponent = decimalPoint - 1;
  return `${sign}${mantissa}e${scientificExponent >= 0 ? "+" : ""}${scientificExponent}`;
}

function projectHostJson(value) {
  if (value instanceof LosslessNumber) return value.hostValue;
  if (Array.isArray(value)) return value.map(projectHostJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, projectHostJson(child)]));
  }
  return value;
}

function canonicalLosslessJson(value) {
  if (value instanceof LosslessNumber) return value.canonicalLexeme;
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalLosslessJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalLosslessJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Lossless value is not representable as canonical JSON.");
}

export class LosslessJsonError extends Error {
  constructor(code, message, source, characterOffset) {
    const byteOffset = Buffer.byteLength(source.slice(0, characterOffset), "utf8");
    super(`${message} at byte ${byteOffset}.`);
    this.name = "LosslessJsonError";
    this.code = code;
    this.characterOffset = characterOffset;
    this.byteOffset = byteOffset;
  }
}

function containsLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

class LosslessJsonParser {
  constructor(source, maximumDepth) {
    this.source = source;
    this.maximumDepth = maximumDepth;
    this.index = 0;
    this.numberLexemes = [];
    this.stringLexemes = [];
  }

  fail(code, message, offset = this.index) {
    throw new LosslessJsonError(code, message, this.source, offset);
  }

  parse() {
    this.whitespace();
    const value = this.value(0);
    this.whitespace();
    if (this.index !== this.source.length) this.fail("JSON_PARSE_ERROR", "Unexpected token");
    return value;
  }

  value(depth) {
    if (depth > this.maximumDepth) this.fail("JSON_PARSE_ERROR", `JSON nesting exceeds ${this.maximumDepth}`);
    this.whitespace();
    const token = this.source[this.index];
    if (token === "{") return this.object(depth + 1);
    if (token === "[") return this.array(depth + 1);
    if (token === "\"") return this.string();
    if (this.source.startsWith("true", this.index)) { this.index += 4; return true; }
    if (this.source.startsWith("false", this.index)) { this.index += 5; return false; }
    if (this.source.startsWith("null", this.index)) { this.index += 4; return null; }
    if (token === "-" || (token >= "0" && token <= "9")) return this.number();
    return this.fail("JSON_PARSE_ERROR", "Expected a JSON value");
  }

  object(depth) {
    this.index += 1;
    this.whitespace();
    const value = {};
    const keys = new Set();
    if (this.source[this.index] === "}") { this.index += 1; return value; }
    while (true) {
      if (this.source[this.index] !== "\"") this.fail("JSON_PARSE_ERROR", "Expected an object property");
      const keyOffset = this.index;
      const key = this.string();
      if (keys.has(key)) this.fail("JSON_DUPLICATE_KEY", `Duplicate object property '${key}' is not admitted`, keyOffset);
      keys.add(key);
      this.whitespace();
      if (this.source[this.index] !== ":") this.fail("JSON_PARSE_ERROR", "Expected ':'");
      this.index += 1;
      Object.defineProperty(value, key, { value: this.value(depth), enumerable: true, configurable: true, writable: true });
      this.whitespace();
      const delimiter = this.source[this.index];
      if (delimiter === "}") { this.index += 1; return value; }
      if (delimiter !== ",") this.fail("JSON_PARSE_ERROR", "Expected ',' or '}'");
      this.index += 1;
      this.whitespace();
    }
  }

  array(depth) {
    this.index += 1;
    this.whitespace();
    const value = [];
    if (this.source[this.index] === "]") { this.index += 1; return value; }
    while (true) {
      value.push(this.value(depth));
      this.whitespace();
      const delimiter = this.source[this.index];
      if (delimiter === "]") { this.index += 1; return value; }
      if (delimiter !== ",") this.fail("JSON_PARSE_ERROR", "Expected ',' or ']'");
      this.index += 1;
      this.whitespace();
    }
  }

  string() {
    const start = this.index;
    this.index += 1;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        let value;
        try { value = JSON.parse(this.source.slice(start, this.index)); }
        catch { return this.fail("JSON_PARSE_ERROR", "Invalid JSON string", start); }
        if (containsLoneSurrogate(value)) this.fail("JSON_PARSE_ERROR", "Lone Unicode surrogate is not admitted", start);
        this.stringLexemes.push({ lexeme: this.source.slice(start, this.index), decodedValue: value, ...this.location(start) });
        return value;
      }
      if (code < 0x20) this.fail("JSON_PARSE_ERROR", "Unescaped control character");
      if (code === 0x5c) {
        this.index += 1;
        const escape = this.source[this.index];
        if (escape === "u") {
          if (!/^[0-9a-fA-F]{4}$/u.test(this.source.slice(this.index + 1, this.index + 5))) {
            this.fail("JSON_PARSE_ERROR", "Invalid Unicode escape");
          }
          this.index += 5;
          continue;
        }
        if (!escape || !'"\\/bfnrt'.includes(escape)) this.fail("JSON_PARSE_ERROR", "Invalid escape");
      }
      this.index += 1;
    }
    return this.fail("JSON_PARSE_ERROR", "Unterminated JSON string", start);
  }

  number() {
    const start = this.index;
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(this.source.slice(this.index));
    if (!match) return this.fail("JSON_PARSE_ERROR", "Invalid JSON number", start);
    this.index += match[0].length;
    const number = new LosslessNumber(match[0]);
    this.numberLexemes.push({ lexeme: match[0], canonicalLexeme: number.canonicalLexeme, ...this.location(start) });
    return number;
  }

  location(characterOffset) {
    const prefix = this.source.slice(0, characterOffset);
    const lines = prefix.split(/\r\n|\r|\n/u);
    return {
      characterOffset,
      byteOffset: Buffer.byteLength(prefix, "utf8"),
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1
    };
  }

  whitespace() {
    while (/[\u0009\u000a\u000d\u0020]/u.test(this.source[this.index] ?? "")) this.index += 1;
  }
}

export function parseLosslessJson(source, maximumDepth = 128) {
  return parseLosslessJsonEvidence(source, maximumDepth).value;
}

export function parseLosslessJsonEvidence(source, maximumDepth = 128) {
  if (typeof source !== "string") throw new TypeError("JSON source must be a string.");
  if (!Number.isSafeInteger(maximumDepth) || maximumDepth < 1) throw new TypeError("maximumDepth must be a positive safe integer.");
  const parser = new LosslessJsonParser(source, maximumDepth);
  const losslessValue = parser.parse();
  return {
    value: projectHostJson(losslessValue),
    losslessValue,
    canonicalJson: canonicalLosslessJson(losslessValue),
    numberLexemes: parser.numberLexemes,
    stringLexemes: parser.stringLexemes
  };
}

function compareCodePoints(left, right) {
  const leftPoints = [...left].map((value) => value.codePointAt(0));
  const rightPoints = [...right].map((value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

export function canonicalJson(value) {
  return canonicalHostJson(value, compareCodePoints);
}

function canonicalHostJson(value, comparator) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON number is not admitted.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((child) => canonicalHostJson(child, comparator)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(comparator).map((key) => `${JSON.stringify(key)}:${canonicalHostJson(value[key], comparator)}`).join(",")}}`;
  }
  throw new TypeError("Value is not representable as canonical JSON.");
}

export function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalJsonDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

function decodeCanonicalBase64(value) {
  if (typeof value !== "string" || !CANONICAL_BASE64_PATTERN.test(value)) throw new Error("JSON_BASE64_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("JSON_BASE64_INVALID");
  return bytes;
}

function decodeUtf8(bytes) {
  let value;
  try { value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error("JSON_UTF8_INVALID"); }
  if (value.startsWith("\uFEFF")) throw new Error("JSON_BOM_REJECTED");
  return value;
}

function readBoundAuthority(reference, expectedDigest, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0 || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new Error("JSON_AUTHORITY_BINDING_INCOMPLETE");
  }
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("JSON_AUTHORITY_LOCAL_FILE_REQUIRED");
  const bytes = fs.readFileSync(fileURLToPath(url));
  const actualDigest = sha256(bytes);
  if (actualDigest !== expectedDigest) throw new Error(`JSON_AUTHORITY_DIGEST_MISMATCH:${reference}`);
  const source = decodeUtf8(bytes);
  return { reference, digest: actualDigest, source, document: parseLosslessJson(source) };
}

function finding(code, resource, message, severity = "ERROR", extra = {}) {
  return {
    code,
    severity,
    message,
    sourceRef: resource.sourceLocator ?? resource.sourceRef,
    sourcePointer: resource.jsonPointer ?? resource.sourcePointer ?? "",
    ...extra
  };
}

function normalizedAjvMessage(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.keyword}: ${error.message ?? "schema validation failed"}`)
    .sort(compareCodePoints)
    .join("; ");
}

function validateSchemaAuthority(schemaDocument, admittedSchemaIds) {
  if (schemaDocument.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    throw new Error("JSON_SCHEMA_DRAFT_UNSUPPORTED");
  }
  const inspect = (value) => {
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && !value.$ref.startsWith("#")) {
      let resolved;
      try { resolved = new URL(value.$ref, schemaDocument.$id).href.split("#", 1)[0]; }
      catch { throw new Error("JSON_SCHEMA_REFERENCE_NOT_ADMITTED"); }
      if (!admittedSchemaIds.has(resolved)) throw new Error("JSON_SCHEMA_REFERENCE_NOT_ADMITTED");
    }
    Object.values(value).forEach(inspect);
  };
  inspect(schemaDocument);
}

function dispositionFor(resources, findings) {
  const rejectedCodes = new Set([
    "JSON_PARSE_ERROR", "JSON_DUPLICATE_KEY", "JSON_BASE64_INVALID", "JSON_UTF8_INVALID", "JSON_BOM_REJECTED",
    "JSON_SOURCE_BYTE_LENGTH_MISMATCH", "JSON_SOURCE_DIGEST_MISMATCH", "JSON_SOURCE_CLASS_MISMATCH",
    "RESOURCE_ID_DUPLICATE", "RESOURCE_ORDER_INVALID", "JSON_NUMBER_OUT_OF_RANGE", "JSON_NEGATIVE_ZERO", "JSON_SCHEMA_REJECTED"
  ]);
  if (findings.some((entry) => rejectedCodes.has(entry.code)) || resources.some((entry) => entry.parseDisposition === "REJECTED" || entry.schemaDisposition === "REJECTED")) {
    return "REJECTED";
  }
  if (findings.length > 0 || resources.some((entry) => entry.schemaDisposition === "NOT_OBSERVABLE" || entry.referenceDisposition === "OPEN")) {
    return "OPEN";
  }
  return "CONFORMANT";
}

function sortFindings(findings) {
  return findings.sort((left, right) => {
    for (const key of ["sourceRef", "sourcePointer", "code", "message"]) {
      const comparison = compareCodePoints(left[key] ?? "", right[key] ?? "");
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
}

function canonicalAuthorityRef(reference) {
  const marker = "authority/";
  const index = reference.indexOf(marker);
  return index >= 0 ? reference.slice(index) : reference;
}

function sidefxDiagnosticCode(code) {
  return ({
    JSON_BASE64_INVALID: "SOURCE_BASE64_INVALID",
    JSON_SOURCE_BYTE_LENGTH_MISMATCH: "SOURCE_BYTE_LENGTH_MISMATCH",
    JSON_SOURCE_DIGEST_MISMATCH: "SOURCE_DIGEST_MISMATCH",
    JSON_UTF8_INVALID: "JSON_INVALID_UTF8",
    JSON_BOM_REJECTED: "JSON_BOM_FORBIDDEN"
  })[code] ?? code;
}

export function ingestJsonAuthority(input, authorityBundle) {
  if (authorityBundle.requestValidator && !authorityBundle.requestValidator(input)) {
    throw new Error(`JSON_AUTHORITY_INGESTION_REQUEST_SCHEMA_REJECTED:${normalizedAjvMessage(authorityBundle.requestValidator.errors)}`);
  }
  const manifestRequest = input?.manifest ?? input?.payload;
  if (input?.contractId !== authorityBundle.requestContractId || !manifestRequest || !Array.isArray(manifestRequest.resources)) {
    throw new Error("JSON_AUTHORITY_INGESTION_REQUEST_INVALID");
  }
  const requestProfileId = input.authorityBindings?.profile?.authorityId ?? manifestRequest.profileId;
  if (requestProfileId !== (authorityBundle.profile.document.authorityId ?? authorityBundle.profile.document.profileType)) throw new Error("JSON_PROFILE_ID_MISMATCH");
  if (input.authorityBindings) {
    const requestBindings = [
      [input.authorityBindings.profile, authorityBundle.profile],
      [input.authorityBindings.membershipPolicy, authorityBundle.membershipPolicy],
      [input.authorityBindings.canonicalizationPolicy, authorityBundle.canonicalizationPolicy]
    ];
    if (requestBindings.some(([binding, authority]) => binding?.authorityDigest !== authority.digest)) {
      throw new Error("JSON_REQUEST_AUTHORITY_BINDING_MISMATCH");
    }
  }
  if (manifestRequest.manifestDigest !== authorityBundle.fixtureManifest.document.fixtureSetDigest) throw new Error("JSON_MANIFEST_DIGEST_MISMATCH");
  const fixtures = authorityBundle.fixtureManifest.document.fixtures ?? [];
  const fixtureByLocator = new Map(fixtures.flatMap((fixture) => [
    fixture.sourceLocator ?? fixture.sourcePointer,
    fixture.resourceId ?? fixture.fixtureId
  ].filter((key) => typeof key === "string" && key.length > 0).map((key) => [key, fixture])));
  const schemaById = new Map(authorityBundle.schemaCatalog.document.schemas.map((schema) => [schema.schemaRef ?? schema.schemaId, schema]));
  const admittedSchemaIds = new Set([...authorityBundle.schemas.values()].map((schema) => schema.document.$id).filter(Boolean));
  const schemaAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  for (const schemaAuthority of authorityBundle.schemas.values()) schemaAjv.addSchema(schemaAuthority.document);
  const admittedReferences = new Set(manifestRequest.resources.map((resource) => resource.resourceId ?? resource.sourceRef));
  const referenceSubjects = authorityBundle.referenceScope.document.subjects ?? authorityBundle.referenceScope.document.admittedSubjects ?? [];
  const subjectByRef = new Map(referenceSubjects.map((subject) => [subject.subjectRef, subject]));
  for (const subject of referenceSubjects) admittedReferences.add(subject.subjectRef);

  const observedIds = manifestRequest.resources.map((resource) => resource.resourceId);
  const manifestInvariantCodes = [];
  if (observedIds.every((resourceId) => typeof resourceId === "string") && new Set(observedIds).size !== observedIds.length) {
    manifestInvariantCodes.push("RESOURCE_ID_DUPLICATE");
  }
  if (manifestRequest.resourceOrder && (manifestRequest.resourceOrder.length !== observedIds.length ||
      manifestRequest.resourceOrder.some((resourceId) => !observedIds.includes(resourceId)))) {
    manifestInvariantCodes.push("RESOURCE_ORDER_INVALID");
  }

  const receiptResources = [];
  const findings = [];
  for (const resource of manifestRequest.resources) {
    const sourceRef = resource.sourceLocator ?? resource.sourceRef;
    const jsonPointer = resource.jsonPointer ?? resource.sourcePointer ?? "";
    const receiptResource = {
      resourceId: resource.resourceId ?? sourceRef,
      sourceLocator: sourceRef,
      jsonPointer,
      sourceBytesBase64: resource.sourceBytesBase64 ?? resource.sourceBytes,
      byteLength: resource.byteLength ?? null,
      sourceDigest: resource.sourceDigest,
      mediaType: resource.mediaType ?? "application/json",
      encoding: resource.encoding ?? "UTF-8",
      sourcePointer: resource.sourcePointer ?? "",
      sourceClass: resource.sourceClass,
      classificationRuleId: resource.classificationRuleId ?? null,
      declaredVersion: resource.declaredVersion ?? null,
      resolvedReferenceRefs: [],
      resolvedReferences: [],
      unresolvedReferenceRefs: [],
      canonicalJsonDigest: null,
      numberLexemes: [],
      parseDisposition: "REJECTED",
      schemaDisposition: "NOT_OBSERVABLE",
      referenceDisposition: "NOT_APPLICABLE",
      finalDisposition: "REJECTED"
    };
    receiptResources.push(receiptResource);
    if (typeof sourceRef !== "string" || sourceRef.length === 0 || !SOURCE_CLASSES.has(resource.sourceClass)) {
      findings.push(finding("JSON_PARSE_ERROR", { sourceLocator: sourceRef || "unknown", jsonPointer }, "Resource identity or source class is invalid.", "FATAL"));
      continue;
    }
    let bytes;
    let source;
    let parsed;
    try {
      bytes = decodeCanonicalBase64(receiptResource.sourceBytesBase64);
      if (resource.byteLength !== undefined && resource.byteLength !== bytes.byteLength) throw new Error("JSON_SOURCE_BYTE_LENGTH_MISMATCH");
      if (sha256(bytes) !== resource.sourceDigest) throw new Error("JSON_SOURCE_DIGEST_MISMATCH");
      source = decodeUtf8(bytes);
      const parseEvidence = parseLosslessJsonEvidence(source);
      parsed = parseEvidence.value;
      const numericPolicy = authorityBundle.profile.document.requirements?.numericPolicy ?? authorityBundle.canonicalizationPolicy.document.jsonParsing?.numericPolicy;
      if (numericPolicy) {
        const invalidNumber = parseEvidence.numberLexemes.find(({ lexeme }) => {
          const host = Number(lexeme);
          return !Number.isFinite(host) || (/^-?(?:0|[1-9][0-9]*)$/u.test(lexeme) && !Number.isSafeInteger(host));
        });
        const negativeZero = parseEvidence.numberLexemes.find(({ lexeme }) => /^-0(?:\.0+)?(?:[eE][+-]?\d+)?$/u.test(lexeme));
        if (invalidNumber) throw new Error("JSON_NUMBER_OUT_OF_RANGE");
        if (negativeZero) throw new Error("JSON_NEGATIVE_ZERO");
      }
      receiptResource.parseDisposition = "PARSED";
      const canonicalMaterial = authorityBundle.canonicalizationPolicy.document.canonicalJson?.algorithm === "RFC8785_JCS"
        ? canonicalHostJson(parsed, (left, right) => left < right ? -1 : left > right ? 1 : 0)
        : parseEvidence.canonicalJson;
      receiptResource.canonicalJsonDigest = sha256(Buffer.from(canonicalMaterial, "utf8"));
      receiptResource.numberLexemes = parseEvidence.numberLexemes;
    } catch (error) {
      const code = error instanceof LosslessJsonError ? error.code : error.message;
      const admittedCode = ["JSON_DUPLICATE_KEY", "JSON_BASE64_INVALID", "JSON_UTF8_INVALID", "JSON_BOM_REJECTED", "JSON_SOURCE_BYTE_LENGTH_MISMATCH", "JSON_SOURCE_DIGEST_MISMATCH", "JSON_NUMBER_OUT_OF_RANGE", "JSON_NEGATIVE_ZERO"].includes(code)
        ? code : "JSON_PARSE_ERROR";
      const extra = error instanceof LosslessJsonError ? { start: { line: 1, column: error.characterOffset + 1, byteOffset: error.byteOffset } } : {};
      findings.push(finding(admittedCode, resource, error.message || admittedCode, "ERROR", extra));
      continue;
    }

    const fixture = (resource.resourceId ? fixtureByLocator.get(resource.resourceId) : undefined) ?? fixtureByLocator.get(sourceRef) ?? fixtureByLocator.get(jsonPointer);
    if (fixture && (fixture.sourceDigest !== resource.sourceDigest || fixture.sourceBytesBase64 !== receiptResource.sourceBytesBase64 || fixture.sourceClass !== resource.sourceClass)) {
      findings.push(finding("JSON_SOURCE_DIGEST_MISMATCH", resource, "Resource does not match the selected manifest authority."));
    }
    if (resource.requestedSourceClass && resource.requestedSourceClass !== resource.sourceClass) {
      findings.push(finding("JSON_SOURCE_CLASS_MISMATCH", resource, `Requested source class ${resource.requestedSourceClass} cannot replace retained class ${resource.sourceClass}.`));
    }

    const schemaRef = resource.schemaRef ?? resource.declaredSchema?.schemaRef;
    const schemaDigest = resource.schemaDigest ?? resource.declaredSchema?.schemaDigest;
    if (!schemaRef) {
      receiptResource.schemaDisposition = "NOT_DECLARED";
    } else {
      receiptResource.schemaRef = schemaRef;
      if (schemaDigest) receiptResource.schemaDigest = schemaDigest;
      const schemaEntry = schemaById.get(schemaRef);
      if (!schemaEntry || !schemaDigest) {
        findings.push(finding("JSON_SCHEMA_MISSING", resource, `Declared schema '${schemaRef}' is not observable.`, "WARNING"));
        receiptResource.schemaDisposition = "NOT_OBSERVABLE";
      } else if (schemaEntry.sourceDigest !== schemaDigest) {
        findings.push(finding("JSON_SCHEMA_REJECTED", resource, `Declared schema digest for '${schemaRef}' is not admitted.`));
        receiptResource.schemaDisposition = "REJECTED";
      } else {
        const schemaAuthority = authorityBundle.schemas.get(schemaRef);
        if (!schemaAuthority || schemaAuthority.digest !== schemaDigest) {
          findings.push(finding("JSON_SCHEMA_MISSING", resource, `Declared schema '${schemaRef}' is unavailable.`, "WARNING"));
          receiptResource.schemaDisposition = "NOT_OBSERVABLE";
        } else {
          try {
            validateSchemaAuthority(schemaAuthority.document, admittedSchemaIds);
            const versionAdmission = (authorityBundle.versionPolicy.document.supportedVersions ?? authorityBundle.versionPolicy.document.bindings ?? []).find((candidate) =>
              candidate.declaredVersion === resource.declaredVersion && candidate.schemaRef === schemaRef);
            if (!versionAdmission) {
              findings.push(finding("JSON_VERSION_UNSUPPORTED", resource, `Declared version '${resource.declaredVersion}' is not admitted.`, "WARNING"));
              receiptResource.schemaDisposition = "NOT_OBSERVABLE";
            } else {
              const validate = schemaAjv.getSchema(schemaAuthority.document.$id) ?? schemaAjv.compile(schemaAuthority.document);
              if (!validate(parsed)) {
                findings.push(finding("JSON_SCHEMA_REJECTED", resource, normalizedAjvMessage(validate.errors)));
                receiptResource.schemaDisposition = "REJECTED";
              } else receiptResource.schemaDisposition = "ADMITTED";
            }
          } catch (error) {
            findings.push(finding("JSON_SCHEMA_REJECTED", resource, error.message || "Schema authority was rejected."));
            receiptResource.schemaDisposition = "REJECTED";
          }
        }
      }
    }

    if (receiptResource.schemaDisposition === "ADMITTED" || receiptResource.schemaDisposition === "NOT_DECLARED") {
      const references = resource.referenceRefs ?? [];
      const dangling = references.filter((reference) => !admittedReferences.has(reference)).sort(compareCodePoints);
      receiptResource.resolvedReferenceRefs = references.filter((reference) => admittedReferences.has(reference)).sort(compareCodePoints);
      receiptResource.resolvedReferences = receiptResource.resolvedReferenceRefs.map((referenceRef) => {
        const subject = subjectByRef.get(referenceRef);
        return {
          referenceRef,
          resourceId: subject?.resourceId ?? referenceRef.replace(/^[^:]+:/u, ""),
          sourceDigest: subject?.sourceDigest ?? manifestRequest.resources.find((candidate) => candidate.resourceId === referenceRef)?.sourceDigest
        };
      }).filter((reference) => DIGEST_PATTERN.test(reference.sourceDigest ?? ""));
      receiptResource.unresolvedReferenceRefs = dangling;
      if (dangling.length > 0) {
        receiptResource.referenceDisposition = "OPEN";
        findings.push(finding("JSON_REFERENCE_DANGLING", resource, `References are not closed: ${dangling.join(", ")}.`, "WARNING", { relatedSourcePointers: dangling }));
      } else receiptResource.referenceDisposition = "CLOSED";
    }
    const localFindings = findings.filter((entry) => entry.sourceRef === sourceRef && entry.sourcePointer === jsonPointer);
    receiptResource.finalDisposition = localFindings.some((entry) => entry.severity === "ERROR" || entry.severity === "FATAL")
      ? "REJECTED" : localFindings.length > 0 ? "OPEN" : "CONFORMANT";
  }

  if (manifestInvariantCodes.length > 0 && receiptResources.length > 0) {
    const firstResource = receiptResources[0];
    const source = manifestRequest.resources[0];
    for (const code of manifestInvariantCodes) {
      findings.push(finding(code, source, code === "RESOURCE_ID_DUPLICATE"
        ? "Manifest resourceId values must be unique."
        : "resourceOrder must contain exactly the declared resourceId values."));
    }
    Object.assign(firstResource, {
      canonicalJsonDigest: null,
      numberLexemes: [],
      parseDisposition: "REJECTED",
      schemaDisposition: "NOT_OBSERVABLE",
      referenceDisposition: "NOT_APPLICABLE",
      resolvedReferenceRefs: [],
      resolvedReferences: [],
      unresolvedReferenceRefs: [],
      finalDisposition: "REJECTED"
    });
  }

  const declaredOrder = manifestRequest.resourceOrder ?? [];
  receiptResources.sort((left, right) => declaredOrder.length > 0
    ? declaredOrder.indexOf(left.resourceId) - declaredOrder.indexOf(right.resourceId)
    : compareCodePoints(left.resourceId, right.resourceId) || compareCodePoints(left.sourceLocator, right.sourceLocator));
  sortFindings(findings);
  const genericDisposition = dispositionFor(receiptResources, findings);
  const sidefxReceipt = authorityBundle.receiptType === "sidefx-json-authority-ingestion-receipt.v1";
  const outputResources = sidefxReceipt ? receiptResources.map((resource) => ({
    resourceId: resource.resourceId,
    sourceLocator: resource.sourceLocator,
    jsonPointer: resource.jsonPointer,
    sourceBytesBase64: resource.sourceBytesBase64,
    byteLength: resource.byteLength,
    sourceDigest: resource.sourceDigest,
    mediaType: resource.mediaType,
    encoding: resource.encoding,
    sourceClass: resource.sourceClass,
    classificationRuleId: resource.classificationRuleId,
    ...(resource.schemaRef ? { schemaRef: resource.schemaRef, schemaDigest: resource.schemaDigest } : {}),
    declaredVersion: resource.declaredVersion,
    canonicalDigest: resource.canonicalJsonDigest,
    referenceRefs: resource.referenceDisposition === "NOT_APPLICABLE" ? [] : (manifestRequest.resources.find((candidate) => (candidate.resourceId ?? candidate.sourceRef) === resource.resourceId)?.referenceRefs ?? []),
    resolvedReferences: resource.resolvedReferences,
    unresolvedReferenceRefs: resource.unresolvedReferenceRefs,
    parseDisposition: resource.parseDisposition,
    schemaDisposition: resource.schemaDisposition,
    referenceDisposition: resource.referenceDisposition
  })) : receiptResources;
  const resourceIdByLocation = new Map(receiptResources.map((resource) => [`${resource.sourceLocator}\0${resource.jsonPointer}`, resource.resourceId]));
  const outputFindings = sidefxReceipt ? findings.map((entry) => ({
    code: sidefxDiagnosticCode(entry.code),
    severity: entry.severity,
    message: entry.message,
    resourceId: resourceIdByLocation.get(`${entry.sourceRef}\0${entry.sourcePointer}`) ?? "unknown-resource",
    sourceLocator: entry.sourceRef,
    jsonPointer: entry.sourcePointer
  })) : findings;
  const receipt = {
    receiptType: authorityBundle.receiptType,
    ...(sidefxReceipt ? {
      authorityBindings: {
        profile: input.authorityBindings.profile,
        membershipPolicy: input.authorityBindings.membershipPolicy,
        canonicalizationPolicy: input.authorityBindings.canonicalizationPolicy,
        schemaCatalogAuthorityId: authorityBundle.schemaCatalog.document.authorityId,
        schemaCatalogAuthorityVersion: authorityBundle.schemaCatalog.document.authorityVersion,
        schemaCatalogRef: canonicalAuthorityRef(authorityBundle.schemaCatalog.reference),
        schemaCatalogDigest: authorityBundle.schemaCatalog.digest,
        referenceScopeAuthorityId: authorityBundle.referenceScope.document.authorityId,
        referenceScopeAuthorityVersion: authorityBundle.referenceScope.document.authorityVersion,
        referenceScopeRef: canonicalAuthorityRef(authorityBundle.referenceScope.reference),
        referenceScopeDigest: authorityBundle.referenceScope.digest,
        versionPolicyAuthorityId: authorityBundle.versionPolicy.document.authorityId,
        versionPolicyAuthorityVersion: authorityBundle.versionPolicy.document.authorityVersion,
        versionPolicyRef: canonicalAuthorityRef(authorityBundle.versionPolicy.reference),
        versionPolicyDigest: authorityBundle.versionPolicy.digest
      },
      manifestId: manifestRequest.manifestId,
      resourceOrder: manifestRequest.resourceOrder
    } : {
      providerAuthority: authorityBundle.providerAuthority,
      profile: { authorityRef: authorityBundle.profile.reference, authorityDigest: authorityBundle.profile.digest, authorityId: authorityBundle.profile.document.profileType },
      membershipPolicy: { authorityRef: authorityBundle.membershipPolicy.reference, authorityDigest: authorityBundle.membershipPolicy.digest, authorityId: authorityBundle.membershipPolicy.document.policyType },
      canonicalizationPolicy: { authorityRef: authorityBundle.canonicalizationPolicy.reference, authorityDigest: authorityBundle.canonicalizationPolicy.digest, authorityId: authorityBundle.canonicalizationPolicy.document.policyType },
      fixtureManifest: { authorityRef: authorityBundle.fixtureManifest.reference, authorityDigest: authorityBundle.fixtureManifest.digest },
      schemaCatalog: { authorityRef: authorityBundle.schemaCatalog.reference, authorityDigest: authorityBundle.schemaCatalog.digest },
      referenceScope: { authorityRef: authorityBundle.referenceScope.reference, authorityDigest: authorityBundle.referenceScope.digest },
      versionPolicy: { authorityRef: authorityBundle.versionPolicy.reference, authorityDigest: authorityBundle.versionPolicy.digest },
      requestContract: { authorityRef: authorityBundle.requestContract.reference, authorityDigest: authorityBundle.requestContract.digest },
      receiptContract: { authorityRef: authorityBundle.receiptContract.reference, authorityDigest: authorityBundle.receiptContract.digest },
      profileId: authorityBundle.profile.document.profileType
    }),
    manifestDigest: manifestRequest.manifestDigest,
    resources: outputResources,
    findings: outputFindings,
    disposition: authorityBundle.dispositions[genericDisposition.toLowerCase()]
  };
  const receiptCanonical = sidefxReceipt
    ? canonicalHostJson(receipt, (left, right) => left < right ? -1 : left > right ? 1 : 0)
    : canonicalJson(receipt);
  const completedReceipt = { ...receipt, receiptDigest: sha256(Buffer.from(receiptCanonical, "utf8")) };
  if (authorityBundle.receiptValidator && !authorityBundle.receiptValidator(completedReceipt)) {
    throw new Error(`JSON_AUTHORITY_INGESTION_RECEIPT_SCHEMA_REJECTED:${normalizedAjvMessage(authorityBundle.receiptValidator.errors)}`);
  }
  return completedReceipt;
}

export function invokeJsonAuthorityIngestion(configuration, input, bindingUrl) {
  const requiredBindings = [
    ["profileRef", "profileDigest"],
    ["membershipPolicyRef", "membershipPolicyDigest"],
    ["canonicalizationPolicyRef", "canonicalizationPolicyDigest"],
    ["requestContractRef", "requestContractDigest"],
    ["receiptContractRef", "receiptContractDigest"],
    ["fixtureManifestRef", "fixtureManifestDigest"],
    ["fixtureManifestSchemaRef", "fixtureManifestSchemaDigest"],
    ["schemaCatalogRef", "schemaCatalogDigest"],
    ["referenceScopeRef", "referenceScopeDigest"],
    ["versionPolicyRef", "versionPolicyDigest"],
    ["providerAuthorityRef", "providerAuthorityDigest"]
  ];
  const authorities = Object.fromEntries(requiredBindings.map(([referenceKey, digestKey]) => [referenceKey, readBoundAuthority(configuration?.[referenceKey], configuration?.[digestKey], bindingUrl)]));
  if (typeof configuration?.requestContractId !== "string" || typeof configuration?.receiptType !== "string" ||
      !configuration?.dispositions || ["conformant", "open", "rejected"].some((key) => typeof configuration.dispositions[key] !== "string")) {
    throw new Error("JSON_AUTHORITY_CONTRACT_MAPPING_INCOMPLETE");
  }
  const schemaRootUrl = new URL(configuration?.schemaRootRef ?? "./", bindingUrl);
  if (schemaRootUrl.protocol !== "file:") throw new Error("JSON_SCHEMA_ROOT_LOCAL_FILE_REQUIRED");
  const schemas = new Map();
  const manifestAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateManifest = manifestAjv.compile(authorities.fixtureManifestSchemaRef.document);
  if (!validateManifest(authorities.fixtureManifestRef.document)) {
    throw new Error(`JSON_MANIFEST_AUTHORITY_SCHEMA_REJECTED:${normalizedAjvMessage(validateManifest.errors)}`);
  }
  const requestAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const requestValidator = requestAjv.compile(authorities.requestContractRef.document);
  const receiptAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const receiptValidator = receiptAjv.compile(authorities.receiptContractRef.document);
  for (const schemaEntry of authorities.schemaCatalogRef.document.schemas ?? []) {
    const schemaRef = schemaEntry.schemaRef ?? schemaEntry.schemaId;
    const schemaUrl = new URL(schemaEntry.sourceRef ?? schemaEntry.path, schemaRootUrl);
    const bytes = fs.readFileSync(fileURLToPath(schemaUrl));
    const digest = sha256(bytes);
    if (digest !== schemaEntry.sourceDigest) throw new Error(`JSON_SCHEMA_AUTHORITY_DIGEST_MISMATCH:${schemaRef}`);
    const source = decodeUtf8(bytes);
    schemas.set(schemaRef, { reference: schemaEntry.sourceRef ?? schemaEntry.path, digest, source, document: parseLosslessJson(source) });
  }
  return ingestJsonAuthority(input, {
    profile: authorities.profileRef,
    membershipPolicy: authorities.membershipPolicyRef,
    canonicalizationPolicy: authorities.canonicalizationPolicyRef,
    receiptContract: authorities.receiptContractRef,
    requestContract: authorities.requestContractRef,
    requestValidator,
    receiptValidator,
    fixtureManifest: authorities.fixtureManifestRef,
    schemaCatalog: authorities.schemaCatalogRef,
    referenceScope: authorities.referenceScopeRef,
    versionPolicy: authorities.versionPolicyRef,
    schemas,
    requestContractId: configuration.requestContractId,
    receiptType: configuration.receiptType,
    dispositions: configuration.dispositions,
    providerAuthority: {
      authorityRef: authorities.providerAuthorityRef.reference,
      authorityDigest: authorities.providerAuthorityRef.digest,
      authorityId: authorities.providerAuthorityRef.document.authorityId ?? "sda-json-authority-ingestion-provider.v1"
    }
  });
}
