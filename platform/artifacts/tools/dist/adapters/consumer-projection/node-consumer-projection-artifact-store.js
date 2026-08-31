import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { sha256 } from "../../primitives/sha256.js";
import { TransactionalProjectionMaterializer } from "../projection/transactional-projection-materializer.js";
function assertRelativeFile(relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
        throw new Error(`Consumer projection path '${relativePath}' escapes the projection root.`);
    }
}
function clean(directory) {
    if (fs.existsSync(directory))
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
const GENERATED_BUILD_DIRECTORIES = new Set([".build", ".gradle", ".swiftpm", "DerivedData", "bin", "build", "node_modules", "obj"]);
function isGeneratedBuildDirectory(candidate) {
    return GENERATED_BUILD_DIRECTORIES.has(path.basename(candidate));
}
function copyProjection(source, destination) {
    fs.cpSync(source, destination, {
        recursive: true,
        filter: (candidate) => !isGeneratedBuildDirectory(candidate)
    });
}
function priorCapabilityIds(directory) {
    const manifest = path.join(directory, "projection-manifest.json");
    if (!fs.existsSync(manifest))
        return [];
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    return value.admittedPlatformCapabilities ?? [];
}
function manifestFiles(root) {
    const files = [];
    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory() && isGeneratedBuildDirectory(entry.name))
                continue;
            const full = path.join(directory, entry.name);
            if (entry.isDirectory())
                walk(full);
            else if (entry.name !== "projection-manifest.json") {
                files.push({
                    path: path.relative(root, full).replaceAll("\\", "/"),
                    executableOrigin: "PROJECTED",
                    sha256: createHash("sha256").update(fs.readFileSync(full)).digest("hex")
                });
            }
        }
    };
    walk(root);
    return files.sort((left, right) => left.path.localeCompare(right.path));
}
export class NodeConsumerProjectionArtifactStore {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    publish(plan, options = {}) {
        const destination = path.resolve(plan.workspaceRoot, plan.outputDirectory);
        const expected = path.join(path.resolve(plan.workspaceRoot), "projected");
        if (destination !== expected)
            throw new Error(`Consumer projection destination '${destination}' is not workspace-local projected/.`);
        const priorIds = plan.preserveUntargeted && fs.existsSync(destination) ? priorCapabilityIds(destination) : [];
        const preservedTargets = plan.preserveUntargeted && fs.existsSync(destination)
            ? fs.readdirSync(destination, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && ["node", "csharp", "python"].includes(entry.name) && !plan.targets.includes(entry.name))
                .map((entry) => entry.name)
                .sort()
            : [];
        const transaction = new TransactionalProjectionMaterializer(this.repositoryRoot).stageDirectory(destination, (stage) => {
            if (plan.preserveUntargeted && fs.existsSync(destination))
                copyProjection(destination, stage);
            for (const shared of ["scenarios", "transitions", "telemetry", "fixtures"])
                clean(path.join(stage, shared));
            for (const target of plan.targets) {
                clean(path.join(stage, target));
                for (const suffix of ["json", "v3.json"]) {
                    fs.rmSync(path.join(stage, "execution-plans", `consumer-execution-plan.${target}.${suffix}`), { force: true });
                }
                fs.rmSync(path.join(stage, `application-binding.${target}.json`), { force: true });
            }
            fs.rmSync(path.join(stage, "application-binding.json"), { force: true });
            const query = path.join(stage, "query");
            for (const file of [
                "conformance-query.json", "platform-mechanic-resolution.json",
                ...plan.targets.flatMap((target) => [`conformance-query.${target}.json`, `platform-mechanic-resolution.${target}.json`])
            ])
                fs.rmSync(path.join(query, file), { force: true });
            fs.rmSync(path.join(stage, "projection-manifest.json"), { force: true });
            const seen = new Set();
            for (const file of plan.files) {
                assertRelativeFile(file.relativePath);
                if (seen.has(file.relativePath))
                    throw new Error(`Consumer projection plan contains duplicate path '${file.relativePath}'.`);
                seen.add(file.relativePath);
                if (sha256(file.content) !== file.digest)
                    throw new Error(`Consumer projection digest mismatch for '${file.relativePath}'.`);
                const destinationFile = path.join(stage, file.relativePath);
                fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
                fs.writeFileSync(destinationFile, file.content, "utf8");
            }
            const admittedPlatformCapabilities = [...new Set([...plan.admittedPlatformCapabilityIds, ...priorIds])].sort();
            fs.writeFileSync(path.join(stage, "projection-manifest.json"), `${JSON.stringify({
                projectionManifestType: "consumer-capability-projection-manifest.v1",
                generator: "scenario-driven-architecture/tools/src/consumer-projection",
                authorityRefs: plan.authorityRefs,
                ...(plan.proofProfile ? { proofProfile: plan.proofProfile } : {}),
                admittedPlatformCapabilities,
                files: manifestFiles(stage)
            }, null, 2)}\n`, "utf8");
        }, plan.workspaceRoot, { allowLockedDestinationFallback: true });
        try {
            if (options.failureInjection === "before-publish")
                throw new Error("INJECTED_PROJECTION_FAILURE: before-publish");
            transaction.activate();
            transaction.commit();
            const publishedFiles = manifestFiles(destination).map((file) => ({ relativePath: file.path, digest: `sha256:${file.sha256}` }));
            return Object.freeze({
                evidenceType: "consumer-capability-publication-evidence.v1",
                outputDirectory: destination,
                publishedFiles,
                preservedTargets,
                disposition: "PUBLISHED"
            });
        }
        catch (error) {
            transaction.rollback();
            throw error;
        }
    }
}
