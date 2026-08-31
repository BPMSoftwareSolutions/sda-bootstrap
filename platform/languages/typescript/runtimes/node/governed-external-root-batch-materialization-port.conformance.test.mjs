import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

const platformCapabilityId = "sda-governed-external-root-batch-materialization-port.v1";
const bindingUrl = pathToFileURL(path.join(process.cwd(), "fixture", "binding.json"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function digest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function addressedPlan(operations) {
  const core = {
    planType: "authorized-external-root-batch-materialization-plan.v1",
    disposition: "AUTHORIZED",
    operations,
    findings: []
  };
  return {
    ...core,
    planId: `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(core))).digest("hex")}`
  };
}

function operation(mappingId, targetPath, bytes, targetDisposition = "allow-exact-match") {
  return {
    mappingId,
    operation: "materialize-file",
    targetPath,
    contentBase64: bytes.toString("base64"),
    contentHash: digest(bytes),
    targetDisposition
  };
}

function invocation(targetRoot, plan) {
  return {
    binding: {
      bindingId: "materialize-authorized-batch",
      configuration: {
        mode: "execute-authorized-materialization-plan",
        planPath: "plan",
        targetRootPath: "targetRootRef",
        lineageMode: "retain-effect-lineage",
        lineage: ["consumer"]
      }
    },
    input: {
      contractId: "authorized-external-root-batch-materialization-request.v1",
      request: { requestId: "provider-conformance" },
      targetRootRef: pathToFileURL(`${targetRoot}${path.sep}`).href,
      plan
    }
  };
}

async function invoke(targetRoot, plan, rootExecutionId = "root") {
  const registry = createNodeMechanicRegistry({ bindingUrl });
  const provider = registry.eventPorts.get(platformCapabilityId);
  const request = invocation(targetRoot, plan);
  return provider(request.binding, request.input, { rootExecutionId, nestedExecutions: [] });
}

async function exists(candidatePath) {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

test("the external-root batch materializer is admitted as one versioned platform port", async () => {
  const repositoryRoot = new URL("../../../../", import.meta.url);
  const registry = JSON.parse(await readFile(new URL(
    "kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json",
    repositoryRoot
  ), "utf8"));
  const catalog = JSON.parse(await readFile(new URL(
    "kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json",
    repositoryRoot
  ), "utf8"));

  assert.equal(registry.eventPorts.filter((entry) => entry.platformCapabilityId === platformCapabilityId).length, 1);
  assert.equal(catalog.capabilities.filter((entry) => entry.capabilityId === platformCapabilityId && entry.status === "ADMITTED").length, 1);
  assert.equal(typeof createNodeMechanicRegistry({ bindingUrl }).eventPorts.get(platformCapabilityId), "function");
});

test("one authorized batch materializes exact text and binary bytes outside the binding root and replays idempotently", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-external-materialization-"));
  try {
    const target = path.join(base, "external", "target");
    const utf8 = Buffer.from("é\n", "utf8");
    const binary = Buffer.from([0x00, 0xff, 0x01, 0x80]);
    const plan = addressedPlan([
      operation("utf8", "nested/text.txt", utf8),
      operation("binary", "nested/artifact.bin", binary),
      operation("binary-alias", "nested/artifact.bin", binary)
    ]);

    const first = await invoke(target, plan, "first");
    assert.equal(first.outcomeVariant, "EFFECT_OBSERVED");
    assert.deepEqual(first.effect.operations.map(({ result }) => result), ["verified", "verified", "satisfied"]);
    assert.deepEqual(first.effectLineage, ["consumer", "first"]);
    assert.deepEqual(await readFile(path.join(target, "nested", "text.txt")), utf8);
    assert.deepEqual(await readFile(path.join(target, "nested", "artifact.bin")), binary);
    assert.equal(first.effect.operations[0].byteLength, 3);
    assert.equal(first.effect.operations[1].byteLength, 4);
    assert.equal(first.plan.operations.every((item) => !Object.hasOwn(item, "contentBase64")), true);
    assert.equal(first.effect.operations.every((item) => !Object.hasOwn(item, "contentBase64")), true);
    assert.deepEqual(first.request, { requestId: "provider-conformance" });
    assert.equal(JSON.stringify(first).includes(utf8.toString("base64")), false);
    assert.equal(JSON.stringify(first).includes(binary.toString("base64")), false);

    const second = await invoke(target, plan, "second");
    assert.equal(second.outcomeVariant, "EFFECT_OBSERVED");
    assert.deepEqual(second.effect.operations.map(({ result }) => result), ["satisfied", "satisfied", "satisfied"]);
    assert.deepEqual(await readFile(path.join(target, "nested", "text.txt")), utf8);
    assert.deepEqual(await readFile(path.join(target, "nested", "artifact.bin")), binary);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("one large authorized entry materializes and replays without representation-validator stack overflow", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-external-materialization-large-"));
  try {
    const target = path.join(base, "target");
    const bytes = Buffer.alloc((20 * 1024 * 1024) + 3, 0xa5);
    const plan = addressedPlan([operation("large", "large/artifact.bin", bytes)]);

    const first = await invoke(target, plan, "large-first");
    assert.equal(first.outcomeVariant, "EFFECT_OBSERVED");
    assert.equal(first.effect.operations[0].result, "verified");
    assert.equal(first.effect.operations[0].byteLength, bytes.length);
    assert.equal(digest(await readFile(path.join(target, "large", "artifact.bin"))), digest(bytes));

    const replay = await invoke(target, plan, "large-replay");
    assert.equal(replay.outcomeVariant, "EFFECT_OBSERVED");
    assert.equal(replay.effect.operations[0].result, "satisfied");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("static path, content, and collision findings reject the whole batch before the target root exists", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-external-materialization-reject-"));
  try {
    const bytes = Buffer.from("admitted");
    const vectors = [
      ["traversal", addressedPlan([operation("safe", "safe.txt", bytes), operation("escape", "../escape.txt", bytes)]), "PATH_TRAVERSAL_REJECTED"],
      ["absolute", addressedPlan([operation("absolute", path.resolve(base, "absolute.txt"), bytes)]), "ABSOLUTE_PATH_REJECTED"],
      ["digest", addressedPlan([{ ...operation("digest", "digest.txt", bytes), contentHash: `sha256:${"0".repeat(64)}` }]), "AUTHORIZED_CONTENT_HASH_DIVERGED"],
      ["base64", addressedPlan([{ ...operation("base64", "base64.txt", bytes), contentBase64: "not canonical base64" }]), "CANONICAL_BASE64_REQUIRED"],
      ["collision", addressedPlan([operation("one", "collision.txt", bytes), operation("two", "collision.txt", Buffer.from("different"))]), "DIVERGENT_TARGET_COLLISION_REJECTED"],
      ["shape-collision", addressedPlan([operation("file", "shape", bytes), operation("child", "shape/child.txt", bytes)]), "TARGET_PATH_SHAPE_COLLISION_REJECTED"],
      ["empty", addressedPlan([]), "EMPTY_MATERIALIZATION_BATCH_REJECTED"]
    ];

    for (const [name, plan, expected] of vectors) {
      const target = path.join(base, name);
      const outcome = await invoke(target, plan, name);
      assert.equal(outcome.outcomeVariant, "REQUEST_REJECTED");
      assert.equal(outcome.effect.failure.code, expected);
      assert.deepEqual(outcome.effect.operations, []);
      assert.equal(JSON.stringify(outcome).includes(bytes.toString("base64")), false);
      assert.equal(await exists(target), false);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("existence policy distinguishes exact replay from a divergent or forbidden existing target", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-external-materialization-existing-"));
  try {
    const target = path.join(base, "target");
    const bytes = Buffer.from("exact");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "artifact.bin"), bytes);

    const exclusive = await invoke(target, addressedPlan([operation("exclusive", "artifact.bin", bytes, "must-not-exist")]));
    assert.equal(exclusive.outcomeVariant, "REQUEST_REJECTED");
    assert.equal(exclusive.effect.failure.code, "AUTHORIZED_TARGET_EXISTENCE_DIVERGED");
    const divergent = await invoke(target, addressedPlan([operation("divergent", "artifact.bin", Buffer.from("different"))]));
    assert.equal(divergent.outcomeVariant, "REQUEST_REJECTED");
    assert.equal(divergent.effect.failure.code, "AUTHORIZED_EXISTING_TARGET_HASH_DIVERGED");

    const replay = await invoke(target, addressedPlan([operation("matching", "artifact.bin", bytes)]));
    assert.equal(replay.outcomeVariant, "EFFECT_OBSERVED");
    assert.equal(replay.effect.operations[0].result, "satisfied");
    assert.deepEqual(await readFile(path.join(target, "artifact.bin")), bytes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("a symbolic-link segment cannot redirect materialization outside the authorized root", async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-external-materialization-link-"));
  try {
    const target = path.join(base, "target");
    const outside = path.join(base, "outside");
    await mkdir(target); await mkdir(outside);
    try {
      await symlink(outside, path.join(target, "redirect"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error?.code)) {
        t.skip(`symbolic links unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    const rejected = await invoke(target, addressedPlan([operation("escape", "redirect/escaped.bin", Buffer.from("escape"))]));
    assert.equal(rejected.outcomeVariant, "REQUEST_REJECTED");
    assert.equal(rejected.effect.failure.code, "SYMBOLIC_LINK_REJECTED");
    assert.equal(await exists(path.join(outside, "escaped.bin")), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
