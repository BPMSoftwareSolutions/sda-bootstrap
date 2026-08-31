import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
/**
 * Locates the shared conformance corpus/expectations by walking up from
 * this file's own location rather than a hardcoded relative depth, so it
 * resolves correctly whether run from TypeScript source or compiled
 * dist/ output.
 */
function findRepositoryRoot(startDir) {
    let dir = startDir;
    while (true) {
        if (fs.existsSync(path.join(dir, "conformance")) && fs.existsSync(path.join(dir, "kernel"))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error(`Could not locate the repository root (expected sibling 'conformance' and 'kernel' directories) walking up from ${startDir}.`);
        }
        dir = parent;
    }
}
const here = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = findRepositoryRoot(here);
export const corpusExecutionDirectory = path.join(repositoryRoot, "conformance", "corpus", "execution");
export const expectationsExecutionDirectory = path.join(repositoryRoot, "conformance", "expectations", "execution");
