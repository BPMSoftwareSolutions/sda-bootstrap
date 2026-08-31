import path from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../../primitives/sha256.js";
function entry(relativePath, content) {
    return Object.freeze({ relativePath, content, digest: sha256(content), sourcePointers: ["languages/typescript/runtimes/node/admitted-consumer-platform.mjs"], target: "node" });
}
export function resolvePlatformRuntimeRef(repositoryRoot, projectedNodeDir) {
    const runtime = path.resolve(repositoryRoot, "languages", "typescript", "runtimes", "node", "admitted-consumer-platform.mjs");
    const relative = path.relative(projectedNodeDir, runtime);
    if (path.isAbsolute(relative))
        return pathToFileURL(runtime).href;
    const normalized = relative.replaceAll("\\", "/");
    return normalized.startsWith(".") ? normalized : `./${normalized}`;
}
export function renderRuntime(platformRuntimeRef) {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nimport bind from "${platformRuntimeRef}";\nexport const executeCapability = bind(import.meta.url, "../application-binding.node.json");\n`;
}
export function renderQuery(platformRuntimeRef) {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nimport query from "${platformRuntimeRef}";\nexport const queryConformance = query.conformance(import.meta.url, "../application-binding.node.json");\n`;
}
export function renderCli(platformRuntimeRef) {
    return `#!/usr/bin/env node\n// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nimport deliver from "${platformRuntimeRef}";\ndeliver.cli(import.meta.url, "../application-binding.node.json");\n`;
}
export function renderProjectedTest(platformRuntimeRef) {
    return `// GENERATED PURE PROJECTION SEAM. Do not hand-edit.\nimport prove from "${platformRuntimeRef}";\nprove.tests(import.meta.url, "../application-binding.node.json");\n`;
}
export class NodeConsumerApplicationProvider {
    target = "node";
    render(input) {
        const reference = resolvePlatformRuntimeRef(input.repositoryRoot, path.join(input.workspaceRoot, "projected", "node"));
        return Object.freeze([
            entry("node/conformance-query.generated.mjs", renderQuery(reference)),
            entry("node/capability-runtime.generated.mjs", renderRuntime(reference)),
            ...input.interfaceAuthority.interfaces
                .filter((binding) => binding.kind === "cli")
                .map((binding) => entry(`node/${binding.interfaceId}.generated.mjs`, renderCli(reference))),
            entry("node/capability.projected.test.mjs", renderProjectedTest(reference))
        ]);
    }
}
