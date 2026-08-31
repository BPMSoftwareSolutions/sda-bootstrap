import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { decodedFileSourceBytes, MAX_SOURCE_BYTES, parsedFileSourceEnvelope, UI_FILE_SOURCE_TYPE } from "./file-source-envelope.js";
function admittedTextMediaType(mediaType) {
    return mediaType.startsWith("text/") || mediaType === "application/json";
}
export class NodeTextSourceObservationProvider {
    providerId = "sda-node-text-source-observation.v1";
    admit(sourceValue) {
        const parsed = parsedFileSourceEnvelope(sourceValue);
        if (!parsed.candidate)
            return { disposition: "NOT_APPLICABLE" };
        if (!parsed.envelope) {
            return {
                disposition: "UNSUPPORTED",
                sourceType: UI_FILE_SOURCE_TYPE,
                code: "SOURCE_OBSERVATION_ENVELOPE_INVALID",
                reason: "fileName, mediaType, and canonical contentBase64 are required."
            };
        }
        const bytes = decodedFileSourceBytes(parsed.envelope);
        if (!bytes) {
            return {
                disposition: "UNSUPPORTED",
                sourceType: UI_FILE_SOURCE_TYPE,
                mediaType: parsed.envelope.mediaType,
                code: "SOURCE_OBSERVATION_ENVELOPE_INVALID",
                reason: "contentBase64 must be canonical Base64."
            };
        }
        if (bytes.length > MAX_SOURCE_BYTES) {
            return {
                disposition: "UNSUPPORTED",
                sourceType: UI_FILE_SOURCE_TYPE,
                mediaType: parsed.envelope.mediaType,
                code: "SOURCE_OBSERVATION_SIZE_LIMIT_EXCEEDED",
                reason: `source bytes exceed the ${MAX_SOURCE_BYTES}-byte reference-provider limit.`
            };
        }
        if (!admittedTextMediaType(parsed.envelope.mediaType)) {
            return {
                disposition: "UNSUPPORTED",
                sourceType: UI_FILE_SOURCE_TYPE,
                mediaType: parsed.envelope.mediaType,
                code: "SOURCE_OBSERVATION_MEDIA_TYPE_NOT_SUPPORTED",
                reason: `provider '${this.providerId}' admits UTF-8 text media only.`
            };
        }
        return {
            disposition: "SUPPORTED",
            sourceType: UI_FILE_SOURCE_TYPE,
            mediaType: parsed.envelope.mediaType
        };
    }
    async observe(request) {
        const admission = this.admit(request.sourceValue);
        if (admission.disposition !== "SUPPORTED") {
            const code = admission.disposition === "UNSUPPORTED"
                ? admission.code
                : "SOURCE_OBSERVATION_NOT_APPLICABLE";
            const reason = admission.disposition === "UNSUPPORTED"
                ? admission.reason
                : "source value is not a file-source envelope.";
            throw new Error(`${code}: ${reason}`);
        }
        const envelope = parsedFileSourceEnvelope(request.sourceValue).envelope;
        const bytes = decodedFileSourceBytes(envelope);
        let text;
        try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        catch {
            throw new Error("SOURCE_OBSERVATION_TEXT_ENCODING_INVALID: source bytes are not valid UTF-8.");
        }
        const contentDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
        const observation = Object.freeze({
            observationType: "consumer-source-observation.v1",
            sourceType: UI_FILE_SOURCE_TYPE,
            sourceRole: request.sourceRole,
            fileName: envelope.fileName,
            mediaType: envelope.mediaType,
            byteLength: bytes.length,
            contentDigest,
            text
        });
        return Object.freeze({
            disposition: "OBSERVED",
            observation,
            evidence: Object.freeze({
                evidenceType: "consumer-source-observation-evidence.v1",
                providerId: this.providerId,
                sourceType: UI_FILE_SOURCE_TYPE,
                sourceRole: request.sourceRole,
                mediaType: envelope.mediaType,
                byteLength: bytes.length,
                contentDigest
            })
        });
    }
}
