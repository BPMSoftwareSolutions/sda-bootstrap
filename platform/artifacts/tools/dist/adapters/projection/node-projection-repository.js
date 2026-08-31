import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NodeLanguageTargetRegistry } from "./node-language-target-registry.js";
function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
function fact(sourceRef, value, observedAt, encoded = JSON.stringify(value)) {
    return Object.freeze({ sourceRef, digest: digest(encoded), observedAt, value });
}
export class NodeProjectionRepository {
    repositoryRoot;
    clock;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
    }
    loadSchemas() {
        const schemasDirectory = path.join(this.repositoryRoot, "kernel", "schemas");
        const schemas = {};
        for (const file of fs.readdirSync(schemasDirectory).sort()) {
            if (file.endsWith(".schema.json")) {
                schemas[file] = JSON.parse(fs.readFileSync(path.join(schemasDirectory, file), "utf8"));
            }
        }
        return fact(path.relative(this.repositoryRoot, schemasDirectory), Object.freeze(schemas), this.clock.now());
    }
    loadProfile(target) {
        const registry = new NodeLanguageTargetRegistry(this.repositoryRoot);
        const profilePath = registry.targetPath(target, registry.registration(target).projectionProfileRef);
        const encoded = fs.readFileSync(profilePath, "utf8");
        const profile = JSON.parse(encoded);
        if (profile.language !== target)
            throw new Error(`Projection profile '${profilePath}' declares '${profile.language}'.`);
        return fact(path.relative(this.repositoryRoot, profilePath), profile, this.clock.now(), encoded);
    }
    loadAdmittedSource(target) {
        const registry = new NodeLanguageTargetRegistry(this.repositoryRoot);
        const registration = registry.registration(target);
        const directory = registry.targetPath(target, registration.admittedStructuralSource.directory);
        const relativeDirectory = path.relative(this.repositoryRoot, directory);
        const excluded = new Set(registration.admittedStructuralSource.excludedFiles ?? []);
        const files = [];
        const walk = (current) => {
            for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
                const resolved = path.join(current, entry.name);
                if (entry.isDirectory())
                    walk(resolved);
                else if (entry.isFile()) {
                    const relative = path.relative(directory, resolved).replaceAll("\\", "/");
                    if (!excluded.has(relative) && registration.admittedStructuralSource.extensions.some((extension) => entry.name.endsWith(extension))) {
                        files.push({ path: relative, content: fs.readFileSync(resolved, "utf8") });
                    }
                }
            }
        };
        walk(directory);
        return fact(relativeDirectory, files, this.clock.now());
    }
    loadExecutionVector() {
        const relativePath = "kernel/contracts/execution/scenario-kernel-execution-vector.json";
        const encoded = fs.readFileSync(path.join(this.repositoryRoot, ...relativePath.split("/")), "utf8");
        return fact(relativePath, JSON.parse(encoded), this.clock.now(), encoded);
    }
    fixtureCount() {
        return fs.readdirSync(path.join(this.repositoryRoot, "conformance", "corpus", "execution"))
            .filter((file) => file.endsWith(".json")).length;
    }
}
