"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const {
  admissionArtifactIsCurrent,
  computeAdmissionInputDigest
} = require("../../../artifacts/tools/dist/adapters/conformance/admission-input-digest.cjs");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../../..");

function nativeHostCompatible(language) {
  const boundaryPath = path.join(REPO_ROOT, "languages", language, "conformance", "native-runtime-boundary.json");
  if (!fs.existsSync(boundaryPath)) return true;
  const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
  const operatingSystem = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform];
  return boundary.boundaryType === "native-runtime-boundary.v1" &&
    boundary.targetId === language &&
    boundary.physicalTarget?.operatingSystem === operatingSystem &&
    boundary.physicalTarget?.architecture === process.arch;
}

async function service() {
  const module = await import(pathToFileURL(path.join(
    REPO_ROOT,
    "artifacts",
    "tools",
    "dist",
    "conformance",
    "application",
    "conformance-service.js"
  )).href);
  return new module.ConformanceService(REPO_ROOT);
}

async function equivalenceModules() {
  const root = path.join(
    REPO_ROOT,
    "artifacts",
    "tools",
    "dist",
    "capabilities",
    "conformance-evidence-publication",
    "derive-cross-language-equivalence"
  );
  const [provider, obligation] = await Promise.all([
    import(pathToFileURL(path.join(root, "provider.js")).href),
    import(pathToFileURL(path.join(root, "obligation.js")).href)
  ]);
  return { ...provider, ...obligation };
}

async function freshnessModule() {
  return import(pathToFileURL(path.join(
    REPO_ROOT,
    "artifacts",
    "tools",
    "dist",
    "conformance",
    "proof",
    "evidence-freshness.js"
  )).href);
}

test("every active implementation publishes current proof with declared native-host observability", { timeout: 600000 }, async () => {
  const conformance = await service();
  const obligations = conformance.obligations().filter((item) => item.isActiveObligation);
  const languagesRoot = path.join(REPO_ROOT, "languages");
  const expectedActiveLanguages = fs.readdirSync(languagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(languagesRoot, entry.name, "binding");
      return fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((file) => file.endsWith(".binding.json")).map((file) => ({ bindingPath: path.join(directory, file) }))
        : [];
    })
    .filter(({ bindingPath }) => JSON.parse(fs.readFileSync(bindingPath, "utf8")).status === "IMPLEMENTING")
    .map(({ bindingPath }) => JSON.parse(fs.readFileSync(bindingPath, "utf8")).language)
    .sort();
  assert.deepEqual(obligations.map((item) => item.language), expectedActiveLanguages);
  const publication = await conformance.report();
  const publicationContracts = new AjvSchemaAdmission(path.join(
    REPO_ROOT,
    "capabilities",
    "sda-tooling",
    "conformance-evidence-publication",
    "contracts"
  ));
  assert.equal(publication.admissions.length, obligations.length);
  const nativeObservationGaps = new Set(obligations.filter((item) => !nativeHostCompatible(item.language)).map((item) => item.language));
  for (const result of publication.admissions) {
    const obligation = obligations.find((item) => item.language === result.language);
    assert.ok(obligation);
    assert.equal(result.evaluationDisposition, "COMPLETE");
    assert.equal(result.implementationOrigin.origin, "PROJECTED");
    assert.deepEqual(result.blockingObligations, []);
    assert.equal(result.obligations.length, 11);
    if (nativeObservationGaps.has(result.language)) {
      assert.equal(result.admissionDisposition, "BLOCKED", JSON.stringify(result, null, 2));
      assert.deepEqual(result.notReadyObligations, ["behavioral-conformance", "execution-closure"]);
      assert.ok(result.obligations.every((item) =>
        item.disposition === (result.notReadyObligations.includes(item.id) ? "NOT_READY" : "PASS") && item.scenarioId && item.obligationId && item.evidenceRef));
      assert.match(result.details.behavioral.reason, /native runtime target is not compatible with the current host/);
      assert.match(result.details.executionClosure.reason, /native runtime target is not compatible with the current host/);
    } else {
      assert.equal(result.admissionDisposition, "ADMITTED", JSON.stringify(result, null, 2));
      assert.deepEqual(result.notReadyObligations, []);
      assert.ok(result.obligations.every((item) =>
        item.disposition === "PASS" && item.scenarioId && item.obligationId && item.evidenceRef));
    }
    assert.match(result.proofInputDigest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(admissionArtifactIsCurrent(REPO_ROOT, obligation, result), true);
    const contractAdmission = publicationContracts.validate(result, "published-implementation-evidence.schema.json");
    assert.equal(contractAdmission.valid, true, JSON.stringify(contractAdmission.errors, null, 2));
    if (result.language === "node") {
      assert.ok(result.details.executionClosure.fixtures.length > 0);
      assert.ok(result.details.executionClosure.fixtures.every((fixture) => fixture.conforming === true));
    }
  }
  assert.ok(publication.crossLanguage);
  assert.equal(publication.crossLanguage.languages.length, obligations.length);
  assert.equal(publication.crossLanguage.equivalentCount,
    nativeObservationGaps.size === 0 ? publication.crossLanguage.totalFixtures : 0);
  assert.ok(publication.crossLanguage.rows.every((row) => publication.crossLanguage.languages.every((language) =>
    row.perLanguage[language] === (nativeObservationGaps.has(language) ? "NOT_READY" : "PASS"))));
});

