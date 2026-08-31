import fs from "node:fs";
import path from "node:path";
export class NodeConformanceEvidenceStore {
    artifactsDirectory;
    constructor(repositoryRoot) { this.artifactsDirectory = path.join(repositoryRoot, "artifacts", "conformance"); }
    write(relativePath, value) { const destination = path.join(this.artifactsDirectory, relativePath); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8"); return destination; }
    read(relativePath) { const source = path.join(this.artifactsDirectory, relativePath); return fs.existsSync(source) ? JSON.parse(fs.readFileSync(source, "utf8")) : null; }
    remove(relativePath) { fs.rmSync(path.join(this.artifactsDirectory, relativePath), { force: true }); }
}
