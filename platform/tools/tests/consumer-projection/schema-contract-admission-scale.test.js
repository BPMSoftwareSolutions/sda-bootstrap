import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createSchemaAdmission } from "../../../languages/typescript/runtimes/node/schema-contract-admission-provider.mjs";

const canonicalBase64Pattern = "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";

function admission() {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.scenario-driven.dev/tests/large-canonical-base64.v1.schema.json",
    type: "object",
    additionalProperties: false,
    required: ["bytesBase64"],
    properties: {
      bytesBase64: { type: "string", pattern: canonicalBase64Pattern }
    }
  };
  return createSchemaAdmission({
    contracts: {
      "large-canonical-base64.v1": {
        schemaRef: "tests:large-canonical-base64.v1",
        schemaId: schema.$id,
        schemaDigest: crypto.createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
        schema
      }
    }
  });
}

test("contract admission accepts large canonical base64 without regular-expression stack overflow", async () => {
  const bytesBase64 = Buffer.alloc((20 * 1024 * 1024) + 3, 0xa5).toString("base64");
  const value = { bytesBase64 };
  assert.equal(await admission().admit({ contractId: "large-canonical-base64.v1" }, value), value);
});

test("stack-safe contract admission preserves canonical base64 rejection", async () => {
  const bytesBase64 = Buffer.alloc((20 * 1024 * 1024) + 3, 0xa5).toString("base64");
  const invalid = `${bytesBase64.slice(0, -8)}!${bytesBase64.slice(-7)}`;
  await assert.rejects(
    admission().admit({ contractId: "large-canonical-base64.v1" }, { bytesBase64: invalid }),
    /CONTRACT_ADMISSION_FAILED/
  );
  await assert.rejects(
    admission().admit({ contractId: "large-canonical-base64.v1" }, { bytesBase64: "YQ" }),
    /CONTRACT_ADMISSION_FAILED/
  );
});
