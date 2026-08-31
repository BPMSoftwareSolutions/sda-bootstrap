import fs from "node:fs";
import path from "node:path";
export class NodeConsumerAssuranceEvidenceStore {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    write(workspaceRoot, relativePath, value) {
        return this.writeAt(path.resolve(workspaceRoot), relativePath, value);
    }
    writeRepository(relativePath, value) {
        return this.writeAt(this.repositoryRoot, relativePath, value);
    }
    writeAt(root, relativePath, value) {
        const destination = path.resolve(root, relativePath);
        if (destination !== root && !destination.startsWith(`${root}${path.sep}`))
            throw new Error(`Assurance evidence path '${relativePath}' escapes its root.`);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        return destination;
    }
}
