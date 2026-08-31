import crypto from "node:crypto";
import { createRequire } from "node:module";
import { ContractAdmissionException } from "../../dist/src/execution/contract-validator.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const canonicalBase64Pattern = "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";

function isBase64AlphabetCode(code) {
  return (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 43 ||
    code === 47;
}

function admitsCanonicalBase64(value) {
  if (value.length % 4 !== 0) return false;
  let contentLength = value.length;
  if (contentLength > 0 && value.charCodeAt(contentLength - 1) === 61) contentLength -= 1;
  if (contentLength > 0 && value.charCodeAt(contentLength - 1) === 61) contentLength -= 1;
  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64AlphabetCode(value.charCodeAt(index))) return false;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return true;
}

function createStackSafeSchemaRegExp(pattern, flags) {
  if (pattern !== canonicalBase64Pattern) return new RegExp(pattern, flags);
  return {
    test: admitsCanonicalBase64,
    toString: () => `/${pattern}/${flags}`
  };
}
createStackSafeSchemaRegExp.code = "createStackSafeSchemaRegExp";

const semanticValueSchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.scenario-driven.dev/kernel/semantic-value.v1.schema.json",
  oneOf: [
    { type: "null" },
    { type: "boolean" },
    { type: "number" },
    { type: "string" },
    { type: "array" },
    { type: "object" }
  ]
});

function withPlatformSemanticValue(contractAuthorities) {
  if (Object.hasOwn(contractAuthorities.contracts, "semantic-value.v1")) return contractAuthorities;
  return {
    ...contractAuthorities,
    contracts: {
      ...contractAuthorities.contracts,
      "semantic-value.v1": {
        schemaRef: "sda-platform:semantic-value.v1",
        schemaId: semanticValueSchema.$id,
        schemaDigest: crypto.createHash("sha256").update(JSON.stringify(semanticValueSchema)).digest("hex"),
        schema: semanticValueSchema
      }
    }
  };
}

function compileContractValidators(contractAuthorities) {
  if (!contractAuthorities) throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: contract schema authority is absent.");
  contractAuthorities = withPlatformSemanticValue(contractAuthorities);
  const ajv = new Ajv2020({ allErrors: true, strict: false, code: { regExp: createStackSafeSchemaRegExp } });
  const registered = new Set();
  for (const entry of Object.values(contractAuthorities.contracts)) {
    const observedDigest = crypto.createHash("sha256").update(JSON.stringify(entry.schema)).digest("hex");
    if (observedDigest !== entry.schemaDigest) throw new Error(`CONTRACT_AUTHORITY_DIGEST_MISMATCH: '${entry.schemaId ?? entry.schemaRef}'`);
    const schemaId = entry.schema.$id ?? entry.schemaRef;
    if (!registered.has(schemaId)) { ajv.addSchema(entry.schema, schemaId); registered.add(schemaId); }
  }
  const validators = Object.fromEntries(Object.entries(contractAuthorities.contracts).map(([contractId, entry]) =>
    [contractId, ajv.getSchema(entry.schema.$id) ?? ajv.compile(entry.schema)]));
  return { ajv, validators };
}

export function createSchemaAdmission(contractAuthorities) {
  const { ajv, validators } = compileContractValidators(contractAuthorities);
  return {
    async admit(contract, value) {
      const validator = validators[contract.contractId];
      if (!validator) throw new ContractAdmissionException(`MISSING_SDA_PLATFORM_CAPABILITY: schema '${contract.contractId}' is unavailable.`);
      if (!validator(value)) {
        throw new ContractAdmissionException(`CONTRACT_ADMISSION_FAILED: '${contract.contractId}' ${ajv.errorsText(validator.errors)}`);
      }
      return value;
    }
  };
}

export function createSynchronousSchemaAdmission(contractAuthorities) {
  const { validators } = compileContractValidators(contractAuthorities);
  return {
    admits(contractId, value) {
      const validator = validators[contractId];
      if (!validator) throw new ContractAdmissionException(`MISSING_SDA_PLATFORM_CAPABILITY: schema '${contractId}' is unavailable.`);
      return validator(value) === true;
    }
  };
}

export function matchesSchema(schema, value) {
  const supported = new Set(["type", "required", "properties", "additionalProperties", "minLength"]);
  const unsupported = Object.keys(schema).filter((key) => !supported.has(key));
  if (unsupported.length) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: unsupported schema mechanics '${unsupported.join(",")}'`);
  const types = {
    object: value !== null && typeof value === "object" && !Array.isArray(value),
    array: Array.isArray(value), string: typeof value === "string", integer: Number.isInteger(value),
    number: typeof value === "number" && Number.isFinite(value), boolean: typeof value === "boolean", null: value === null
  };
  if (schema.type && !types[schema.type]) return false;
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) return false;
  if (types.object) {
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(properties, key))) return false;
    if (Object.entries(properties).some(([key, child]) => Object.hasOwn(value, key) && !matchesSchema(child, value[key]))) return false;
  }
  return true;
}
