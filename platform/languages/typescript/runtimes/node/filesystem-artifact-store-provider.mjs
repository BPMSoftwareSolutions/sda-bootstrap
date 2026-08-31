import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { valueAt } from "./native-mechanic-primitives.mjs";

function resolveTestArtifactRoot(testArtifactContext) {
  if (!testArtifactContext || testArtifactContext.testExecution !== true ||
    typeof testArtifactContext.testArtifactRoot !== "string" ||
    typeof testArtifactContext.testArtifactRootMarker !== "string") {
    throw new Error("TEST_ARTIFACT_ROOT_CONTEXT_INVALID");
  }
  const root = testArtifactContext.testArtifactRoot;
  if (!path.isAbsolute(root) || !fs.existsSync(root) || !fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) {
    throw new Error("TEST_ARTIFACT_ROOT_INVALID");
  }
  const markerPath = path.join(root, ".sda-test-artifact-root.json");
  if (!fs.existsSync(markerPath) || fs.lstatSync(markerPath).isSymbolicLink()) throw new Error("TEST_ARTIFACT_ROOT_NOT_OWNED");
  let marker;
  try { marker = JSON.parse(fs.readFileSync(markerPath, "utf8")); }
  catch { throw new Error("TEST_ARTIFACT_ROOT_NOT_OWNED"); }
  if (marker?.marker !== testArtifactContext.testArtifactRootMarker || marker?.root !== root) {
    throw new Error("TEST_ARTIFACT_ROOT_NOT_OWNED");
  }
  return fs.realpathSync(root);
}

export function storeArtifact(configuration, input, context, bindingUrl, testArtifactContext) {
  const content = valueAt(input, configuration.contentPath);
  if (typeof content !== "string") throw new Error("ARTIFACT_CONTENT_MISSING");
  const contentEncoding = configuration.encoding ?? "utf8";
  const contentBytes = Buffer.from(content, contentEncoding);
  const contentByteDigest = crypto.createHash("sha256").update(contentBytes).digest("hex");
  testArtifactContext ??= context?.testArtifactContext;
  const projectedRoot = testArtifactContext === undefined
    ? path.dirname(fileURLToPath(bindingUrl))
    : resolveTestArtifactRoot(testArtifactContext);
  const dynamicDirectory = configuration.directoryPath === undefined
    ? undefined
    : valueAt(input, configuration.directoryPath);
  const declaredDirectory = configuration.directory ?? dynamicDirectory;
  if (typeof declaredDirectory !== "string" || declaredDirectory.length === 0 || path.isAbsolute(declaredDirectory)) {
    throw new Error("ARTIFACT_DIRECTORY_INVALID");
  }
  const directory = path.resolve(projectedRoot, declaredDirectory);
  if (!(directory + path.sep).startsWith(projectedRoot + path.sep)) {
    throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: artifact directory escapes the projected workspace.");
  }
  const segments = declaredDirectory.split(/[\\/]+/);
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("ARTIFACT_DIRECTORY_INVALID");
  }
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
    throw new Error("ARTIFACT_DIRECTORY_SYMLINK_REJECTED");
  }
  const relativeDirectory = path.relative(projectedRoot, directory);
  let cursor = projectedRoot;
  for (const segment of relativeDirectory.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error("ARTIFACT_DIRECTORY_SYMBOLIC_LINK_REJECTED");
    }
  }
  fs.mkdirSync(directory, { recursive: true });
  const dynamicName = configuration.logicalNamePath === undefined
    ? undefined
    : valueAt(input, configuration.logicalNamePath);
  const logicalName = configuration.logicalNameFromContentSha256 === true
    ? `${contentByteDigest}${configuration.logicalNameSuffix ?? ""}`
    : configuration.logicalName ?? (typeof dynamicName === "string"
      ? `${dynamicName}${configuration.logicalNameSuffix ?? ""}`
      : undefined);
  if (typeof logicalName !== "string" || logicalName.length === 0 || logicalName !== path.basename(logicalName)) {
    throw new Error("ARTIFACT_LOGICAL_NAME_INVALID");
  }
  const destination = path.join(directory, logicalName);
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
    throw new Error("ARTIFACT_DESTINATION_SYMBOLIC_LINK_REJECTED");
  }
  if (configuration.existingDestinationPolicy === "reject" && fs.existsSync(destination)) {
    throw new Error("ARTIFACT_DESTINATION_EXISTS");
  }
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, { encoding: contentEncoding });
  fs.renameSync(temporary, destination);
  const result = structuredClone(input);
  const target = valueAt(result, configuration.targetPath);
  if (!target || typeof target !== "object") throw new Error("ARTIFACT_REFERENCE_TARGET_MISSING");
  target.path = destination;
  target.sha256 = crypto.createHash("sha256").update(content).digest("hex");
  target.byteSha256 = `sha256:${contentByteDigest}`;
  target.byteLength = contentBytes.length;
  target.rootExecutionId = context.rootExecutionId;
  return result;
}
