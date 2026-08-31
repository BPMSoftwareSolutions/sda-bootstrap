import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../contracts/ajv-schema-admission.cjs";
import { NodeAuthoritySourceInspector } from "./node-authority-source-inspector.js";
import { languageEcosystemRoot } from "../workspace/language-ecosystem-root.js";
function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
    }
    return value;
}
function derivedFact(sourceRef, value, observedAt) {
    const encoded = JSON.stringify(canonical(value));
    return Object.freeze({ sourceRef, digest: digest(encoded), observedAt, value });
}
function jsonFact(filePath, observedAt) {
    const encoded = fs.readFileSync(filePath, "utf8");
    return Object.freeze({
        sourceRef: filePath,
        digest: digest(encoded),
        observedAt,
        value: JSON.parse(encoded)
    });
}
export class NodeAuthorityConformanceRepository {
    repositoryRoot;
    clock;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
    }
    load(language) {
        const observedAt = this.clock.now();
        const ecosystemRoot = languageEcosystemRoot(this.repositoryRoot, language);
        const bindingDirectory = path.join(ecosystemRoot, "binding");
        if (!fs.existsSync(bindingDirectory))
            throw new Error(`No language binding directory for '${language}'.`);
        const bindingFiles = fs.readdirSync(bindingDirectory).filter((file) => file.endsWith(".binding.json"));
        if (bindingFiles.length !== 1 || !bindingFiles[0]) {
            throw new Error(`Expected exactly one language binding for '${language}', found ${bindingFiles.length}.`);
        }
        const binding = JSON.parse(fs.readFileSync(path.join(bindingDirectory, bindingFiles[0]), "utf8"));
        if (typeof binding.implementationId !== "string") {
            throw new Error(`Language binding for '${language}' has no implementationId.`);
        }
        const manifestPath = path.join(ecosystemRoot, "conformance", `${binding.implementationId}.conformance.json`);
        const authorityPath = path.join(this.repositoryRoot, "kernel", "contracts", "execution", "scenario-kernel-data-authority.json");
        const canonicalAuthority = jsonFact(authorityPath, observedAt);
        if (!fs.existsSync(manifestPath)) {
            return {
                language,
                manifestPath,
                manifest: null,
                manifestValidation: null,
                canonicalAuthority,
                sourceInspection: null
            };
        }
        const manifest = jsonFact(manifestPath, observedAt);
        const schemas = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"));
        const validationResult = schemas.validate(manifest.value, "scenario-kernel-implementation-conformance.schema.json");
        const manifestValid = validationResult.errors.filter((error) => error.instancePath === "/dataAuthority" || error.instancePath.startsWith("/dataAuthority/")).length === 0;
        const sourceInspection = new NodeAuthoritySourceInspector(this.repositoryRoot).inspect(language, manifest.value);
        return {
            language,
            manifestPath,
            manifest,
            manifestValidation: derivedFact(`${manifestPath}#/dataAuthority-validation`, { valid: manifestValid }, observedAt),
            canonicalAuthority,
            sourceInspection: derivedFact(`${manifestPath}#/source-inspection`, sourceInspection, observedAt)
        };
    }
}
