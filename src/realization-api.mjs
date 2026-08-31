#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCollapsedRepository,
  capabilityIdFromBindingRef,
  expandEstate,
  inspectCapsule,
  invokeCapability,
  listCapsules,
  loadEstate,
  projectEstate,
  proveDirectExecution,
  resolveEstate,
  verifyEstate
} from "./capsule-manager.mjs";

const entryPath = fileURLToPath(import.meta.url);
const managerPath = fileURLToPath(new URL("./capsule-manager.mjs", import.meta.url));
const deliveryCapabilityId = "deliver-realization-api";
const runtimeRef = "package:sda-bootstrap/platform/languages/typescript/runtimes/node/admitted-consumer-platform.mjs";
const projectorRef = "package:sda-bootstrap/platform/artifacts/tools/dist/interfaces/consumer-projection/project.js";
const state = { plans: new Map(), projections: new Map(), realizationRoots: [] };

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function delivery(operation) {
  const result = await invokeCapability(deliveryCapabilityId, {
    contractId: "realization-api-delivery-request.v1",
    payload: { operation }
  });
  if (result.disposition !== "terminated" || result.outcome?.contractId !== "realization-api-delivery-result.v1") {
    throw new Error("REALIZATION_API_DELIVERY_NOT_ADMITTED");
  }
  return result.outcome;
}

function hostProfile() {
  const platform = os.platform();
  return {
    os: platform === "win32" ? "windows" : platform === "darwin" ? "macos" : platform,
    architecture: os.arch() === "arm64" ? "arm64" : "x64"
  };
}

function normalizeTarget(target) {
  return {
    os: String(target?.os ?? "").toLowerCase(),
    architecture: String(target?.architecture ?? "").toLowerCase()
  };
}

function planRealization(body) {
  const capabilityId = body?.capabilityId;
  if (typeof capabilityId !== "string" || !capabilityId) throw httpError(400, "CAPABILITY_ID_REQUIRED");
  const target = normalizeTarget(body.target);
  if (!["windows", "macos", "linux"].includes(target.os) || !["x64", "arm64"].includes(target.architecture)) {
    throw httpError(400, "TARGET_PROFILE_REQUIRED: { os: 'windows'|'macos'|'linux', architecture: 'x64'|'arm64' }.");
  }
  const estate = loadEstate();
  verifyEstate(estate);
  resolveEstate(estate);
  const inspected = inspectCapsule(capabilityId, estate);
  const host = hostProfile();
  const eligible = target.os === host.os && target.architecture === host.architecture;
  const planId = crypto.randomUUID();
  const plan = {
    planId,
    capabilityId,
    capsuleDigest: inspected.capsuleDigest,
    capabilityAuthorityDigest: inspected.capabilityAuthorityDigest,
    target,
    host,
    resolvedRuntime: "node",
    requiredProviders: [
      { role: "capsule-resolver", ref: "package:sda-bootstrap/src/capsule-manager.mjs", digest: sha256(fs.readFileSync(managerPath)) },
      { role: "semantic-execution", ref: runtimeRef },
      { role: "projection-engine", ref: projectorRef },
      { role: "filesystem-artifact-delivery", ref: "owned-disposable-realization-root" },
      ...inspected.declaredDependencies.map((dependency) => ({
        role: "declared-dependency",
        capabilityId: capabilityIdFromBindingRef(dependency.bindingRef),
        bindingRef: dependency.bindingRef,
        bindingDigest: dependency.bindingDigest,
        capabilityAuthorityDigest: dependency.capabilityAuthorityDigest
      }))
    ],
    projectionEligibility: eligible ? "eligible" : "unavailable",
    disposition: eligible ? "REALIZATION_PLANNABLE" : "REALIZATION_TARGET_UNAVAILABLE",
    requestedExperience: body.requestedExperience ?? "cli",
    activation: body.activation ?? "on-demand",
    durableLayout: assertCollapsedRepository()
  };
  state.plans.set(planId, plan);
  return plan;
}

function assertOwnedRealizationRoot(root) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const relative = path.relative(temporaryRoot, root);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !path.basename(root).startsWith("sda-bootstrap-realization-")) {
    throw new Error(`REALIZATION_ROOT_NOT_OWNED: '${root}'.`);
  }
}

