import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sha256 } from "../../primitives/sha256.js";
import { NodeLanguageTargetRegistry } from "./node-language-target-registry.js";
function assertRelativeFile(relativePath) {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
        throw new Error(`Projection plan path '${relativePath}' escapes its target directory.`);
    }
}
function renameWithRetry(source, destination) {
    const retryable = new Set(["EACCES", "EBUSY", "ENOTEMPTY", "EPERM"]);
    for (let attempt = 0;; attempt += 1) {
        try {
            fs.renameSync(source, destination);
            return;
        }
        catch (error) {
            const code = error.code;
            if (attempt >= 10 || !code || !retryable.has(code))
                throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
        }
    }
}
function removeDirectoryWithRetry(directory) {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
function clearDirectoryContents(directory) {
    for (const entry of fs.readdirSync(directory)) {
        fs.rmSync(path.join(directory, entry), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
}
function copyDirectoryContents(source, destination) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
        fs.cpSync(path.join(source, entry), path.join(destination, entry), { recursive: true, force: true });
    }
}
export class TransactionalProjectionMaterializer {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    stage(plan, options = {}) {
        const languageRoot = new NodeLanguageTargetRegistry(this.repositoryRoot).targetRoot(plan.target);
        const destination = path.resolve(languageRoot, plan.outputDirectory);
        if (destination !== languageRoot && !destination.startsWith(`${languageRoot}${path.sep}`)) {
            throw new Error(`Projection output '${plan.outputDirectory}' escapes languages/${plan.target}.`);
        }
        return this.stageDirectory(destination, (stagingDirectory) => {
            const seen = new Set();
            if (options.preserveExistingFiles && fs.existsSync(destination)) {
                fs.cpSync(destination, stagingDirectory, { recursive: true, force: true });
                const priorManifest = path.join(stagingDirectory, ".sda-projection-manifest.json");
                if (fs.existsSync(priorManifest)) {
                    const manifest = JSON.parse(fs.readFileSync(priorManifest, "utf8"));
                    if (manifest.manifestType !== "sda-projection-manifest.v1" || !Array.isArray(manifest.files)) {
                        throw new Error(`Existing projection manifest at '${priorManifest}' is invalid.`);
                    }
                    for (const file of manifest.files) {
                        assertRelativeFile(file.relativePath);
                        const managedPath = path.join(stagingDirectory, file.relativePath);
                        if (fs.existsSync(managedPath) && fs.statSync(managedPath).isFile())
                            fs.unlinkSync(managedPath);
                    }
                }
                else {
                    for (const entry of fs.readdirSync(stagingDirectory, { withFileTypes: true })) {
                        if (entry.isFile() && options.managedFileExtensions?.some((extension) => entry.name.endsWith(extension))) {
                            fs.unlinkSync(path.join(stagingDirectory, entry.name));
                        }
                    }
                }
                if (fs.existsSync(priorManifest))
                    fs.unlinkSync(priorManifest);
            }
            for (const file of plan.files) {
                assertRelativeFile(file.relativePath);
                if (seen.has(file.relativePath))
                    throw new Error(`Projection plan contains duplicate path '${file.relativePath}'.`);
                seen.add(file.relativePath);
                if (sha256(file.content) !== file.digest)
                    throw new Error(`Projection plan digest mismatch for '${file.relativePath}'.`);
                const target = path.join(stagingDirectory, file.relativePath);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, file.content, "utf8");
            }
            const manifest = {
                manifestType: "sda-projection-manifest.v1",
                target: plan.target,
                outputDirectory: plan.outputDirectory,
                files: plan.files.map(({ relativePath, digest, sourcePointers }) => ({ relativePath, digest, sourcePointers }))
            };
            fs.writeFileSync(path.join(stagingDirectory, ".sda-projection-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        });
    }
    stageDirectory(destination, populate, allowedRoot = this.repositoryRoot, options = {}) {
        const resolvedDestination = path.resolve(destination);
        const resolvedAllowedRoot = path.resolve(allowedRoot);
        if (resolvedDestination === resolvedAllowedRoot || !resolvedDestination.startsWith(`${resolvedAllowedRoot}${path.sep}`)) {
            throw new Error(`Transactional projection destination '${resolvedDestination}' escapes '${resolvedAllowedRoot}'.`);
        }
        const parent = path.dirname(resolvedDestination);
        fs.mkdirSync(parent, { recursive: true });
        const token = randomUUID();
        const stagingDirectory = path.join(parent, `.${path.basename(resolvedDestination)}.sda-stage-${token}`);
        const backupDirectory = path.join(parent, `.${path.basename(resolvedDestination)}.sda-backup-${token}`);
        fs.mkdirSync(stagingDirectory, { recursive: false });
        try {
            populate(stagingDirectory);
        }
        catch (error) {
            removeDirectoryWithRetry(stagingDirectory);
            throw error;
        }
        let activated = false;
        let completed = false;
        let usedLockedDestinationFallback = false;
        return {
            destination: resolvedDestination,
            stagingDirectory,
            activate() {
                if (completed || activated)
                    throw new Error("Projection transaction cannot be activated twice.");
                if (fs.existsSync(resolvedDestination)) {
                    try {
                        renameWithRetry(resolvedDestination, backupDirectory);
                    }
                    catch (error) {
                        if (!options.allowLockedDestinationFallback)
                            throw error;
                        fs.cpSync(resolvedDestination, backupDirectory, { recursive: true, force: true });
                        try {
                            clearDirectoryContents(resolvedDestination);
                            copyDirectoryContents(stagingDirectory, resolvedDestination);
                            usedLockedDestinationFallback = true;
                            activated = true;
                            return;
                        }
                        catch (replacementError) {
                            clearDirectoryContents(resolvedDestination);
                            copyDirectoryContents(backupDirectory, resolvedDestination);
                            throw replacementError;
                        }
                    }
                }
                try {
                    renameWithRetry(stagingDirectory, resolvedDestination);
                    activated = true;
                }
                catch (error) {
                    if (fs.existsSync(backupDirectory))
                        renameWithRetry(backupDirectory, resolvedDestination);
                    throw error;
                }
            },
            commit() {
                if (!activated || completed)
                    throw new Error("Only an active projection transaction can commit.");
                if (fs.existsSync(backupDirectory))
                    removeDirectoryWithRetry(backupDirectory);
                if (usedLockedDestinationFallback && fs.existsSync(stagingDirectory))
                    removeDirectoryWithRetry(stagingDirectory);
                completed = true;
            },
            rollback() {
                if (completed)
                    return;
                if (activated && usedLockedDestinationFallback) {
                    clearDirectoryContents(resolvedDestination);
                    if (fs.existsSync(backupDirectory))
                        copyDirectoryContents(backupDirectory, resolvedDestination);
                    if (fs.existsSync(backupDirectory))
                        removeDirectoryWithRetry(backupDirectory);
                }
                else {
                    if (activated && fs.existsSync(resolvedDestination))
                        removeDirectoryWithRetry(resolvedDestination);
                    if (fs.existsSync(backupDirectory))
                        renameWithRetry(backupDirectory, resolvedDestination);
                }
                if (fs.existsSync(stagingDirectory))
                    removeDirectoryWithRetry(stagingDirectory);
                completed = true;
            }
        };
    }
}
