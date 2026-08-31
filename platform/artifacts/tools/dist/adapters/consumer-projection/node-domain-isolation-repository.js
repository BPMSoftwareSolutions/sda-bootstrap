import fs from "node:fs";
import path from "node:path";
import { sha256 } from "../../primitives/sha256.js";
const excluded = new Set(["domain-isolation-evaluator.ts", "no-domain-leakage.test.js"]);
export class NodeDomainIsolationRepository {
    repositoryRoot;
    clock;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
    }
    load() {
        const roots = [
            "tools/src/adapters/consumer-projection",
            "tools/src/consumer-projection",
            "tools/src/capabilities/consumer-capability-compilation",
            "tools/src/capabilities/consumer-assurance",
            "tools/src/interfaces/consumer-projection",
            "tools/src/ui-parity",
            "tools/src/interfaces/ui-parity",
            "tools/tests/consumer-projection",
            "languages/typescript/presentation/react/runtime",
            "languages/typescript/presentation/react/conformance",
            "languages/csharp/src/ScenarioKernel.Wpf",
            "languages/csharp/src/ScenarioKernel.Wpf.Conformance",
            "examples/generic-capability"
        ];
        const files = [];
        const walk = (directory) => {
            if (!fs.existsSync(directory))
                return;
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                if (["projected", "node_modules", "bin", "obj"].includes(entry.name) || excluded.has(entry.name))
                    continue;
                const full = path.join(directory, entry.name);
                if (entry.isDirectory())
                    walk(full);
                else if (/\.(?:ts|js|json|feature|md)$/.test(entry.name)) {
                    files.push({ path: path.relative(this.repositoryRoot, full).replaceAll("\\", "/"), content: fs.readFileSync(full, "utf8") });
                }
            }
        };
        for (const root of roots)
            walk(path.join(this.repositoryRoot, root));
        files.sort((left, right) => left.path.localeCompare(right.path));
        const encoded = JSON.stringify(files);
        return Object.freeze({ sourceRef: roots.join(","), digest: sha256(encoded), observedAt: this.clock.now(), value: Object.freeze(files) });
    }
}
