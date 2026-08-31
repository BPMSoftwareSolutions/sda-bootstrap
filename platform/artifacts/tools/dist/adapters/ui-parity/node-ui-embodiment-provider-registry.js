import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../contracts/ajv-schema-admission.cjs";
const PACKAGE_ROOT = "capabilities/sda-platform/ui-presentation-protocol";
function safe(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
class BrowserModuleShellUiEmbodimentProvider {
    profile;
    providerId;
    embodimentTarget;
    capabilityId;
    implementationRef;
    constructor(profile) {
        this.profile = profile;
        this.providerId = profile.providerId;
        this.embodimentTarget = profile.embodimentTarget;
        this.capabilityId = profile.capabilityId;
        this.implementationRef = profile.implementationRef;
    }
    materialize(request) {
        if (request.target !== this.embodimentTarget || request.capabilityId !== this.capabilityId) {
            throw new Error(`UI_EMBODIMENT_PROVIDER_REQUEST_DIVERGENCE: '${this.providerId}'.`);
        }
        const config = this.profile.configuration;
        const target = config.outputRoot;
        const scriptElements = config.scripts.map((source) => `  <script src="${source}"></script>`).join("\n");
        const html = `<!doctype html>\n<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <base href="${config.documentBaseHref}" />\n  <title>${safe(request.authority.title)}</title>\n  <link rel="stylesheet" href="/__sda/browser/authority-backed-application.css" />\n</head>\n<body>\n  <main id="${config.rootElementId}"></main>\n${scriptElements ? `${scriptElements}\n` : ""}  <script type="module" src="./application.generated.mjs"></script>\n</body>\n</html>\n`;
        const seam = `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\nimport mountPresentationApplication from "${config.runtimeModuleUrl}";\nmountPresentationApplication("${config.rootElementId}", "./authority/ui-presentation-ir.${target}.json");\n`;
        return Object.freeze([
            { relativePath: `${target}/authority/ui-presentation-ir.${target}.json`, content: json(request.compilation.ir), sourcePointers: [request.authorityRef] },
            { relativePath: `${target}/authority/ui-presentation-compilation-evidence.${target}.json`, content: json(request.compilation.evidence), sourcePointers: [request.authorityRef] },
            { relativePath: `${target}/authority/ui-authority.${target}.json`, content: request.authorityContent, sourcePointers: [request.authorityRef] },
            { relativePath: `${target}/authority/ui-authority.identity.json`, content: request.identityContent, sourcePointers: [request.authorityRef] },
            { relativePath: `${target}/authority/ui-vectors.${target}.json`, content: request.vectorContent, sourcePointers: [request.vectorRef] },
            { relativePath: `${target}/authority/ui-experience-coverage.${target}.json`, content: request.coverageContent, sourcePointers: [request.coverageRef] },
            { relativePath: `${target}/authority/ui-object-model.${target}.json`, content: request.objectModelContent, sourcePointers: [request.objectModelRef] },
            { relativePath: `${target}/index.generated.html`, content: html, sourcePointers: [request.authorityRef] },
            { relativePath: `${target}/application.generated.mjs`, content: seam, sourcePointers: [request.authorityRef] }
        ].map((draft) => Object.freeze({ ...draft, sourcePointers: Object.freeze(draft.sourcePointers) })));
    }
}
export class NodeUiEmbodimentProviderRegistry {
    providers;
    constructor(repositoryRoot) {
        const packageRoot = path.join(repositoryRoot, PACKAGE_ROOT);
        const registry = JSON.parse(fs.readFileSync(path.join(packageRoot, "provider-registry.json"), "utf8"));
        const admission = new AjvSchemaAdmission(path.join(packageRoot, "contracts"))
            .validate(registry, "ui-embodiment-provider-registry.v1.schema.json");
        if (!admission.valid)
            throw new Error(`UI_EMBODIMENT_PROVIDER_REGISTRY_NOT_ADMITTED: ${JSON.stringify(admission.errors)}`);
        const identity = JSON.parse(fs.readFileSync(path.join(packageRoot, "protocol.identity.json"), "utf8"));
        if (registry.protocolSchemaDigest !== identity.schemaDigest)
            throw new Error("UI_EMBODIMENT_PROVIDER_PROTOCOL_DIVERGENCE");
        this.providers = Object.freeze(registry.providers.map((profile) => {
            if (!fs.existsSync(path.join(repositoryRoot, profile.implementationRef))) {
                throw new Error(`MISSING_UI_EMBODIMENT_PROVIDER_IMPLEMENTATION: '${profile.implementationRef}'.`);
            }
            return new BrowserModuleShellUiEmbodimentProvider(profile);
        }));
    }
    discover(target, capabilityId) {
        const matches = this.providers.filter((provider) => provider.embodimentTarget === target && provider.capabilityId === capabilityId);
        if (matches.length > 1)
            throw new Error(`UI_EMBODIMENT_PROVIDER_AMBIGUITY: '${target}' resolved ${matches.length} providers.`);
        return matches[0] ?? null;
    }
}
