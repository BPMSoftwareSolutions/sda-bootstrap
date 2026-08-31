import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../contracts/ajv-schema-admission.cjs";
import { languageEcosystemRoot } from "./language-ecosystem-root.js";
function sha256(content) {
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
    return Object.freeze({ sourceRef, digest: sha256(JSON.stringify(canonical(value))), observedAt, value });
}
function jsonFact(filePath, observedAt) {
    const encoded = fs.readFileSync(filePath, "utf8");
    return Object.freeze({
        sourceRef: filePath,
        digest: sha256(encoded),
        observedAt,
        value: JSON.parse(encoded)
    });
}
function jsonFiles(directory) {
    if (!fs.existsSync(directory))
        return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const resolved = path.join(directory, entry.name);
        return entry.isDirectory() ? jsonFiles(resolved) : entry.name.endsWith(".json") ? [resolved] : [];
    }).sort();
}
function kernelImplementationConformanceFiles(directory) {
    return jsonFiles(directory).filter((file) => path.basename(file).endsWith(".conformance.json"));
}
export class NodeWorkspaceGovernanceRepository {
    repositoryRoot;
    clock;
    schemas;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
        this.schemas = new AjvSchemaAdmission(path.join(repositoryRoot, "kernel", "schemas"));
    }
    loadGovernedPlacement() {
        const observedAt = this.clock.now();
        const conformanceRoot = path.join(this.repositoryRoot, "conformance");
        const corpusExecutionDirectory = path.join(conformanceRoot, "corpus", "execution");
        const expectationsExecutionDirectory = path.join(conformanceRoot, "expectations", "execution");
        const validatedDocuments = (directory, schema) => jsonFiles(directory).map((file) => {
            const fact = jsonFact(file, observedAt);
            const validation = this.schemas.validate(fact.value, schema);
            return { fact, validation: derivedFact(`${file}#/validation`, validation, observedAt) };
        });
        const plainDocuments = (files) => files.map((file) => ({ fact: jsonFact(file, observedAt) }));
        const languagesRoot = path.join(this.repositoryRoot, "languages");
        const languageClaims = fs.existsSync(languagesRoot)
            ? fs.readdirSync(languagesRoot, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .flatMap((entry) => kernelImplementationConformanceFiles(path.join(languagesRoot, entry.name, "conformance")))
                .sort()
            : [];
        return {
            corpusExecutionDirectory,
            expectationsExecutionDirectory,
            fixtures: validatedDocuments(corpusExecutionDirectory, "scenario-execution-vector-fixture.schema.json"),
            expectations: validatedDocuments(expectationsExecutionDirectory, "scenario-execution-vector-expectation.schema.json"),
            languageConformanceClaims: plainDocuments(languageClaims),
            sharedConformanceDocuments: plainDocuments(jsonFiles(conformanceRoot))
        };
    }
    loadLanguageDeclaration(language) {
        const observedAt = this.clock.now();
        const ecosystemRoot = languageEcosystemRoot(this.repositoryRoot, language);
        const bindingDirectory = path.join(ecosystemRoot, "binding");
        if (!fs.existsSync(bindingDirectory))
            throw new Error(`No language binding directory for '${language}'.`);
        const bindingFiles = fs.readdirSync(bindingDirectory).filter((file) => file.endsWith(".binding.json")).sort();
        if (bindingFiles.length !== 1 || !bindingFiles[0]) {
            throw new Error(`Expected exactly one language binding for '${language}', found ${bindingFiles.length}.`);
        }
        const binding = jsonFact(path.join(bindingDirectory, bindingFiles[0]), observedAt);
        const implementationId = binding.value["implementationId"];
        if (typeof implementationId !== "string")
            throw new Error(`Language binding for '${language}' has no implementationId.`);
        const manifestPath = path.join(ecosystemRoot, "conformance", `${implementationId}.conformance.json`);
        const bindingValidation = this.schemas.validate(binding.value, "language-binding.schema.json");
        if (!fs.existsSync(manifestPath)) {
            return {
                language,
                binding,
                bindingValidation: derivedFact(`${binding.sourceRef}#/validation`, bindingValidation, observedAt),
                manifestPath,
                manifest: null,
                manifestValidation: null
            };
        }
        const manifest = jsonFact(manifestPath, observedAt);
        const manifestValidation = this.schemas.validate(manifest.value, "scenario-kernel-implementation-conformance.schema.json");
        return {
            language,
            binding,
            bindingValidation: derivedFact(`${binding.sourceRef}#/validation`, bindingValidation, observedAt),
            manifestPath,
            manifest,
            manifestValidation: derivedFact(`${manifestPath}#/validation`, manifestValidation, observedAt)
        };
    }
}