test("cross-language equivalence preserves explicit aggregate proof gaps", async () => {
  const { CrossLanguageEquivalenceProvider, CrossLanguageEquivalenceObligation } = await equivalenceModules();
  const admission = (language, ran, conforming) => ({
    language,
    details: {
      behavioral: { ran, conforming }
    }
  });
  const evidence = await new CrossLanguageEquivalenceProvider().execute({
    admissions: [admission("node", true, true), admission("java", true, false), admission("go", false, false)],
    fixtures: [{ fixtureId: "fixture-a", label: "fixture a" }]
  });
  assert.deepEqual(evidence.rows[0].perLanguage, { node: "PASS", java: "UNVERIFIED", go: "NOT_READY" });
  assert.equal(evidence.equivalentCount, 0);
  assert.equal(new CrossLanguageEquivalenceObligation().evaluate(evidence).kind, "SATISFIED");
});

test("evidence freshness requires an exact well-formed proof-input digest", async () => {
  const { evidenceIsCurrent } = await freshnessModule();
  const digest = `sha256:${"a".repeat(64)}`;
  assert.equal(evidenceIsCurrent(digest, { proofInputDigest: digest }), true);
  assert.equal(evidenceIsCurrent(digest, { proofInputDigest: `sha256:${"b".repeat(64)}` }), false);
  assert.equal(evidenceIsCurrent("not-a-digest", { proofInputDigest: "not-a-digest" }), false);
  assert.equal(evidenceIsCurrent(digest, null), false);
});

test("admission freshness includes governed capability authority", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-admission-digest-"));
  const authorityDirectory = path.join(root, "capabilities", "sda-tooling", "kernel-implementation-admission");
  const bindingDirectory = path.join(root, "languages", "typescript", "binding");
  fs.mkdirSync(authorityDirectory, { recursive: true });
  fs.mkdirSync(bindingDirectory, { recursive: true });
  const authorityPath = path.join(authorityDirectory, "capability.json");
  const bindingPath = path.join(bindingDirectory, "scenario-kernel-node.binding.json");
  const binding = { language: "node", implementationId: "scenario-kernel-node" };
  fs.writeFileSync(authorityPath, '{"version":1}\n', "utf8");
  fs.writeFileSync(bindingPath, `${JSON.stringify(binding)}\n`, "utf8");
  const obligation = { language: "node", bindingPath, binding };
  const first = computeAdmissionInputDigest(root, obligation);
  fs.writeFileSync(authorityPath, '{"version":2}\n', "utf8");
  const second = computeAdmissionInputDigest(root, obligation);
  fs.rmSync(root, { recursive: true, force: true });
  assert.notEqual(first, second);
});