function disposeRealizationRoots() {
  for (const root of state.realizationRoots) {
    const marker = path.join(root, ".capsule-realization-root.json");
    try {
      if (fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, "utf8")).root === root) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    } catch {
    }
  }
  state.realizationRoots = [];
}

function sweepOrphanedRealizationRoots() {
  const temporaryRoot = path.resolve(os.tmpdir());
  let swept = 0;
  for (const name of fs.readdirSync(temporaryRoot)) {
    if (!name.startsWith("sda-bootstrap-realization-")) continue;
    const root = path.join(temporaryRoot, name);
    const marker = path.join(root, ".capsule-realization-root.json");
    try {
      if (fs.statSync(root).isDirectory() && fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, "utf8")).root === root) {
        fs.rmSync(root, { recursive: true, force: true });
        swept++;
      }
    } catch {
    }
  }
  return swept;
}

async function projectRealization(body) {
  const planId = body?.planId;
  const plan = planId ? state.plans.get(planId) : null;
  if (planId && !plan) throw httpError(404, `PLAN_NOT_FOUND: '${planId}'.`);
  const admittedPlan = plan ?? planRealization(body);
  if (admittedPlan.disposition !== "REALIZATION_PLANNABLE") {
    throw httpError(409, `REALIZATION_TARGET_UNAVAILABLE: requested '${admittedPlan.target.os}/${admittedPlan.target.architecture}', host '${admittedPlan.host.os}/${admittedPlan.host.architecture}'.`);
  }
  const capabilityId = admittedPlan.capabilityId;
  const projectionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  state.projections.set(projectionId, { projectionId, capabilityId, status: "PROJECTING", createdAt, receipt: null, error: null });
  const estate = loadEstate();
  try {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-realization-"));
    assertOwnedRealizationRoot(root);
    const marker = path.join(root, ".capsule-realization-root.json");
    fs.writeFileSync(marker, JSON.stringify({ realizationRootType: "sidefx-realization-root.v1", root }), "utf8");
    state.realizationRoots.push(root);
    const expansion = expandEstate(estate, root);
    const projection = await projectEstate(estate, root);
    const directExecution = await proveDirectExecution(estate, new Set([capabilityId]));
    const projectedRoot = path.join(root, "capabilities", capabilityId, "projected");
    const bindingPath = path.join(projectedRoot, "application-binding.node.json");
    const bindingBytes = fs.readFileSync(bindingPath);
    const binding = JSON.parse(bindingBytes.toString("utf8"));
    const artifactReferences = [
      { kind: "realization-root", ref: root },
      { kind: "application-binding", ref: path.relative(root, bindingPath), digest: sha256(bindingBytes) },
      { kind: "execution-plan", ref: path.relative(root, path.resolve(projectedRoot, binding.executionPlan)), digest: sha256(fs.readFileSync(path.resolve(projectedRoot, binding.executionPlan))) },
      { kind: "fixtures", ref: path.relative(root, path.resolve(projectedRoot, binding.fixtures)), digest: sha256(fs.readFileSync(path.resolve(projectedRoot, binding.fixtures))) },
      { kind: "projection-conformance", ref: path.relative(root, path.resolve(projectedRoot, binding.mechanicalSterility)), digest: sha256(fs.readFileSync(path.resolve(projectedRoot, binding.mechanicalSterility))) }
    ];
    const receipt = {
      receiptType: "sidefx-realization-receipt.v1",
      realizationId: projectionId,
      capabilityId,
      capsuleDigest: admittedPlan.capsuleDigest,
      capabilityAuthorityDigest: admittedPlan.capabilityAuthorityDigest,
      targetProfile: { ...admittedPlan.target, host: "local-conformant" },
      projectionProfile: "node",
      runtime: { target: "node", ref: runtimeRef },
      providerBindings: admittedPlan.requiredProviders,
      projectionDigest: sha256(bindingBytes),
      conformanceDisposition: "DIRECT_EXECUTION_CONFORMANT",
      conformanceEvidence: directExecution,
      expansion,
      projection,
      artifactReferences,
      createdAt,
      completedAt: new Date().toISOString()
    };
    state.projections.set(projectionId, { projectionId, capabilityId, status: "COMPLETE", createdAt, receipt, error: null });
    return receipt;
  } catch (error) {
    state.projections.set(projectionId, {
      projectionId,
      capabilityId,
      status: "FAILED",
      createdAt,
      receipt: null,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function sendJson(response, status, value) {
  const body = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length });
  response.end(body);
}

function readBody(request, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, "REQUEST_BODY_TOO_LARGE"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function parseJsonBody(body) {
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, "REQUEST_BODY_NOT_JSON");
  }
}

function matchRoute(operation, method, pathname) {
  if (operation.method !== method) return null;
  const expected = operation.path.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].startsWith(":")) params[expected[index].slice(1)] = decodeURIComponent(actual[index]);
    else if (expected[index] !== actual[index]) return null;
  }
  return params;
}

