import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertConsumerInputResolutionOperationSupported, ConsumerSemanticReadModelError, resolveConsumerInput } from "./ui-input-resolution.js";
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function contentType(file) {
    if (file.endsWith(".html"))
        return "text/html; charset=utf-8";
    if (file.endsWith(".mjs") || file.endsWith(".js"))
        return "text/javascript; charset=utf-8";
    if (file.endsWith(".css"))
        return "text/css; charset=utf-8";
    if (file.endsWith(".json"))
        return "application/json; charset=utf-8";
    return "application/octet-stream";
}
function sendJson(response, status, value) {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(`${JSON.stringify(value)}\n`);
}
async function body(request) {
    const chunks = [];
    for await (const chunk of request)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function safeStatic(root, requestPath) {
    const resolved = path.resolve(root, `.${requestPath}`);
    return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
export async function startUiParityServer(options) {
    const repositoryRoot = path.resolve(options.repositoryRoot);
    const workspaceRoot = path.resolve(options.workspaceRoot);
    const projectedRoot = path.join(workspaceRoot, "projected");
    const registry = readJson(path.join(projectedRoot, "ui-parity", "targets.json"));
    const browserTargets = registry.admittedTargets.filter((target) => target === "react" || target === "html");
    for (const target of browserTargets)
        if (!fs.existsSync(path.join(projectedRoot, target, "index.generated.html"))) {
            throw new Error(`${target} UI projection does not exist. Run project-ui-parity first.`);
        }
    for (const browserAuthorityTarget of browserTargets) {
        const authority = readJson(path.join(projectedRoot, browserAuthorityTarget, "authority", `ui-authority.${browserAuthorityTarget}.json`));
        const interaction = authority.interactionAuthority;
        const operations = Array.isArray(interaction?.operations) ? interaction.operations : [];
        const resolutionOperations = operations.filter((operation) => operation.kind === "resolve-input");
        if (resolutionOperations.length > 0 && !options.consumerSemanticReadModelProvider) {
            throw new ConsumerSemanticReadModelError("MISSING_CONSUMER_SEMANTIC_READ_MODEL_PROVIDER", "the projected UI declares source interpretation but no admitted consumer-owned provider is available.");
        }
        for (const operation of resolutionOperations) {
            assertConsumerInputResolutionOperationSupported(workspaceRoot, operation, options.consumerSemanticReadModelProvider);
        }
    }
    const workspace = readJson(path.join(workspaceRoot, "consumer-workspace.authority.json"));
    if (typeof workspace.queryCatalog !== "string")
        throw new Error("Browser UI query dispatch requires an inspectable query catalog.");
    const queryCatalog = readJson(path.resolve(workspaceRoot, workspace.queryCatalog));
    const fixtures = readJson(path.join(projectedRoot, "fixtures", "fixtures.json"));
    const bindingBase = pathToFileURL(path.join(projectedRoot, "react", "application.generated.mjs")).href;
    const platformModule = await import(pathToFileURL(path.join(repositoryRoot, "languages", "typescript", "runtimes", "node", "admitted-consumer-platform.mjs")).href);
    const queryModule = await import(pathToFileURL(path.join(repositoryRoot, "languages", "typescript", "runtimes", "node", "query-cli.mjs")).href);
    const execute = platformModule.default(bindingBase, "../application-binding.node.json");
    const platformFiles = new Map([
        ["/__sda/browser/consumer-ui-semantic-model.mjs", path.join(repositoryRoot, "languages", "typescript", "runtimes", "browser", "runtime", "consumer-ui-semantic-model.mjs")],
        ["/__sda/browser/ui-state-store.mjs", path.join(repositoryRoot, "languages", "typescript", "runtimes", "browser", "runtime", "ui-state-store.mjs")],
        ["/__sda/browser/ui-operation-executor.mjs", path.join(repositoryRoot, "languages", "typescript", "runtimes", "browser", "runtime", "ui-operation-executor.mjs")],
        ["/__sda/browser/ui-collection-projector.mjs", path.join(repositoryRoot, "languages", "typescript", "runtimes", "browser", "runtime", "ui-collection-projector.mjs")],
        ["/__sda/browser/authority-backed-application.css", path.join(repositoryRoot, "languages", "typescript", "runtimes", "browser", "runtime", "authority-backed-application.css")],
        ["/__sda/react/authority-backed-application.mjs", path.join(repositoryRoot, "languages", "typescript", "presentation", "react", "runtime", "authority-backed-application.mjs")],
        ["/__sda/react/react.production.min.js", path.join(repositoryRoot, "languages", "typescript", "presentation", "react", "node_modules", "react", "umd", "react.production.min.js")],
        ["/__sda/react/react-dom.production.min.js", path.join(repositoryRoot, "languages", "typescript", "presentation", "react", "node_modules", "react-dom", "umd", "react-dom.production.min.js")],
        ["/__sda/html/authority-backed-dom-application.mjs", path.join(repositoryRoot, "languages", "typescript", "presentation", "browser-dom", "runtime", "authority-backed-dom-application.mjs")]
    ]);
    const evidenceNames = {
        testimony: "testimony", wiring: "wiring", presentation: "presentation-testimony", structure: "structural-testimony"
    };
    const server = http.createServer(async (request, response) => {
        try {
            const url = new URL(request.url ?? "/", "http://127.0.0.1");
            if (request.method === "GET" && url.pathname === "/__sda/api/fixture") {
                const fixtureId = url.searchParams.get("fixtureId");
                const values = Array.isArray(fixtures.fixtures) ? fixtures.fixtures : [];
                const fixture = values.find((candidate) => candidate.fixtureId === fixtureId);
                if (!fixture)
                    return sendJson(response, 404, { error: `Unknown fixture '${String(fixtureId)}'.` });
                return sendJson(response, 200, fixture);
            }
            if (request.method === "POST" && url.pathname === "/__sda/api/execute")
                return sendJson(response, 200, await execute((await body(request)).input));
            if (request.method === "POST" && url.pathname === "/__sda/api/resolve-input") {
                const input = await body(request);
                const operation = input.operation;
                const sources = input.sources;
                if (!operation || typeof operation !== "object" || Array.isArray(operation) || !sources || typeof sources !== "object" || Array.isArray(sources)) {
                    return sendJson(response, 400, { error: "Input resolution requires an admitted operation and source states." });
                }
                return sendJson(response, 200, await resolveConsumerInput(workspaceRoot, operation, sources, options.consumerSemanticReadModelProvider));
            }
            if (request.method === "POST" && url.pathname === "/__sda/api/query") {
                const input = await body(request);
                if (typeof input.queryId !== "string")
                    return sendJson(response, 400, { error: "Query ID is required." });
                const params = input.params && typeof input.params === "object" && !Array.isArray(input.params) ? input.params : {};
                return sendJson(response, 200, queryModule.runQuery(queryCatalog, input.profile, input.queryId, params));
            }
            const evidenceMatch = /^\/__sda\/api\/evidence\/([^/]+)\/([^/]+)$/.exec(url.pathname);
            if (request.method === "POST" && evidenceMatch) {
                const target = evidenceMatch[1];
                const evidenceName = evidenceNames[evidenceMatch[2] ?? ""];
                if (!registry.admittedTargets.includes(target) || !evidenceName)
                    return sendJson(response, 404, { error: "Unknown admitted evidence target or kind." });
                const destination = path.join(projectedRoot, "ui-parity", `${target}-${evidenceName}.json`);
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                fs.writeFileSync(destination, `${JSON.stringify(await body(request), null, 2)}\n`, "utf8");
                return sendJson(response, 200, { disposition: "RECORDED", destination });
            }
            if (request.method === "GET" && url.pathname === "/__sda/api/health")
                return sendJson(response, 200, { status: "READY", targets: browserTargets });
            const platformFile = platformFiles.get(url.pathname);
            let requested = platformFile ?? null;
            if (!requested) {
                const match = /^\/(react|html)(\/.*)?$/.exec(url.pathname);
                if (match && registry.admittedTargets.includes(match[1])) {
                    const targetRoot = path.join(projectedRoot, match[1]);
                    const targetPath = match[2] === undefined || match[2] === "/" ? "/index.generated.html" : match[2];
                    requested = safeStatic(targetRoot, targetPath);
                }
                else if (url.pathname === "/" && registry.admittedTargets.includes("react")) {
                    requested = path.join(projectedRoot, "react", "index.generated.html");
                }
            }
            if (!requested || !fs.existsSync(requested) || fs.statSync(requested).isDirectory())
                return sendJson(response, 404, { error: "Not found." });
            response.writeHead(200, { "content-type": contentType(requested), "cache-control": "no-store" });
            fs.createReadStream(requested).pipe(response);
        }
        catch (error) {
            const semanticReadModelFailure = error instanceof ConsumerSemanticReadModelError;
            sendJson(response, semanticReadModelFailure ? 422 : 500, {
                ...(semanticReadModelFailure ? { code: error.code } : {}),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(options.port ?? 0, "127.0.0.1", resolve); });
    const address = server.address();
    return Object.freeze({ origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) });
}
export const startReactUiServer = startUiParityServer;
