import fs from "node:fs";
import path from "node:path";
import digestModule from "../conformance/admission-input-digest.cjs";
import { consumerPlatformInputDigest } from "./consumer-platform-input-digest.js";
const { admissionArtifactIsCurrent } = digestModule;
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
export class NodeConsumerAssuranceRepository {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    loadMechanicConformanceFacts(observations) {
        const authority = readJson(path.join(this.repositoryRoot, "kernel", "semantic-authority", "consumer", "sda-platform-mechanic-parity.semantic-authority.json"));
        const catalog = readJson(path.join(this.repositoryRoot, "kernel", "semantic-authority", "consumer", "sda-platform-capabilities.semantic-authority.json"));
        const bindings = this.bindings();
        const currentProofDigests = Object.fromEntries(bindings.map((binding) => [
            binding.language, consumerPlatformInputDigest(this.repositoryRoot, binding.language, catalog)
        ]));
        const kernelAdmissions = Object.fromEntries(bindings.map((binding) => [binding.language, this.kernelAdmission(binding)]));
        const availableCapabilityIds = new Set(catalog.capabilities.filter((capability) => fs.existsSync(path.join(this.repositoryRoot, capability.implementationRef)) &&
            fs.existsSync(path.join(this.repositoryRoot, capability.conformanceRef))).map((capability) => capability.capabilityId));
        return { authority, catalog, bindings, observations, currentProofDigests, kernelAdmissions, availableCapabilityIds };
    }
    bindings() {
        const root = path.join(this.repositoryRoot, "languages");
        return fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
            .map((entry) => path.join(root, entry.name, "binding", `scenario-kernel-${entry.name}.binding.json`))
            .filter((filePath) => fs.existsSync(filePath)).map((filePath) => readJson(filePath))
            .sort((left, right) => left.language.localeCompare(right.language));
    }
    kernelAdmission(binding) {
        if (binding.status === "DECLARED")
            return "NOT_APPLICABLE";
        const resultPath = path.join(this.repositoryRoot, "artifacts", "conformance", `scenario-kernel-${binding.language}.conformance-result.json`);
        if (!fs.existsSync(resultPath))
            return "NOT_ADMITTED";
        const artifact = readJson(resultPath);
        const bindingPath = path.join(this.repositoryRoot, "languages", binding.language, "binding", `scenario-kernel-${binding.language}.binding.json`);
        const obligation = { language: binding.language, bindingPath, binding };
        return artifact.admissionDisposition === "ADMITTED" && admissionArtifactIsCurrent(this.repositoryRoot, obligation, artifact)
            ? "ADMITTED" : "NOT_ADMITTED";
    }
}
