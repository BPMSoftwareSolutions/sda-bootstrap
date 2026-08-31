import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../contracts/ajv-schema-admission.cjs";
import { languageEcosystemRoot } from "../workspace/language-ecosystem-root.js";
function digest(content) { return `sha256:${createHash("sha256").update(content).digest("hex")}`; }
function canonical(value) { if (Array.isArray(value))
    return value.map(canonical); if (value && typeof value === "object") {
    const record = value;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
} return value; }
function derivedFact(sourceRef, value, observedAt) { return Object.freeze({ sourceRef, digest: digest(JSON.stringify(canonical(value))), observedAt, value }); }
function jsonFact(filePath, observedAt) { const encoded = fs.readFileSync(filePath, "utf8"); return Object.freeze({ sourceRef: filePath, digest: digest(encoded), observedAt, value: JSON.parse(encoded) }); }
function readRecord(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function stringArray(value) { return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []; }
export class NodeConformanceAuthorityRepository {
    repositoryRoot;
    clock;
    schemas;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
        this.schemas = new AjvSchemaAdmission(path.join(repositoryRoot, "kernel", "schemas"));
    }
    discoverObligations() {
        const languagesRoot = path.join(this.repositoryRoot, "languages");
        if (!fs.existsSync(languagesRoot))
            return [];
        return fs.readdirSync(languagesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().flatMap((ecosystem) => { const bindingDirectory = path.join(languagesRoot, ecosystem, "binding"); if (!fs.existsSync(bindingDirectory))
            return []; return fs.readdirSync(bindingDirectory).filter((file) => file.endsWith(".binding.json")).sort().map((file) => { const bindingPath = path.join(bindingDirectory, file); const value = readRecord(bindingPath); const implementationId = value["implementationId"]; if (typeof implementationId !== "string")
            throw new Error(`Binding '${bindingPath}' has no implementationId.`); const declaredLanguage = value["language"]; const language = typeof declaredLanguage === "string" && declaredLanguage.length > 0 ? declaredLanguage : ecosystem; const binding = { ...value, implementationId }; const status = typeof binding["status"] === "string" ? binding["status"] : "UNKNOWN"; return { language, bindingPath, binding, status, isActiveObligation: binding["status"] != null && status !== "DECLARED" }; }); }).sort((left, right) => left.language.localeCompare(right.language));
    }
    loadKernelSpecification() { const observedAt = this.clock.now(); const specificationPath = path.join(this.repositoryRoot, "kernel", "specification", "scenario-kernel.specification.json"); if (!fs.existsSync(specificationPath))
        return { specificationPath, specification: null, validation: null }; const specification = jsonFact(specificationPath, observedAt); const validation = this.schemas.validate(specification.value, "scenario-kernel.schema.json"); return { specificationPath, specification, validation: derivedFact(`${specificationPath}#/validation`, validation, observedAt) }; }
    loadSchemaFamily() { const observedAt = this.clock.now(); const schemasDirectory = path.join(this.repositoryRoot, "kernel", "schemas"); const schemaFiles = this.schemas.listSchemaFiles().map((file) => jsonFact(path.join(schemasDirectory, file), observedAt)); const unresolved = this.schemas.unresolvedSchemaFiles(); return { schemasDirectory, schemaFiles, unresolved: derivedFact(`${schemasDirectory}#/unresolved`, unresolved, observedAt) }; }
    loadExecutionVector() { const observedAt = this.clock.now(); const executionVectorPath = path.join(this.repositoryRoot, "kernel", "contracts", "execution", "scenario-kernel-execution-vector.json"); if (!fs.existsSync(executionVectorPath))
        return { executionVectorPath, executionVector: null, validation: null }; const executionVector = jsonFact(executionVectorPath, observedAt); const validation = this.schemas.validate(executionVector.value, "scenario-kernel-execution-vector.schema.json"); return { executionVectorPath, executionVector, validation: derivedFact(`${executionVectorPath}#/validation`, validation, observedAt) }; }
    loadLanguageImplementation(language) {
        const observedAt = this.clock.now();
        const obligation = this.discoverObligations().find((item) => item.language === language);
        if (!obligation)
            throw new Error(`No language obligation for '${language}'.`);
        const manifestPath = path.join(languageEcosystemRoot(this.repositoryRoot, language), "conformance", `${obligation.binding.implementationId}.conformance.json`);
        const manifest = fs.existsSync(manifestPath) ? jsonFact(manifestPath, observedAt) : null;
        const validationValue = manifest ? this.schemas.validate(manifest.value, "scenario-kernel-implementation-conformance.schema.json") : null;
        const manifestValidation = validationValue ? derivedFact(`${manifestPath}#/validation`, validationValue, observedAt) : null;
        const kernelSchemaPath = path.join(this.repositoryRoot, "kernel", "schemas", "scenario-kernel.schema.json");
        const kernelSchema = readRecord(kernelSchemaPath);
        const properties = kernelSchema["properties"];
        const objects = properties?.["objects"];
        const items = objects?.["items"];
        const canonicalObjectIds = stringArray(items?.["enum"]);
        const vectorPath = path.join(this.repositoryRoot, "kernel", "contracts", "execution", "scenario-kernel-execution-vector.json");
        const vector = readRecord(vectorPath);
        const steps = Array.isArray(vector["steps"]) ? vector["steps"] : [];
        const canonicalStepIds = steps.flatMap((step) => step && typeof step === "object" && typeof step["stepId"] === "string" ? [step["stepId"]] : []);
        const behavioralPath = path.join(this.repositoryRoot, "artifacts", "conformance", "behavioral-observations.json");
        const closurePath = path.join(this.repositoryRoot, "artifacts", "conformance", "execution-closure-observations.json");
        return {
            shape: { language, manifestPath, manifest, manifestValidation, canonicalObjectIds: derivedFact(`${kernelSchemaPath}#/properties/objects/items/enum`, canonicalObjectIds, observedAt) },
            execution: { language, manifestPath, manifest, manifestValidation, canonicalStepIds: derivedFact(`${vectorPath}#/steps`, canonicalStepIds, observedAt) },
            behavioral: { language, observationPath: behavioralPath, observation: this.observationFact(behavioralPath, language, observedAt) },
            executionClosure: { language, observationPath: closurePath, observation: this.observationFact(closurePath, language, observedAt) },
            implementationOrigin: this.implementationOrigin(manifest)
        };
    }
    canonicalFixtures() { const directory = path.join(this.repositoryRoot, "conformance", "corpus", "execution"); return fs.readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => { const value = readRecord(path.join(directory, file)); return { fixtureId: typeof value["fixtureId"] === "string" ? value["fixtureId"] : file, label: file.replace(/\.json$/, "") }; }); }
    observationFact(filePath, language, observedAt) { if (!fs.existsSync(filePath))
        return null; const encoded = fs.readFileSync(filePath, "utf8"); const document = JSON.parse(encoded); const value = document.results?.[language]; return value ? Object.freeze({ sourceRef: `${filePath}#/results/${language}`, digest: digest(JSON.stringify(canonical(value))), observedAt, value }) : null; }
    implementationOrigin(manifest) { if (!manifest)
        return { origin: "UNKNOWN", reason: "no conformance manifest found" }; const objects = Array.isArray(manifest.value["semanticObjects"]) ? manifest.value["semanticObjects"] : []; let projectedCount = 0; let handWrittenCount = 0; const markers = ["GENERATED by tools/projection", "GENERATED by tools/src/projection", "Code generated by tools/src/projection", "Code generated from languages/"]; for (const object of objects) {
        if (!object || typeof object !== "object")
            continue;
        const embodiment = object["embodiment"];
        if (!embodiment || typeof embodiment !== "object")
            continue;
        const sourceRef = embodiment["sourceRef"];
        if (typeof sourceRef !== "string")
            continue;
        const sourcePath = path.join(this.repositoryRoot, sourceRef);
        if (!fs.existsSync(sourcePath))
            continue;
        const content = fs.readFileSync(sourcePath, "utf8");
        if (markers.some((marker) => content.includes(marker)))
            projectedCount += 1;
        else
            handWrittenCount += 1;
    } if (projectedCount === 0 && handWrittenCount === 0)
        return { origin: "UNKNOWN", reason: "no semanticObjects entry declares a resolvable embodiment.sourceRef" }; return { origin: projectedCount > 0 && handWrittenCount > 0 ? "MIXED" : projectedCount > 0 ? "PROJECTED" : "HAND_AUTHORED", projectedCount, handWrittenCount }; }
}
