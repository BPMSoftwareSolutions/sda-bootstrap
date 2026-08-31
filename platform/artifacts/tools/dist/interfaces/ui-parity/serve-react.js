#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeAuthorityTransformationSemanticReadModelProvider } from "../../adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js";
import { NodeDocumentTextSourceObservationProvider } from "../../adapters/consumer-projection/node-document-text-source-observation-provider.js";
import { NodeTextSourceObservationProvider } from "../../adapters/consumer-projection/node-text-source-observation-provider.js";
import { startUiParityServer } from "../../ui-parity/application/ui-parity-server.js";
function repositoryRoot() {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
}
async function main() {
    const workspace = process.argv[2];
    const portArgument = process.argv.find((argument) => argument.startsWith("--port="));
    if (!workspace)
        throw new Error("Usage: serve-ui-parity <consumer-workspace> [--port=0]");
    const root = repositoryRoot();
    const server = await startUiParityServer({
        repositoryRoot: root,
        workspaceRoot: path.resolve(workspace),
        consumerSemanticReadModelProvider: new NodeAuthorityTransformationSemanticReadModelProvider(root, [new NodeDocumentTextSourceObservationProvider(), new NodeTextSourceObservationProvider()]),
        ...(portArgument ? { port: Number(portArgument.slice("--port=".length)) } : {})
    });
    process.stdout.write(`${JSON.stringify({ status: "READY", origin: server.origin })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
