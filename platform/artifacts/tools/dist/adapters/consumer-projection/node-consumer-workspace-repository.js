import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
function readFact(repositoryRoot, filePath, clock) {
    const content = fs.readFileSync(filePath, "utf8");
    return Object.freeze({
        sourceRef: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
        digest: digest(content),
        observedAt: clock.now(),
        value: JSON.parse(content)
    });
}
function readTextFact(repositoryRoot, filePath, clock) {
    const content = fs.readFileSync(filePath, "utf8");
    return Object.freeze({
        sourceRef: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
        digest: digest(content),
        observedAt: clock.now(),
        value: content
    });
}
function requireFile(workspaceRoot, relativePath, label) {
    const resolved = path.resolve(workspaceRoot, relativePath);
    if (!fs.existsSync(resolved))
        throw new Error(`Missing ${label}: ${resolved}`);
    return resolved;
}
function requirePlatformFile(repositoryRoot, declaredPath, canonicalPath, label) {
    const normalizedDeclaration = declaredPath.replaceAll("\\", "/");
    const normalizedCanonical = canonicalPath.replaceAll("\\", "/");
    if (!normalizedDeclaration.endsWith(normalizedCanonical)) {
        throw new Error(`${label} does not identify canonical platform authority '${normalizedCanonical}'.`);
    }
    return requireFile(repositoryRoot, canonicalPath, label);
}
function validateOrThrow(admission, value, schema, label) {
    const result = admission.validate(value, schema);
    if (!result.valid)
        throw new Error(`${label} failed validation against ${schema}:\n${JSON.stringify(result.errors, null, 2)}`);
}
function executableOrigin(workspaceRoot) {
    const unauthorizedFiles = [];
    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.name === "projected")
                continue;
            if (entry.isDirectory() && ["bin", "obj", "csharp-projection-build"].includes(entry.name))
                continue;
            const full = path.join(directory, entry.name);
            if (entry.isDirectory())
                walk(full);
            else if (/\.(?:js|mjs|cjs|ts|tsx|cs|py|java|sh|ps1)$/.test(entry.name)) {
                unauthorizedFiles.push(path.relative(workspaceRoot, full).replaceAll("\\", "/"));
            }
        }
    };
    walk(workspaceRoot);
    return Object.freeze({
        originType: "consumer-executable-origin.v1",
        disposition: unauthorizedFiles.length === 0 ? "PROJECTED_ONLY" : "REJECTED",
        unauthorizedFiles: Object.freeze(unauthorizedFiles.sort())
    });
}
function materializeBinding(workspaceRoot, binding, admission) {
    const reference = binding.configuration?.transformationAuthorityRef;
    const transformationId = binding.configuration?.transformationId;
    if (typeof reference !== "string")
        return binding;
    const authority = JSON.parse(fs.readFileSync(requireFile(workspaceRoot, reference, "semantic transformation authority"), "utf8"));
    validateOrThrow(admission, authority, "semantic-transformation-authority.schema.json", "Semantic transformation authority");
    const transformations = Array.isArray(authority.transformations) ? authority.transformations : [];
    const transformation = transformations.find((item) => item.id === transformationId);
    if (!transformation)
        throw new Error(`Missing transformation '${String(transformationId)}' in '${reference}'.`);
    return { ...binding, configuration: { expression: transformation.expression } };
}
function uiAuthorityFacts(repositoryRoot, workspaceRoot, authority, admission, clock) {
    const references = [...new Set(authority.interfaces
            .filter((binding) => binding.kind === "ui")
            .map((binding) => binding.configuration?.authorityRef)
            .filter((reference) => typeof reference === "string"))];
    return Object.freeze(references.map((authorityRef) => {
        const fact = readFact(repositoryRoot, requireFile(workspaceRoot, authorityRef, "consumer UI authority"), clock);
        validateOrThrow(admission, fact.value, "consumer-ui-authority.schema.json", "Consumer UI authority");
        return Object.freeze({ authorityRef, fact });
    }));
}
function materializeInterfaceBinding(binding, authorities) {
    if (binding.kind !== "ui")
        return binding;
    const authorityRef = binding.configuration?.authorityRef;
    const found = authorities.find((candidate) => candidate.authorityRef === authorityRef);
    if (!found)
        throw new Error(`Missing consumer UI authority '${String(authorityRef)}'.`);
    return {
        ...binding,
        configuration: {
            authorityRef: found.authorityRef,
            authorityDigest: found.fact.digest,
            authority: found.fact.value
        }
    };
}
function contractAuthorities(workspaceRoot, authority) {
    if (!authority.contractCatalog)
        return null;
    const catalogPath = requireFile(workspaceRoot, authority.contractCatalog, "contract catalog authority");
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    const directory = path.dirname(catalogPath);
    return {
        authorityType: "consumer-contract-authorities.v1",
        contracts: Object.fromEntries(Object.entries(catalog).map(([contractId, schemaRef]) => {
            const schemaPath = requireFile(directory, schemaRef, `schema authority '${contractId}'`);
            const schemaText = fs.readFileSync(schemaPath, "utf8");
            const schema = JSON.parse(schemaText);
            return [contractId, {
                    schemaRef,
                    ...(typeof schema.$id === "string" ? { schemaId: schema.$id } : {}),
                    schemaDigest: createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
                    schema
                }];
        }))
    };
}
export class NodeConsumerWorkspaceRepository {
    repositoryRoot;
    admission;
    clock;
    constructor(repositoryRoot, admission, clock) {
        this.repositoryRoot = repositoryRoot;
        this.admission = admission;
        this.clock = clock;
    }
    load(workspaceRoot) {
        const root = path.resolve(workspaceRoot);
        const workspacePath = requireFile(root, "consumer-workspace.authority.json", "consumer workspace authority");
        const workspace = readFact(this.repositoryRoot, workspacePath, this.clock);
        validateOrThrow(this.admission, workspace.value, "consumer-workspace-authority.schema.json", "Consumer workspace authority");
        if (workspace.value.capabilities.length !== 1) {
            throw new Error("This compiler invocation requires exactly one capability declaration per consumer workspace root.");
        }
        const declaration = workspace.value.capabilities[0];
        if (!declaration)
            throw new Error("Consumer workspace has no capability declaration.");
        const feature = readTextFact(this.repositoryRoot, requireFile(root, declaration.feature, "feature authority"), this.clock);
        const semanticGraph = readFact(this.repositoryRoot, requireFile(root, declaration.semanticGraph, "semantic graph authority"), this.clock);
        const capabilityAuthority = readFact(this.repositoryRoot, requireFile(root, declaration.capability, "capability authority"), this.clock);
        const executionAuthorities = readFact(this.repositoryRoot, requireFile(root, declaration.executionAuthorities, "execution authority"), this.clock);
        const projectionAuthorities = readFact(this.repositoryRoot, requireFile(root, declaration.projectionAuthorities, "projection authority"), this.clock);
        const interfaceAuthority = readFact(this.repositoryRoot, requireFile(root, declaration.interfaces, "interface authority"), this.clock);
        const fixtures = readFact(this.repositoryRoot, requireFile(root, declaration.fixtures, "fixture authority"), this.clock);
        const queryAuthority = readFact(this.repositoryRoot, requirePlatformFile(this.repositoryRoot, workspace.value.conformanceQuery, "kernel/semantic-authority/consumer/scenario-conformance-closure.query-authority.json", "conformance query authority"), this.clock);
        const telemetryAuthority = readFact(this.repositoryRoot, requirePlatformFile(this.repositoryRoot, workspace.value.telemetryAuthority, "kernel/semantic-authority/consumer/scenario-execution.telemetry-authority.json", "telemetry authority"), this.clock);
        const platformCapabilityCatalog = readFact(this.repositoryRoot, requirePlatformFile(this.repositoryRoot, workspace.value.platformCapabilityCatalog, "kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json", "SDA platform capability catalog"), this.clock);
        const mandatoryMechanicProfile = readFact(this.repositoryRoot, path.join(this.repositoryRoot, "kernel", "semantic-authority", "consumer", "sda-platform-mechanic-parity.semantic-authority.json"), this.clock);
        const declaredExecutionVector = workspace.value.kernel.executionVector;
        if (typeof declaredExecutionVector !== "string") {
            throw new Error("Consumer workspace does not declare one scenario-kernel execution vector.");
        }
        const executionVector = readFact(this.repositoryRoot, requirePlatformFile(this.repositoryRoot, declaredExecutionVector, "kernel/contracts/execution/scenario-kernel-execution-vector.json", "scenario-kernel execution vector"), this.clock);
        validateOrThrow(this.admission, executionAuthorities.value, "consumer-execution-authorities.schema.json", "Execution authorities");
        validateOrThrow(this.admission, projectionAuthorities.value, "consumer-projection-authorities.schema.json", "Projection authorities");
        validateOrThrow(this.admission, interfaceAuthority.value, "consumer-interface-authority.schema.json", "Interface authority");
        validateOrThrow(this.admission, platformCapabilityCatalog.value, "sda-platform-capability-catalog.schema.json", "SDA platform capability catalog");
        validateOrThrow(this.admission, mandatoryMechanicProfile.value, "sda-platform-mechanic-parity.schema.json", "Mandatory consumer mechanic profile");
        validateOrThrow(this.admission, fixtures.value, "consumer-capability-fixtures.schema.json", "Consumer fixture authority");
        validateOrThrow(this.admission, queryAuthority.value, "consumer-conformance-query-authority.schema.json", "Conformance query authority");
        validateOrThrow(this.admission, telemetryAuthority.value, "consumer-telemetry-authority.schema.json", "Telemetry authority");
        const uiAuthorities = uiAuthorityFacts(this.repositoryRoot, root, interfaceAuthority.value, this.admission, this.clock);
        const inspectableQueryCatalog = workspace.value.queryCatalog
            ? readFact(this.repositoryRoot, requireFile(root, workspace.value.queryCatalog, "inspectable query catalog"), this.clock)
            : null;
        if (inspectableQueryCatalog) {
            validateOrThrow(this.admission, inspectableQueryCatalog.value, "inspectable-query-catalog.schema.json", "Inspectable query catalog");
        }
        const resolvedInterfaceAuthority = {
            ...interfaceAuthority.value,
            interfaces: interfaceAuthority.value.interfaces.map((binding) => materializeInterfaceBinding(binding, uiAuthorities)),
            portBindings: interfaceAuthority.value.portBindings.map((binding) => materializeBinding(root, binding, this.admission)),
            projectionBindings: interfaceAuthority.value.projectionBindings.map((binding) => materializeBinding(root, binding, this.admission))
        };
        return Object.freeze({
            factsType: "consumer-workspace-facts.v1",
            workspaceRoot: root,
            workspace,
            declaration,
            feature,
            semanticGraph,
            capabilityAuthority,
            executionAuthorities,
            projectionAuthorities,
            interfaceAuthority,
            resolvedInterfaceAuthority,
            uiAuthorities,
            contractAuthorities: contractAuthorities(root, interfaceAuthority.value),
            inspectableQueryCatalog,
            fixtures,
            queryAuthority,
            telemetryAuthority,
            platformCapabilityCatalog,
            mandatoryMechanicProfile,
            executionVector,
            executableOrigin: executableOrigin(root)
        });
    }
}
export { executableOrigin as observeConsumerExecutableOrigin };
