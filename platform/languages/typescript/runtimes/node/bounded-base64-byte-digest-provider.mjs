import crypto from "node:crypto";

function reject(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isBase64AlphabetCode(code) {
  return (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 43 || code === 47;
}

function bytesFromCanonicalBase64(value) {
  if (typeof value !== "string" || value.length % 4 !== 0) {
    throw reject("BASE64_BYTE_DIGEST_REPRESENTATION_REJECTED");
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64AlphabetCode(value.charCodeAt(index))) {
      throw reject("BASE64_BYTE_DIGEST_REPRESENTATION_REJECTED");
    }
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) {
      throw reject("BASE64_BYTE_DIGEST_REPRESENTATION_REJECTED");
    }
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw reject("BASE64_BYTE_DIGEST_REPRESENTATION_REJECTED");
  return bytes;
}

export async function resolveBoundedBase64ByteDigests(_configuration, request, context) {
  if (request === null || typeof request !== "object" || Array.isArray(request) ||
      !Array.isArray(request.items) || request.items.length === 0) {
    throw reject("BASE64_BYTE_DIGEST_ITEMS_REQUIRED");
  }
  const itemIds = request.items.map((item) => item?.itemId);
  if (itemIds.some((itemId) => typeof itemId !== "string" || itemId.length === 0) ||
      new Set(itemIds).size !== itemIds.length) {
    throw reject("BASE64_BYTE_DIGEST_UNIQUE_ITEM_ID_REQUIRED");
  }
  const observations = request.items.map((item) => {
    const bytes = bytesFromCanonicalBase64(item.bytesBase64);
    const observedDigest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
    if (item.expectedDigest !== undefined && !/^sha256:[0-9a-f]{64}$/.test(item.expectedDigest)) {
      throw reject("BASE64_BYTE_DIGEST_EXPECTED_DIGEST_REJECTED");
    }
    return {
      itemId: item.itemId,
      byteLength: bytes.length,
      observedDigest,
      ...(item.expectedDigest === undefined ? {} : {
        expectedDigest: item.expectedDigest,
        matchesExpected: observedDigest === item.expectedDigest
      })
    };
  });
  return {
    observationType: "bounded-base64-byte-digest-observation.v1",
    bounded: true,
    observed: observations.length,
    observations,
    allExpectedDigestsMatch: observations.every((item) => item.matchesExpected !== false),
    effectLineage: [...(request.effectLineage ?? []), context.rootExecutionId]
  };
}