function projectionStatus(projectionId) {
  const projection = state.projections.get(projectionId);
  if (!projection) throw httpError(404, `PROJECTION_NOT_FOUND: '${projectionId}'.`);
  return {
    projectionId: projection.projectionId,
    capabilityId: projection.capabilityId,
    status: projection.status,
    createdAt: projection.createdAt,
    error: projection.error
  };
}

function projectionReceipt(projectionId) {
  const projection = state.projections.get(projectionId);
  if (!projection) throw httpError(404, `PROJECTION_NOT_FOUND: '${projectionId}'.`);
  if (projection.status !== "COMPLETE" || !projection.receipt) {
    throw httpError(409, `PROJECTION_RECEIPT_NOT_AVAILABLE: '${projection.status}'.`);
  }
  return projection.receipt;
}

async function createHandler(api) {
  const handlers = {
    "list-capabilities": async ({ url }) => ({ status: 200, value: listCapsules(loadEstate(), url.searchParams.get("query")) }),
    "inspect-capability": async ({ params }) => ({ status: 200, value: inspectCapsule(params.capabilityId) }),
    "plan-realization": async ({ body }) => ({ status: 201, value: planRealization(body) }),
    "project-capability": async ({ body }) => ({ status: 201, value: await projectRealization(body) }),
    "projection-status": async ({ params }) => ({ status: 200, value: projectionStatus(params.projectionId) }),
    "projection-receipt": async ({ params }) => ({ status: 200, value: projectionReceipt(params.projectionId) })
  };
  for (const operation of api.operations) {
    if (!handlers[operation.operationId]) throw new Error(`REALIZATION_API_OPERATION_NOT_RESOLVED: '${operation.operationId}'.`);
  }
  return async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const operation = api.operations.map((candidate) => ({ candidate, params: matchRoute(candidate, request.method, url.pathname) }))
      .find(({ params }) => params !== null);
    try {
      if (!operation) throw httpError(404, `ROUTE_NOT_ADMITTED: '${request.method} ${url.pathname}'.`);
      await delivery(operation.candidate.operationId);
      const body = request.method === "POST" ? parseJsonBody(await readBody(request)) : {};
      const result = await handlers[operation.candidate.operationId]({ url, params: operation.params, body });
      sendJson(response, result.status, result.value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = error.statusCode ?? (message.startsWith("CAPSULE_NOT_FOUND") ? 404 : 500);
      const code = message.match(/^[A-Z0-9_]+/)?.[0] ?? "REALIZATION_FAILURE";
      sendJson(response, status, { error: { code, message } });
    }
  };
}

async function startServer() {
  const admitted = await delivery("unhandled");
  const { api } = admitted;
  if (api.transport !== "http" || !Array.isArray(api.operations) || api.operations.length === 0) {
    throw new Error("REALIZATION_API_CATALOG_NOT_ADMITTED");
  }
  const swept = sweepOrphanedRealizationRoots();
  const port = Number(process.env.SIDEFX_API_PORT ?? api.port);
  const host = process.env.SIDEFX_API_HOST ?? api.host;
  const server = http.createServer(await createHandler(api));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  process.stdout.write(`SIDEFX_REALIZATION_API_LISTENING: http://${host}:${address.port} swept=${swept}\n`);
  const close = async () => {
    disposeRealizationRoots();
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };
  return { server, api, host, port: address.port, close };
}

async function main() {
  const running = await startServer();
  const shutdown = () => running.close().then(() => process.exit(0), (error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exit(1);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { createHandler, disposeRealizationRoots, startServer };

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(entryPath)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
