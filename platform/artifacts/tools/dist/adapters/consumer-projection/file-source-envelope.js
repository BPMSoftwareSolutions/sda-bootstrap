export const UI_FILE_SOURCE_TYPE = "ui-file-source-envelope.v1";
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parsedFileSourceEnvelope(sourceValue) {
    if (typeof sourceValue !== "string")
        return { candidate: false };
    let parsed;
    try {
        parsed = JSON.parse(sourceValue);
    }
    catch {
        return { candidate: false };
    }
    if (!isRecord(parsed))
        return { candidate: false };
    const candidate = ["fileName", "mediaType", "contentBase64"].some((property) => Object.prototype.hasOwnProperty.call(parsed, property));
    if (!candidate)
        return { candidate: false };
    const properties = Object.keys(parsed).sort();
    if (properties.length !== 3 ||
        properties[0] !== "contentBase64" ||
        properties[1] !== "fileName" ||
        properties[2] !== "mediaType" ||
        typeof parsed.fileName !== "string" || parsed.fileName.trim().length === 0 ||
        typeof parsed.mediaType !== "string" || parsed.mediaType.trim().length === 0 ||
        typeof parsed.contentBase64 !== "string") {
        return { candidate: true };
    }
    return {
        candidate: true,
        envelope: {
            fileName: parsed.fileName.trim(),
            mediaType: parsed.mediaType.trim().toLowerCase(),
            contentBase64: parsed.contentBase64
        }
    };
}
export function decodedFileSourceBytes(envelope) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.contentBase64)) {
        return null;
    }
    const bytes = Buffer.from(envelope.contentBase64, "base64");
    return bytes.toString("base64") === envelope.contentBase64 ? bytes : null;
}
