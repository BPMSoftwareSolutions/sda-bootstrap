import crypto from "node:crypto";

export async function observeExternalRepresentation(referenceUrl, { method = "GET", allowedHosts } = {}) {
  const url = new URL(referenceUrl);
  if (url.protocol !== "https:") throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: external observation admits https references only.");
  if (!Array.isArray(allowedHosts) || allowedHosts.length === 0 || !allowedHosts.includes(url.hostname)) {
    throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: external reference host is not admitted by source authority.");
  }
  const response = await fetch(url, { method, redirect: "follow" });
  const content = await response.text();
  return {
    sourceReference: referenceUrl,
    status: response.status,
    mediaType: response.headers.get("content-type"),
    observedAt: new Date().toISOString(),
    content,
    contentSha256: crypto.createHash("sha256").update(content).digest("hex")
  };
}
