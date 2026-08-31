import http from "node:http";
import path from "node:path";
import { TextDecoder } from "node:util";
import { AjvSchemaAdmission } from "../../../adapters/contracts/ajv-schema-admission.cjs";
import { loadOpenApiProjectionFixture } from "../../../adapters/api-interface-projection/node-api-interface-authority-loader.js";
import { runConfiguredOpenApiProjection } from "../../../interfaces/api-interface-projection/run.js";
import { ExecutionApiApplication } from "./execution-api-application.js";
import { RealizationApiApplication } from "./realization-api-application.js";
import { ApiProblemError, isNodeApiReferenceHostProfile } from "./model.js";
import { isNodeRealizationApiReferenceHostProfile } from "./realization-api-model.js";
import { parseStrictJson, StrictJsonError } from "./strict-json.js";
function escapeExpression(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compileRoute(operation) {
    const names = [];
    const segments = operation.path.split("/").slice(1).map((segment) => {
        const match = /^\{([a-z][A-Za-z0-9]*)\}$/.exec(segment);
        if (!match)
            return escapeExpression(segment);
        names.push(match[1]);
        return "([^/]+)";
    });
    return Object.freeze({
        operation,
        expression: new RegExp(`^/${segments.join("/")}$`),
        pathParameterNames: Object.freeze(names)
    });
}
function matchRoute(routes, method, pathname) {
    for (const route of routes) {
        if (route.operation.method !== method)
            continue;
        const match = route.expression.exec(pathname);
        if (!match)
            continue;
        const parameters = {};
        for (const [index, name] of route.pathParameterNames.entries()) {
            const encoded = match[index + 1];
            if (encoded === undefined)
                throw new Error("Path parameter capture invariant failed.");
            try {
                parameters[name] = decodeURIComponent(encoded);
            }
            catch {
                throw new ApiProblemError(400, "INVALID_PATH_PARAMETER", "Path parameter is invalid");
            }
        }
        return { route, pathParameters: Object.freeze(parameters) };
    }
    return null;
}
function pathExists(routes, pathname) {
    return routes.filter((route) => route.expression.test(pathname)).map((route) => route.operation.method).sort();
}
function rawHeaderValues(request, requestedName) {
    const values = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
        if (request.rawHeaders[index]?.toLowerCase() === requestedName.toLowerCase()) {
            values.push(request.rawHeaders[index + 1] ?? "");
        }
    }
    return values;
}
function singleHeader(request, name, duplicateStatus = 400) {
    const values = rawHeaderValues(request, name);
    if (values.length > 1)
        throw new ApiProblemError(duplicateStatus, "DUPLICATE_HEADER", "Duplicate header is not admitted");
    return values[0];
}
function traceId(traceparent) {
    if (!traceparent)
        return undefined;
    const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/.exec(traceparent);
    if (!match || /^0+$/.test(match[1] ?? "") || /^0+$/.test(match[2] ?? "")) {
        throw new ApiProblemError(400, "INVALID_TRACE_CONTEXT", "Trace context is invalid");
    }
    return match[1];
}
function problemInstance(pathname) {
    return /^\/v[1-9][0-9]*(?:\/[A-Za-z0-9_-]+)+$/.test(pathname) ? pathname : "/v1/unknown";
}
function problem(error, pathname, activeTraceId) {
    const slug = error.reasonCode.toLowerCase().replace(/_/g, "-");
    return Object.freeze({
        type: `https://problems.scenario-driven.dev/${slug}`,
        title: error.title,
        status: error.status,
        ...(error.safeDetail ? { detail: error.safeDetail } : {}),
        reasonCode: error.reasonCode,
        instance: problemInstance(pathname),
        ...(activeTraceId ? { traceId: activeTraceId } : {})
    });
}
function responseHeaders(contentType, requestId, operationId) {
    return {
        "content-type": `${contentType}; charset=utf-8`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...(requestId ? { "x-sda-request-id": requestId } : {}),
        ...(operationId ? { "x-sda-operation-id": operationId } : {})
    };
}
function writeJson(response, status, value, contentType, extraHeaders = {}) {
    const body = `${JSON.stringify(value)}\n`;
    response.writeHead(status, {
        ...responseHeaders(contentType),
        "content-length": String(Buffer.byteLength(body)),
        ...extraHeaders
    });
    response.end(body);
}
function assertDeclaredResponse(operation, status) {
    if (!operation.responses.some((response) => response.statusCode === status)) {
        throw new Error(`Operation '${operation.operationId}' does not declare HTTP ${status}.`);
    }
}
function validateProfile(profile) {
    const contentAddressed = profile.apiId === "sda-execution-api"
        ? isNodeApiReferenceHostProfile(profile)
        : isNodeRealizationApiReferenceHostProfile(profile);
    if (!contentAddressed) {
        throw new Error("Node API reference host profile failed content-address verification.");
    }
    if (profile.authentication.acceptedIssuers.length === 0 ||
        new Set(profile.authentication.acceptedIssuers).size !== profile.authentication.acceptedIssuers.length) {
        throw new Error("Node API reference host profile must declare unique accepted issuers.");
    }
    for (const limit of Object.values(profile.limits)) {
        if (!Number.isSafeInteger(limit) || limit < 1)
            throw new Error("Node API reference host limits must be positive safe integers.");
    }
    if ("maximumEventPageSize" in profile.limits && profile.limits.maximumEventPageSize > 200) {
        throw new Error("Node API reference host event page limit exceeds the admitted public contract.");
    }
}
async function verifiedPrincipal(request, verifier, profile) {
    const authorization = singleHeader(request, "authorization", 401);
    const match = authorization ? /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/.exec(authorization) : null;
    if (!match)
        throw new ApiProblemError(401, "AUTHENTICATION_REQUIRED", "Bearer authentication required");
    let principal;
    try {
        principal = await verifier.verify(match[1]);
    }
    catch {
        throw new ApiProblemError(401, "ACCESS_TOKEN_INVALID", "Access token is invalid");
    }
    const methods = new Set(["oidc", "oauth2", "workload-identity", "operator"]);
    if (!principal || typeof principal.tokenId !== "string" || principal.tokenId.length === 0 ||
        typeof principal.issuer !== "string" || !Array.isArray(principal.audiences) ||
        !principal.audiences.every((audience) => typeof audience === "string") ||
        typeof principal.tenantId !== "string" || principal.tenantId.length === 0 ||
        typeof principal.subjectId !== "string" || principal.subjectId.length === 0 ||
        (principal.homeRegion !== undefined && typeof principal.homeRegion !== "string") ||
        (principal.workloadIdentity !== undefined && typeof principal.workloadIdentity !== "string") ||
        !methods.has(principal.authenticationMethod) || !Array.isArray(principal.scopes) ||
        !principal.scopes.every((scope) => typeof scope === "string") ||
        !profile.authentication.acceptedIssuers.includes(principal.issuer) ||
        !principal.audiences.includes(profile.authentication.audience)) {
        throw new ApiProblemError(401, "ACCESS_TOKEN_INVALID", "Access token is invalid");
    }
    if (new Set(principal.scopes).size !== principal.scopes.length) {
        throw new ApiProblemError(401, "ACCESS_TOKEN_INVALID", "Access token is invalid");
    }
    return Object.freeze({
        ...principal,
        audiences: Object.freeze([...principal.audiences]),
        scopes: Object.freeze([...principal.scopes])
    });
}
function authorize(principal, operation) {
    const scopes = new Set(principal.scopes);
    if (!operation.requiredScopes.every((scope) => scopes.has(scope))) {
        throw new ApiProblemError(403, "INSUFFICIENT_SCOPE", "Required authorization scope is missing");
    }
}
function requestContentType(request) {
    return singleHeader(request, "content-type")?.trim();
}
function readBody(request, profile) {
    const declaredLength = singleHeader(request, "content-length");
    if (declaredLength !== undefined) {
        if (!/^(?:0|[1-9][0-9]*)$/.test(declaredLength)) {
            return Promise.reject(new ApiProblemError(400, "CONTENT_LENGTH_INVALID", "Content length is invalid"));
        }
        if (Number(declaredLength) > profile.limits.maximumBodyBytes) {
            return Promise.reject(new ApiProblemError(413, "REQUEST_BODY_TOO_LARGE", "Request body is too large"));
        }
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        let bytes = 0;
        let settled = false;
        const timer = setTimeout(() => finish(new ApiProblemError(408, "REQUEST_BODY_TIMEOUT", "Request body timed out")), profile.limits.bodyReadTimeoutMilliseconds);
        timer.unref();
        const cleanup = () => {
            clearTimeout(timer);
            request.off("data", onData);
            request.off("end", onEnd);
            request.off("error", onError);
            request.off("aborted", onAborted);
        };
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            if (error) {
                request.resume();
                reject(error);
            }
            else
                resolve(Buffer.concat(chunks));
        };
        const onData = (chunk) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > profile.limits.maximumBodyBytes)
                return finish(new ApiProblemError(413, "REQUEST_BODY_TOO_LARGE", "Request body is too large"));
            chunks.push(buffer);
        };
        const onEnd = () => finish();
        const onError = () => finish(new ApiProblemError(400, "REQUEST_BODY_INVALID", "Request body could not be read"));
        const onAborted = () => finish(new ApiProblemError(400, "REQUEST_BODY_ABORTED", "Request body was aborted"));
        request.on("data", onData);
        request.once("end", onEnd);
        request.once("error", onError);
        request.once("aborted", onAborted);
    });
}
function assertKnownQueryParameters(operation, url) {
    const allowed = new Set(operation.parameters
        .filter((parameter) => parameter.location === "QUERY")
        .map((parameter) => parameter.wireName));
    for (const name of url.searchParams.keys()) {
        if (!allowed.has(name))
            throw new ApiProblemError(400, "QUERY_PARAMETER_UNKNOWN", "Query parameter is not admitted");
    }
}
function queryInput(operation, url, pathParameters, request) {
    const result = {};
    for (const parameter of operation.parameters) {
        let value;
        if (parameter.location === "PATH")
            value = pathParameters[parameter.wireName];
        if (parameter.location === "QUERY") {
            const values = url.searchParams.getAll(parameter.wireName);
            if (values.length > 1)
                throw new ApiProblemError(400, "DUPLICATE_QUERY_PARAMETER", "Duplicate query parameter is not admitted");
            value = values[0];
        }
        if (parameter.location === "HEADER")
            value = singleHeader(request, parameter.wireName);
        if (value === undefined || value.length === 0) {
            if (parameter.required)
                throw new ApiProblemError(400, "REQUIRED_PARAMETER_MISSING", "Required parameter is missing");
            continue;
        }
        if (parameter.valueType === "POSITIVE_INTEGER") {
            if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
                throw new ApiProblemError(400, "PARAMETER_INVALID", "Request parameter is invalid");
            }
            result[parameter.wireName] = Number(value);
        }
        else
            result[parameter.wireName] = value;
    }
    return Object.freeze(result);
}
function schemaFilename(schemaRef) {
    return path.basename(schemaRef);
}
function operationHandlers(profile, application) {
    if (profile.apiId === "sda-execution-api") {
        if (!(application instanceof ExecutionApiApplication)) {
            throw new Error("Execution API profile requires an execution API application.");
        }
        return Object.freeze({
            "submit-governed-execution": (input, context) => application.submit(input, context),
            "inspect-governed-execution": (input, context) => application.inspect(input, context),
            "read-execution-events": (input, context) => application.events(input, context),
            "read-execution-evidence": (input, context) => application.evidence(input, context)
        });
    }
    if (!(application instanceof RealizationApiApplication)) {
        throw new Error("Realization API profile requires a realization API application.");
    }
    return Object.freeze({
        "submit-realization-plan": (input, context) => application.submit(input, context),
        "inspect-realization-plan": (input, context) => application.inspect(input, context),
        "read-capability-registration": (input, context) => application.registration(input, context),
        "read-capability-availability": (input, context) => application.availability(input, context)
    });
}
export async function startNodeApiReferenceHost(options) {
    validateProfile(options.profile);
    const configured = loadOpenApiProjectionFixture({
        repositoryRoot: options.repositoryRoot,
        fixtureRef: options.projectionFixtureRef ?? "interfaces/sda-api/openapi-projection-fixture.json"
    });
    const profileAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "capabilities", "sda-tooling", "api-interface-projection", "contracts"));
    const profileSchema = options.profile.apiId === "sda-execution-api"
        ? "node-api-reference-host-profile.schema.json"
        : "node-realization-api-reference-host-profile.schema.json";
    const admittedProfile = profileAdmission.validate(options.profile, profileSchema);
    if (!admittedProfile.valid)
        throw new Error(`Node API reference host profile admission failed: ${JSON.stringify(admittedProfile.errors)}.`);
    const projection = await runConfiguredOpenApiProjection({
        repositoryRoot: options.repositoryRoot,
        ...(options.projectionFixtureRef ? { fixtureRef: options.projectionFixtureRef } : {})
    });
    const graph = projection.operationGraphRun.closure.evidence;
    const projected = projection.closure.evidence;
    if (!graph || !projected || projection.closure.obligationDisposition.kind !== "SATISFIED") {
        throw new Error("Node API reference host requires satisfied operation-graph and OpenAPI projection evidence.");
    }
    if (graph.graphDigest !== options.profile.operationGraphDigest ||
        projected.documentDigest !== options.profile.openApiDocumentDigest) {
        throw new Error("Node API reference host profile is stale for the admitted graph or OpenAPI document.");
    }
    const api = graph.apis.find((candidate) => candidate.apiId === options.profile.apiId);
    if (!api)
        throw new Error(`Node API reference host profile references unknown API '${options.profile.apiId}'.`);
    const routes = Object.freeze(api.operations.map(compileRoute));
    const handlers = operationHandlers(options.profile, options.application);
    for (const route of routes) {
        if (!handlers[route.operation.operationId]) {
            throw new Error(`Node API reference host has no handler for '${route.operation.operationId}'.`);
        }
        for (const requiredStatus of route.operation.method === "POST"
            ? [400, 401, 403, 408, 413, 415, 500]
            : [400, 401, 403, 404, 500])
            assertDeclaredResponse(route.operation, requiredStatus);
    }
    const sourceContracts = new Map(configured.operationGraphInput.contracts.map((contract) => [contract.contractId, contract]));
    const schemaAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "capabilities", "sda-tooling", "api-interface-projection", "contracts"));
    const server = http.createServer({ maxHeaderSize: options.profile.limits.maximumHeaderBytes }, async (request, response) => {
        let pathname = "/v1/unknown";
        let activeTraceId;
        let activeOperation;
        let requestId;
        try {
            const url = new URL(request.url ?? "", "http://reference.invalid");
            pathname = url.pathname;
            const method = request.method ?? "";
            const matched = matchRoute(routes, method, pathname);
            if (!matched) {
                const methods = pathExists(routes, pathname);
                if (methods.length > 0) {
                    response.setHeader("allow", methods.join(", "));
                    throw new ApiProblemError(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
                }
                throw new ApiProblemError(404, "ROUTE_NOT_FOUND", "Route was not found");
            }
            activeOperation = matched.route.operation;
            assertKnownQueryParameters(activeOperation, url);
            const principal = await verifiedPrincipal(request, options.accessTokens, options.profile);
            authorize(principal, activeOperation);
            const suppliedTraceparent = singleHeader(request, "traceparent");
            activeTraceId = traceId(suppliedTraceparent);
            requestId = options.identities.nextRequestId();
            const idempotencyKey = activeOperation.idempotency === "REQUIRED"
                ? singleHeader(request, "Idempotency-Key")?.trim()
                : undefined;
            if (activeOperation.idempotency === "REQUIRED" && (!idempotencyKey || idempotencyKey.length > 256)) {
                throw new ApiProblemError(400, "IDEMPOTENCY_KEY_INVALID", "Idempotency key is invalid");
            }
            const context = Object.freeze({
                principal,
                requestId,
                requestedAt: options.clock.now(),
                ...(idempotencyKey ? { idempotencyKey } : {}),
                ...(suppliedTraceparent ? { traceparent: suppliedTraceparent } : {})
            });
            let input;
            if (activeOperation.body) {
                const contentType = requestContentType(request);
                if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
                    throw new ApiProblemError(415, "MEDIA_TYPE_UNSUPPORTED", "Content type is unsupported");
                }
                const contentEncoding = singleHeader(request, "content-encoding")?.trim().toLowerCase();
                if (contentEncoding && contentEncoding !== "identity") {
                    throw new ApiProblemError(415, "CONTENT_ENCODING_UNSUPPORTED", "Content encoding is unsupported");
                }
                const bytes = await readBody(request, options.profile);
                if (bytes.length === 0)
                    throw new ApiProblemError(400, "REQUEST_BODY_REQUIRED", "Request body is required");
                try {
                    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                    input = parseStrictJson(decoded, options.profile.limits.maximumJsonDepth);
                }
                catch (error) {
                    if (error instanceof StrictJsonError) {
                        throw new ApiProblemError(400, "JSON_INVALID", "JSON request body is invalid", error.message);
                    }
                    if (error instanceof TypeError) {
                        throw new ApiProblemError(400, "JSON_INVALID", "JSON request body is invalid", "Request body is not valid UTF-8.");
                    }
                    throw error;
                }
            }
            else {
                if ((Number(singleHeader(request, "content-length") ?? "0") > 0) || singleHeader(request, "transfer-encoding")) {
                    throw new ApiProblemError(400, "REQUEST_BODY_NOT_ALLOWED", "Request body is not allowed");
                }
                input = queryInput(activeOperation, url, matched.pathParameters, request);
            }
            const inputContractId = activeOperation["x-sda-input-contract-id"];
            const inputContract = sourceContracts.get(inputContractId);
            if (!inputContract)
                throw new Error(`Input contract '${inputContractId}' did not resolve.`);
            const inputAdmission = schemaAdmission.validate(input, schemaFilename(inputContract.schemaRef));
            if (!inputAdmission.valid) {
                throw new ApiProblemError(400, "CONTRACT_ADMISSION_REJECTED", "Request contract admission failed");
            }
            const result = await handlers[activeOperation.operationId]?.(input, context);
            if (result === undefined) {
                throw new Error(`API operation '${activeOperation.operationId}' returned no evidence.`);
            }
            const resultContractId = activeOperation["x-sda-result-contract-id"];
            const resultContract = sourceContracts.get(resultContractId);
            if (!resultContract)
                throw new Error(`Result contract '${resultContractId}' did not resolve.`);
            const resultAdmission = schemaAdmission.validate(result, schemaFilename(resultContract.schemaRef));
            if (!resultAdmission.valid)
                throw new Error(`API result failed '${resultContractId}' admission.`);
            const success = activeOperation.responses.find((candidate) => candidate.disposition === "SUCCESS");
            if (!success)
                throw new Error(`Operation '${activeOperation.operationId}' has no success response.`);
            const location = result && typeof result === "object" && "links" in result &&
                result.links?.self;
            writeJson(response, success.statusCode, result, "application/json", {
                ...(typeof location === "string" && success.statusCode >= 201 ? { location } : {}),
                "x-sda-request-id": requestId,
                "x-sda-operation-id": activeOperation.operationId
            });
        }
        catch (error) {
            if (response.headersSent) {
                response.destroy();
                return;
            }
            const failure = error instanceof ApiProblemError
                ? error
                : new ApiProblemError(500, "INTERNAL_FAILURE", "Internal API failure");
            if (activeOperation)
                assertDeclaredResponse(activeOperation, failure.status);
            const body = problem(failure, pathname, activeTraceId);
            const result = schemaAdmission.validate(body, "api-problem.schema.json");
            if (!result.valid) {
                response.destroy(new Error("API problem projection failed contract admission."));
                return;
            }
            writeJson(response, failure.status, body, "application/problem+json", {
                ...(failure.status === 401 ? {
                    "www-authenticate": `Bearer realm="${options.profile.authentication.realm}"`
                } : {}),
                ...(requestId ? { "x-sda-request-id": requestId } : {}),
                ...(activeOperation ? { "x-sda-operation-id": activeOperation.operationId } : {})
            });
        }
    });
    server.requestTimeout = options.profile.limits.bodyReadTimeoutMilliseconds + 1_000;
    server.headersTimeout = Math.max(options.profile.limits.bodyReadTimeoutMilliseconds, 1_000);
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port ?? 0, "127.0.0.1", resolve);
    });
    const address = server.address();
    return Object.freeze({
        origin: `http://127.0.0.1:${address.port}`,
        profileDigest: options.profile.hostProfileDigest,
        operationGraphDigest: graph.graphDigest,
        openApiDocumentDigest: projected.documentDigest,
        close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    });
}
