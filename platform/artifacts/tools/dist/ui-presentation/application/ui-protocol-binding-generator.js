import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
    }
    return value;
}
export function bindingModelDigest(value) {
    const digestable = { ...value };
    delete digestable["modelDigest"];
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(digestable))).digest("hex")}`;
}
function typescript(model) {
    return `// generated from ${model.modelType}; do not edit\nimport { createHash } from "node:crypto";\nexport const protocolType = "${model.protocolType}" as const;\nexport const protocolSchemaDigest = "${model.protocolSchemaDigest}" as const;\nexport type CapabilityCategory = ${model.capabilityCategories.map((v) => `"${v}"`).join(" | ")};\nexport type EvidenceCapability = ${model.evidenceCapabilities.map((v) => `"${v}"`).join(" | ")};\nexport interface UiCapabilityRequirement { readonly capabilityId: string; readonly category: CapabilityCategory; readonly sourceRefs: readonly string[]; readonly evidenceRequirements: readonly EvidenceCapability[]; }\nexport interface UiEmbodimentPlanV1 { readonly planType: "${model.planType}"; readonly canonicalDigest: \`sha256:\${string}\`; }\nexport function digestCanonicalJson(value: string): string { return "sha256:" + createHash("sha256").update(value).digest("hex"); }\n`;
}
function csharp(model) {
    return `// generated from ${model.modelType}; do not edit\nusing System.Security.Cryptography;\nusing System.Text;\nnamespace ScenarioDriven.Generated;\npublic static class SdaUiProtocolV3 { public const string ProtocolType = "${model.protocolType}"; public const string ProtocolSchemaDigest = "${model.protocolSchemaDigest}"; public static string DigestCanonicalJson(string value) => "sha256:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant(); }\npublic enum CapabilityCategory { ${model.capabilityCategories.join(", ")} }\npublic enum EvidenceCapability { ${model.evidenceCapabilities.join(", ")} }\npublic sealed record UiCapabilityRequirement(string CapabilityId, CapabilityCategory Category, IReadOnlyList<string> SourceRefs, IReadOnlyList<EvidenceCapability> EvidenceRequirements);\npublic sealed record UiEmbodimentPlanV1(string PlanType, string CanonicalDigest);\n`;
}
function java(model) {
    return `// generated from ${model.modelType}; do not edit\npackage scenario.kernel.generated;\nimport java.nio.charset.StandardCharsets;\nimport java.security.MessageDigest;\nimport java.security.NoSuchAlgorithmException;\nimport java.util.List;\npublic final class SdaUiProtocolV3 {\n  public static final String PROTOCOL_TYPE = "${model.protocolType}";\n  public static final String PROTOCOL_SCHEMA_DIGEST = "${model.protocolSchemaDigest}";\n  public enum CapabilityCategory { ${model.capabilityCategories.join(", ")} }\n  public enum EvidenceCapability { ${model.evidenceCapabilities.join(", ")} }\n  public record UiCapabilityRequirement(String capabilityId, CapabilityCategory category, List<String> sourceRefs, List<EvidenceCapability> evidenceRequirements) {}\n  public record UiEmbodimentPlanV1(String planType, String canonicalDigest) {}\n  public static String digestCanonicalJson(String value) { try { return "sha256:" + java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); } }\n  private SdaUiProtocolV3() {}\n}\n`;
}
function kotlin(model) {
    return `// generated from ${model.modelType}; do not edit\npackage scenario.kernel.generated\nimport java.security.MessageDigest\nconst val SDA_UI_PROTOCOL_TYPE = "${model.protocolType}"\nconst val SDA_UI_PROTOCOL_SCHEMA_DIGEST = "${model.protocolSchemaDigest}"\nenum class CapabilityCategory { ${model.capabilityCategories.join(", ")} }\nenum class EvidenceCapability { ${model.evidenceCapabilities.join(", ")} }\ndata class UiCapabilityRequirement(val capabilityId: String, val category: CapabilityCategory, val sourceRefs: List<String>, val evidenceRequirements: List<EvidenceCapability>)\ndata class UiEmbodimentPlanV1(val planType: String, val canonicalDigest: String)\nfun digestCanonicalJson(value: String): String = "sha256:" + MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }\n`;
}
function swift(model) {
    return `// generated from ${model.modelType}; do not edit\nimport Foundation\n#if canImport(CryptoKit)\nimport CryptoKit\n#endif\npublic let sdaUiProtocolType = "${model.protocolType}"\npublic let sdaUiProtocolSchemaDigest = "${model.protocolSchemaDigest}"\npublic enum CapabilityCategory: String, Codable, Sendable { ${model.capabilityCategories.map((v) => `case ${v.toLowerCase()} = "${v}"`).join("; ")} }\npublic enum EvidenceCapability: String, Codable, Sendable { ${model.evidenceCapabilities.map((v) => `case ${v.toLowerCase()} = "${v}"`).join("; ")} }\npublic struct UiCapabilityRequirement: Codable, Sendable { public let capabilityId: String; public let category: CapabilityCategory; public let sourceRefs: [String]; public let evidenceRequirements: [EvidenceCapability] }\npublic struct UiEmbodimentPlanV1: Codable, Sendable { public let planType: String; public let canonicalDigest: String }\n#if canImport(CryptoKit)\npublic func digestCanonicalJson(_ value: String) -> String { "sha256:" + SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined() }\n#endif\n`;
}
function cpp(model) {
    return `// generated from ${model.modelType}; do not edit\n#pragma once\n#include <functional>\n#include <string>\n#include <vector>\nnamespace sda::ui::generated {\ninline constexpr auto protocol_type = "${model.protocolType}";\ninline constexpr auto protocol_schema_digest = "${model.protocolSchemaDigest}";\nenum class capability_category { ${model.capabilityCategories.map((v) => v.toLowerCase()).join(", ")} };\nenum class evidence_capability { ${model.evidenceCapabilities.map((v) => v.toLowerCase()).join(", ")} };\nstruct ui_capability_requirement { std::string capability_id; capability_category category; std::vector<std::string> source_refs; std::vector<evidence_capability> evidence_requirements; };\nstruct ui_embodiment_plan_v1 { std::string plan_type; std::string canonical_digest; };\nusing sha256_hex = std::function<std::string(const std::string&)>;\ninline std::string digest_canonical_json(const std::string& value, const sha256_hex& digest) { return "sha256:" + digest(value); }\n}\n`;
}
function python(model) {
    return `# generated from ${model.modelType}; do not edit\nfrom dataclasses import dataclass\nfrom enum import Enum\nfrom hashlib import sha256\nPROTOCOL_TYPE = "${model.protocolType}"\nPROTOCOL_SCHEMA_DIGEST = "${model.protocolSchemaDigest}"\nclass CapabilityCategory(str, Enum):\n${model.capabilityCategories.map((v) => `    ${v} = "${v}"`).join("\n")}\nclass EvidenceCapability(str, Enum):\n${model.evidenceCapabilities.map((v) => `    ${v} = "${v}"`).join("\n")}\n@dataclass(frozen=True)\nclass UiCapabilityRequirement:\n    capability_id: str\n    category: CapabilityCategory\n    source_refs: tuple[str, ...]\n    evidence_requirements: tuple[EvidenceCapability, ...]\n@dataclass(frozen=True)\nclass UiEmbodimentPlanV1:\n    plan_type: str\n    canonical_digest: str\ndef digest_canonical_json(value: str) -> str:\n    return "sha256:" + sha256(value.encode("utf-8")).hexdigest()\n`;
}
function go(model) {
    return `// Code generated from ${model.modelType}; DO NOT EDIT.\npackage generatedui\nimport ("crypto/sha256"; "encoding/hex")\nconst ProtocolType = "${model.protocolType}"\nconst ProtocolSchemaDigest = "${model.protocolSchemaDigest}"\ntype CapabilityCategory string\nconst (${model.capabilityCategories.map((v) => ` CapabilityCategory${v.replaceAll("_", "")} CapabilityCategory = "${v}"`).join(";")})\ntype EvidenceCapability string\nconst (${model.evidenceCapabilities.map((v) => ` EvidenceCapability${v} EvidenceCapability = "${v}"`).join(";")})\ntype UiCapabilityRequirement struct { CapabilityID string; Category CapabilityCategory; SourceRefs []string; EvidenceRequirements []EvidenceCapability }\ntype UiEmbodimentPlanV1 struct { PlanType string; CanonicalDigest string }\nfunc DigestCanonicalJSON(value string) string { sum := sha256.Sum256([]byte(value)); return "sha256:" + hex.EncodeToString(sum[:]) }\n`;
}
const OUTPUTS = {
    typescript: { path: "languages/typescript/src/generated/ui-protocol-v3.generated.ts", render: typescript },
    csharp: { path: "languages/csharp/src/ScenarioKernel.Contracts/Generated/UiProtocolV3.Generated.cs", render: csharp },
    java: { path: "languages/java/src/main/java/scenario/kernel/generated/SdaUiProtocolV3.java", render: java },
    kotlin: { path: "languages/kotlin/presentation/android-compose/runtime/src/main/kotlin/scenario/kernel/generated/UiProtocolV3.generated.kt", render: kotlin },
    swift: { path: "languages/swift/presentation/swiftui/Sources/ScenarioKernelSwiftUI/Generated/UiProtocolV3.generated.swift", render: swift },
    cpp: { path: "languages/cpp/generated/include/sda/ui_protocol_v3.generated.hpp", render: cpp },
    python: { path: "languages/python/src/scenario_kernel/generated/ui_protocol_v3.py", render: python },
    go: { path: "languages/go/generatedui/ui_protocol_v3.generated.go", render: go }
};
export function generateUiProtocolBindings(repositoryRoot) {
    const modelPath = path.join(repositoryRoot, "capabilities", "sda-platform", "generate-ui-protocol-bindings", "ui-protocol-binding-model.v1.json");
    const identityPath = path.join(repositoryRoot, "capabilities", "sda-platform", "ui-presentation-protocol", "successor.identity.json");
    const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
    const identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
    if (bindingModelDigest(model) !== model.modelDigest)
        throw new Error("UI_PROTOCOL_BINDING_MODEL_DIGEST_MISMATCH");
    if (model.protocolSchemaDigest !== identity.schemaDigest)
        throw new Error("UI_PROTOCOL_BINDING_SCHEMA_DIGEST_MISMATCH");
    return Object.freeze(model.languages.map((language) => {
        const output = OUTPUTS[language];
        if (!output)
            throw new Error(`UNSUPPORTED_UI_PROTOCOL_BINDING_LANGUAGE:${language}`);
        return Object.freeze({ language, relativePath: output.path, content: output.render(model) });
    }));
}
export function writeUiProtocolBindings(repositoryRoot) {
    const generated = generateUiProtocolBindings(repositoryRoot);
    for (const binding of generated) {
        const destination = path.join(repositoryRoot, binding.relativePath);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, binding.content, "utf8");
    }
    return generated;
}
