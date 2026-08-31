"use strict";
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../../..");
const { validateNoDomainLeakage } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");

test("consumer projection and UI tooling contain no external-domain vocabulary or interpretation algorithms", async () => {
  const result = await validateNoDomainLeakage(REPO_ROOT);
  assert.equal(result.closure.evidence.valid, true, JSON.stringify(result.closure.evidence.violations, null, 2));
  assert.equal(result.closure.evidence.disposition, "DOMAIN_ISOLATED");
  assert.equal(result.obligationId, "no-external-domain-term-or-rule-is-embedded-in-sda-mechanics");
});
