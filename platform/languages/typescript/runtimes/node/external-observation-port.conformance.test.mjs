// Conformance proof for sda-external-observation-port.v1 (Node projection target).
// Exercises the admitted platform mechanic against a real public HTTP source
// (Greenhouse's own public job board API) to prove genuine external observation,
// not a fixture replay.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { platformMechanics } from "./admitted-consumer-platform.mjs";

const GREENHOUSE_BOARD_API = "https://boards-api.greenhouse.io/v1/boards/greenhouse/jobs";

test("external observation port retrieves a real public representation with correct evidence shape", async () => {
  const observed = await platformMechanics.observeExternalRepresentation(GREENHOUSE_BOARD_API, {
    allowedHosts: ["boards-api.greenhouse.io"]
  });

  assert.equal(observed.sourceReference, GREENHOUSE_BOARD_API);
  assert.equal(observed.status, 200);
  assert.match(observed.mediaType, /application\/json/);
  assert.match(observed.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.match(observed.contentSha256, /^[0-9a-f]{64}$/);

  const independentDigest = crypto.createHash("sha256").update(observed.content).digest("hex");
  assert.equal(observed.contentSha256, independentDigest, "digest must be computed over the actual observed bytes");

  const parsed = JSON.parse(observed.content);
  assert.ok(Array.isArray(parsed.jobs), "observed content must be the real Greenhouse board payload");
});

test("external observation port rejects hosts absent from the admitted allow-list", async () => {
  await assert.rejects(
    () => platformMechanics.observeExternalRepresentation("https://example.com/not-admitted", {
      allowedHosts: ["boards-api.greenhouse.io"]
    }),
    /MISSING_SDA_PLATFORM_CAPABILITY/
  );
});

test("external observation port rejects non-https references", async () => {
  await assert.rejects(
    () => platformMechanics.observeExternalRepresentation("http://boards-api.greenhouse.io/v1/boards/greenhouse/jobs", {
      allowedHosts: ["boards-api.greenhouse.io"]
    }),
    /MISSING_SDA_PLATFORM_CAPABILITY/
  );
});

test("external observation port fails closed with no configured allow-list", async () => {
  await assert.rejects(
    () => platformMechanics.observeExternalRepresentation(GREENHOUSE_BOARD_API, {}),
    /MISSING_SDA_PLATFORM_CAPABILITY/
  );
});
