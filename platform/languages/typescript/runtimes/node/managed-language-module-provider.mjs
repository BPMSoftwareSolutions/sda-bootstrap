import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

function digest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function safeRelativePath(reference) {
  if (typeof reference !== "string" || reference.length === 0 || reference.includes("\0") ||
      path.posix.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
    throw new Error("MANAGED_LANGUAGE_MODULE_FILE_REFERENCE_REJECTED");
  }
  const segments = reference.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("MANAGED_LANGUAGE_MODULE_FILE_REFERENCE_REJECTED");
  }
  return segments;
}

function readModuleAuthority(configuration, bindingUrl) {
  if (configuration?.moduleAuthorityRef !== "../execution-authorities.authority.json" ||
      typeof configuration?.moduleId !== "string" || configuration.moduleId.length === 0 ||
      typeof configuration?.exportName !== "string" || configuration.exportName.length === 0) {
    throw new Error("MANAGED_LANGUAGE_MODULE_BINDING_INCOMPLETE");
  }
  const authorityUrl = new URL(configuration.moduleAuthorityRef, bindingUrl);
  if (authorityUrl.protocol !== "file:") throw new Error("MANAGED_LANGUAGE_MODULE_AUTHORITY_PROTOCOL_REJECTED");
  const authority = JSON.parse(fs.readFileSync(fileURLToPath(authorityUrl), "utf8"));
  const moduleAuthority = authority?.languageModules?.find(({ moduleId }) => moduleId === configuration.moduleId);
  if (!moduleAuthority || moduleAuthority.authorityType !== "managed-language-module-authority.v1" ||
      moduleAuthority.language !== "javascript-esm" || !Array.isArray(moduleAuthority.files) ||
      moduleAuthority.files.length === 0 || typeof moduleAuthority.entry !== "string" ||
      !Array.isArray(moduleAuthority.exports) || !moduleAuthority.exports.includes(configuration.exportName)) {
    throw new Error("MANAGED_LANGUAGE_MODULE_AUTHORITY_NOT_ADMITTED");
  }
  return moduleAuthority;
}

export async function invokeManagedLanguageModule(configuration, input, bindingUrl) {
  const authority = readModuleAuthority(configuration, bindingUrl);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-managed-module-"));
  try {
    for (const file of authority.files) {
      const segments = safeRelativePath(file.path);
      if (typeof file.source !== "string" || digest(Buffer.from(file.source, "utf8")) !== file.sourceDigest) {
        throw new Error(`MANAGED_LANGUAGE_MODULE_SOURCE_DIGEST_MISMATCH:${file.path}`);
      }
      const target = path.join(workspace, ...segments);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.source, "utf8");
    }
    const entrySegments = safeRelativePath(authority.entry);
    const entryPath = path.join(workspace, ...entrySegments);
    if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
      throw new Error("MANAGED_LANGUAGE_MODULE_ENTRY_UNAVAILABLE");
    }
    const module = await import(`${pathToFileURL(entryPath).href}?authority=${encodeURIComponent(digest(Buffer.from(JSON.stringify(authority), "utf8")))}`);
    const operation = module[configuration.exportName];
    if (typeof operation !== "function") throw new Error("MANAGED_LANGUAGE_MODULE_EXPORT_UNAVAILABLE");
    return await operation(structuredClone(input));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
