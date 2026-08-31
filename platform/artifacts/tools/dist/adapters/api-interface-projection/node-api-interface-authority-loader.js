import fs from "node:fs";
import path from "node:path";
function safeRegularFile(repositoryRoot, relativeRef) {
    if (path.isAbsolute(relativeRef) || relativeRef.includes("\\")) {
        throw new Error(`API authority reference '${relativeRef}' is not a portable repository-relative path.`);
    }
    const segments = relativeRef.split("/");
    if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        throw new Error(`API authority reference '${relativeRef}' escapes the repository root.`);
    }
    const resolved = path.resolve(repositoryRoot, ...segments);
    const relative = path.relative(repositoryRoot, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`API authority reference '${relativeRef}' escapes the repository root.`);
    }
    const status = fs.lstatSync(resolved);
    if (status.isSymbolicLink() || !status.isFile()) {
        throw new Error(`API authority reference '${relativeRef}' is not a regular file.`);
    }
    const realFile = fs.realpathSync(resolved);
    const realRelative = path.relative(repositoryRoot, realFile);
    if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
        throw new Error(`API authority reference '${relativeRef}' resolves outside the repository root.`);
    }
    return realFile;
}
function readJson(repositoryRoot, relativeRef) {
    const file = safeRegularFile(repositoryRoot, relativeRef);
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`API authority JSON '${relativeRef}' could not be parsed: ${message}`);
    }
}
function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const member of Object.values(value))
        freezeDeep(member);
    return Object.freeze(value);
}
export function loadApiOperationGraphFixture(options) {
    const repositoryRoot = fs.realpathSync(options.repositoryRoot);
    const fixture = readJson(repositoryRoot, options.fixtureRef);
    if (fixture.fixtureType !== "sda-api-operation-graph-projection-fixture.v1" ||
        !Array.isArray(fixture.interfaceAuthorityRefs) || fixture.interfaceAuthorityRefs.length === 0 ||
        !Array.isArray(fixture.capabilityRefs) || fixture.capabilityRefs.length === 0 ||
        typeof fixture.contractCatalogRef !== "string") {
        throw new Error("API operation graph fixture is incomplete.");
    }
    const catalog = readJson(repositoryRoot, fixture.contractCatalogRef);
    if (catalog.catalogType !== "sda-api-contract-catalog.v1" ||
        !Array.isArray(catalog.contracts) || catalog.contracts.length === 0) {
        throw new Error("API contract catalog is incomplete.");
    }
    const contracts = catalog.contracts.map((entry) => {
        const schema = readJson(repositoryRoot, entry.schemaRef);
        if (!schema || typeof schema !== "object" || typeof schema["$id"] !== "string") {
            throw new Error(`API contract '${entry.contractId}' has no schema identity.`);
        }
        return {
            contractId: entry.contractId,
            schemaRef: entry.schemaRef,
            schemaId: schema["$id"],
            schemaDigest: entry.schemaDigest,
            schema
        };
    });
    return freezeDeep({
        inputType: "sda-api-operation-graph-derivation-input.v1",
        interfaceAuthorities: fixture.interfaceAuthorityRefs.map((reference) => readJson(repositoryRoot, reference)),
        capabilities: fixture.capabilityRefs.map((reference) => readJson(repositoryRoot, reference)),
        contracts
    });
}
export function loadOpenApiProjectionFixture(options) {
    const repositoryRoot = fs.realpathSync(options.repositoryRoot);
    const fixture = readJson(repositoryRoot, options.fixtureRef);
    if (fixture.fixtureType !== "sda-openapi-projection-fixture.v1" ||
        typeof fixture.operationGraphFixtureRef !== "string" ||
        typeof fixture.profileRef !== "string") {
        throw new Error("OpenAPI projection fixture is incomplete.");
    }
    return freezeDeep({
        operationGraphInput: loadApiOperationGraphFixture({
            repositoryRoot,
            fixtureRef: fixture.operationGraphFixtureRef
        }),
        profile: readJson(repositoryRoot, fixture.profileRef)
    });
}
export function loadNodeApiReferenceHostProfile(options) {
    const repositoryRoot = fs.realpathSync(options.repositoryRoot);
    return freezeDeep(readJson(repositoryRoot, options.profileRef ?? "interfaces/sda-api/execution-host-profile.json"));
}
export function loadNodeRealizationApiReferenceHostProfile(options) {
    const repositoryRoot = fs.realpathSync(options.repositoryRoot);
    return freezeDeep(readJson(repositoryRoot, options.profileRef ?? "interfaces/sda-api/realization-host-profile.json"));
}
