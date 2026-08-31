"use strict";
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../../..");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const { satisfies, valueAt } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");
const validate = (value, schema) => new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas")).validate(value, schema);

test("an implemented inspectable query is schema-admitted", () => {
  const catalog = { contractType: "inspectable-query-catalog.v1", catalogId: "sample-queries.v1", queries: [{ queryId: "find-items", question: "Which items match?", status: "IMPLEMENTED", parameters: ["kind"], resultShape: "Item[]", expression: { op: "path", from: "input", path: "profile.items" } }] };
  const result = validate(catalog, "inspectable-query-catalog.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test("query observations resolve nested results and evaluate assertions", () => {
  const result = { rows: [{ label: "visible" }], tags: ["a", "b"] };
  assert.equal(valueAt(result, "rows.0.label"), "visible");
  assert.equal(satisfies(valueAt(result, "rows.0.label"), { operator: "equals", value: "visible" }), true);
  assert.equal(satisfies(result.tags, { operator: "contains", value: "b" }), true);
  assert.equal(satisfies(result.tags, { operator: "not-contains", value: "c" }), true);
});

test("a complete observed-query proof is schema-admitted", () => {
  const proof = { conformanceType: "consumer-query-catalog-conformance.v1", catalogId: "sample-queries.v1", projectionTarget: "node", coverage: { declared: 1, implemented: 1, observed: 1 }, queries: [{ queryId: "find-items", fixtureId: "sample-fixture", params: { kind: "sample" }, result: [{ label: "visible" }], assertions: [{ path: "0.label", operator: "equals", expected: "visible", actual: "visible", satisfied: true }], disposition: "OBSERVED" }], disposition: "ALL_IMPLEMENTED_QUERIES_OBSERVED" };
  const result = validate(proof, "consumer-query-catalog-conformance.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});
