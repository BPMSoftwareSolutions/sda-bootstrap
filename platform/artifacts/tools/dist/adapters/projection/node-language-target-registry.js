import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const REGISTRATION_PATH = path.join("projection", "language-target-registration.json");
function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
export function repositoryTextDigest(content) {
    const text = typeof content === "string" ? content : content.toString("utf8");
    return digest(text.replace(/\r\n?/g, "\n"));
}
function assertRelative(reference, label) {
    if (path.isAbsolute(reference) || reference.split(/[\\/]/).includes("..")) {
        throw new Error(`${label} must be a contained repository-relative path.`);
    }
}
function parseRegistration(encoded, registrationPath) {
    const value = JSON.parse(encoded);
    if (value.registrationType !== "language-target-registration.v1")
        throw new Error(`Unsupported target registration at '${registrationPath}'.`);
    if (typeof value.targetId !== "string" || value.targetId.length === 0)
        throw new Error(`Registration '${registrationPath}' has no target identity.`);
    if (!value.providers?.structuralRenderer || !value.providers.executionRenderer || !value.providers.shapeObserver) {
        throw new Error(`Registration '${registrationPath}' does not bind the required projection providers.`);
    }
    if (!value.projectionProfileRef || !value.bindingRef || !value.toolchainProfileRef || !value.admittedStructuralSource || !value.promotion) {
        throw new Error(`Registration '${registrationPath}' is incomplete.`);
    }
    for (const [label, reference] of [
        ["bindingRef", value.bindingRef],
        ["projectionProfileRef", value.projectionProfileRef],
        ["toolchainProfileRef", value.toolchainProfileRef],
        ["admittedStructuralSource.directory", value.admittedStructuralSource.directory]
    ])
        assertRelative(reference, label);
    return value;
}
export class NodeLanguageTargetRegistry {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    entries() {
        const languagesRoot = path.join(this.repositoryRoot, "languages");
        if (!fs.existsSync(languagesRoot))
            return Object.freeze([]);
        const entries = fs.readdirSync(languagesRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({ root: path.join(languagesRoot, entry.name), file: path.join(languagesRoot, entry.name, REGISTRATION_PATH) }))
            .filter(({ file }) => fs.existsSync(file))
            .map(({ root, file }) => ({ root, registration: parseRegistration(fs.readFileSync(file, "utf8"), file) }))
            .sort((left, right) => left.registration.targetId.localeCompare(right.registration.targetId));
        const identities = new Set();
        for (const { registration } of entries) {
            if (identities.has(registration.targetId))
                throw new Error(`Duplicate language target registration '${registration.targetId}'.`);
            identities.add(registration.targetId);
        }
        return Object.freeze(entries);
    }
    discover() {
        return Object.freeze(this.entries().map(({ registration }) => registration));
    }
    targets() {
        return Object.freeze(this.discover().map((registration) => registration.targetId));
    }
    registration(target) {
        const registration = this.discover().find((candidate) => candidate.targetId === target);
        if (!registration)
            throw new Error(`No admitted language target registration exists for '${target}'.`);
        return registration;
    }
    targetPath(target, relativeReference) {
        assertRelative(relativeReference, "target reference");
        return path.join(this.targetRoot(target), ...relativeReference.split("/"));
    }
    targetRoot(target) {
        const entry = this.entries().find(({ registration }) => registration.targetId === target);
        if (!entry)
            throw new Error(`No admitted language target registration exists for '${target}'.`);
        return entry.root;
    }
    repositoryPath(relativeReference) {
        assertRelative(relativeReference, "repository reference");
        return path.join(this.repositoryRoot, ...relativeReference.split("/"));
    }
    verifiedProvider(target, role) {
        const provider = this.registration(target).providers[role];
        if (!provider)
            throw new Error(`Target '${target}' has no admitted '${role}' provider.`);
        const implementationPath = this.repositoryPath(provider.implementationRef);
        if (!fs.existsSync(implementationPath))
            throw new Error(`Provider '${provider.providerId}' implementation is missing at '${provider.implementationRef}'.`);
        const observed = repositoryTextDigest(fs.readFileSync(implementationPath));
        if (observed !== provider.implementationDigest) {
            throw new Error(`Provider '${provider.providerId}' digest mismatch: declared ${provider.implementationDigest}, observed ${observed}.`);
        }
        return provider;
    }
    toolchainProfile(target) {
        const registration = this.registration(target);
        const profilePath = this.targetPath(target, registration.toolchainProfileRef);
        const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
        if (profile.profileType !== "target-toolchain-profile.v1" || profile.targetId !== target) {
            throw new Error(`Toolchain profile '${profilePath}' does not admit target '${target}'.`);
        }
        return profile;
    }
}
