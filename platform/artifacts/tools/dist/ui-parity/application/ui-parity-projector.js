import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { NodeUiEmbodimentProviderRegistry } from "../../adapters/ui-parity/node-ui-embodiment-provider-registry.js";
import { sha256 } from "../../primitives/sha256.js";
import { evaluateMechanicalSterility } from "../../consumer-projection/proof/mechanical-sterility-evaluator.js";
import { canonicalDigest, loadUiParityWorkspace } from "../proof/canonical-ui-authority.js";
import { admitUiClaimantImplementation } from "../proof/claimant-implementation-admission.js";
import { resolveUiFeatureCapabilities } from "../proof/ui-feature-admission.js";
import { UiPresentationCompiler } from "./ui-presentation-compiler.js";
function projected(relativePath, content, sourcePointers) {
    return Object.freeze({ relativePath, content, digest: sha256(content), sourcePointers: Object.freeze([...sourcePointers]) });
}
function safe(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function renderHtml(title) {
    return `<!doctype html>\n<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <base href="/html/" />\n  <title>${safe(title)}</title>\n  <link rel="stylesheet" href="/__sda/browser/authority-backed-application.css" />\n</head>\n<body>\n  <main id="sda-root"></main>\n  <script type="module" src="./application.generated.mjs"></script>\n</body>\n</html>\n`;
}
function renderHtmlApplicationSeam() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\nimport mountAuthorityApplication from "/__sda/html/authority-backed-dom-application.mjs";\nmountAuthorityApplication("sda-root", "./authority/ui-authority.html.json");\n`;
}
function renderJavaFxSeam() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\npackage sda.projected;\n\nimport scenario.kernel.javafx.AuthorityBackedJavaFxApplication;\n\npublic final class ProjectedApplication {\n  private ProjectedApplication() {}\n  public static void main(String[] args) {\n    AuthorityBackedJavaFxApplication.launchAuthority("authority/ui-authority.javafx.json", System.getProperty("sda.ui.platform-origin", "http://127.0.0.1:43137"), args);\n  }\n}\n`;
}
function renderJavaFxPom() {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>sda.projected</groupId><artifactId>projected-javafx-consumer</artifactId><version>0.0.0</version><properties><maven.compiler.release>21</maven.compiler.release></properties><dependencies><dependency><groupId>dev.scenariodriven</groupId><artifactId>scenario-kernel-javafx</artifactId><version>0.0.0</version></dependency></dependencies><build><plugins><plugin><groupId>org.openjfx</groupId><artifactId>javafx-maven-plugin</artifactId><version>0.0.8</version><configuration><mainClass>sda.projected.ProjectedApplication</mainClass></configuration></plugin></plugins></build></project>\n`;
}
function swiftPath(value) { return value.replaceAll("\\", "/"); }
function safeProjectionPath(target, candidate) {
    const normalized = candidate.replaceAll("\\", "/");
    if (path.isAbsolute(candidate) || normalized.split("/").includes("..") || !normalized.startsWith(`${target}/`)) {
        throw new Error(`UNSAFE_UI_PROJECTION_PATH: '${candidate}' must remain beneath '${target}/'.`);
    }
    return normalized;
}
function renderSwiftPackage(repositoryRoot) {
    return `// swift-tools-version: 5.10\n// GENERATED PURE UI PROJECTION. Do not hand-edit.\nimport PackageDescription\nlet package = Package(name: "ProjectedSwiftUiConsumer", platforms: [.macOS(.v14)], dependencies: [.package(name: "ScenarioKernelSwiftUI", path: "${swiftPath(path.join(repositoryRoot, "languages", "swift", "presentation", "swiftui"))}")], targets: [.executableTarget(name: "ProjectedConsumer", dependencies: [.product(name: "ScenarioKernelSwiftUI", package: "ScenarioKernelSwiftUI")], resources: [.copy("authority")])])\n`;
}
function renderSwiftSeam() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\nimport SwiftUI\nimport ScenarioKernelSwiftUI\n\n@main struct ProjectedConsumerApplication: App {\n  var body: some Scene {\n    WindowGroup { AuthorityBackedApplication(authorityURL: Bundle.module.url(forResource: "ui-authority.swiftui", withExtension: "json", subdirectory: "authority")!, platformOrigin: URL(string: ProcessInfo.processInfo.environment["SDA_UI_PLATFORM_ORIGIN"] ?? "http://127.0.0.1:43137")!) }\n  }\n}\n`;
}
function renderComposeSettings(repositoryRoot) {
    return `// GENERATED PURE UI PROJECTION. Do not hand-edit.\npluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = "ProjectedComposeConsumer"\ninclude(":app")\ninclude(":scenarioKernelCompose")\nproject(":scenarioKernelCompose").projectDir = file("${swiftPath(path.join(repositoryRoot, "languages", "kotlin", "presentation", "android-compose", "runtime"))}")\n`;
}
function renderComposeBuild() {
    return `// GENERATED PURE UI PROJECTION. Do not hand-edit.\nplugins { id("com.android.application") version "8.6.1" apply false; id("com.android.library") version "8.6.1" apply false; id("org.jetbrains.kotlin.android") version "2.0.20" apply false; id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false; id("org.jetbrains.kotlin.plugin.serialization") version "2.0.20" apply false }\n`;
}
function renderComposeAppBuild() {
    return `// GENERATED PURE UI PROJECTION. Do not hand-edit.\nplugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }\nandroid { namespace = "sda.projected"; compileSdk = 35; defaultConfig { applicationId = "sda.projected.consumer"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.0.0" }; buildFeatures { compose = true }; compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }; kotlinOptions { jvmTarget = "21" } }\ndependencies { implementation(project(":scenarioKernelCompose")) }\n`;
}
function renderComposeManifest() {
    return `<?xml version="1.0" encoding="utf-8"?>\n<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:theme="@android:style/Theme.Material.Light.NoActionBar" android:usesCleartextTraffic="true"><activity android:name=".ProjectedConsumerActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>\n`;
}
function renderComposeSeam() {
    return `// GENERATED PURE UI PROJECTION SEAM. Do not hand-edit.\npackage sda.projected\n\nimport dev.scenariodriven.compose.AuthorityBackedComposeActivity\n\nclass ProjectedConsumerActivity : AuthorityBackedComposeActivity() {\n  override val authorityAsset = "ui-authority.android-compose.json"\n}\n`;
}
function projectionPlan(files) {
    return files.map((file) => ({ relativePath: file.relativePath, content: file.content, digest: file.digest,
        sourcePointers: file.sourcePointers, target: "shared" }));
}
export class UiParityProjector {
    repositoryRoot;
    providerDiscovery;
    constructor(repositoryRoot, providerDiscovery) {
        this.repositoryRoot = repositoryRoot;
        this.providerDiscovery = providerDiscovery ?? new NodeUiEmbodimentProviderRegistry(repositoryRoot);
    }
    project(workspaceRoot, options = {}) {
        const documents = loadUiParityWorkspace(workspaceRoot);
        const authorityAdmission = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"))
            .validate(documents.authority, "consumer-ui-authority.schema.json");
        if (!authorityAdmission.valid)
            throw new Error(`UNCONSUMED_UI_AUTHORITY_FIELD: ${JSON.stringify(authorityAdmission.errors)}`);
        const catalogRef = "kernel/semantic-authority/consumer/sda-ui-embodiment-capabilities.semantic-authority.json";
        const featureCatalogRef = "capabilities/sda-platform/ui-embodiment/feature-capabilities.json";
        const protocolIdentityRef = "capabilities/sda-platform/ui-presentation-protocol/protocol.identity.json";
        const providerRegistryRef = "capabilities/sda-platform/ui-presentation-protocol/provider-registry.json";
        const objectModelRef = "kernel/semantic-authority/consumer/consumer-ui-object-model.semantic-authority.json";
        const objectModel = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, objectModelRef), "utf8"));
        const catalog = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, catalogRef), "utf8"));
        const featureCatalog = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, featureCatalogRef), "utf8"));
        const freeze = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, "governance/ui/consumer-ui-authority-v1.freeze.json"), "utf8"));
        if (featureCatalog.protocol.schemaDigest !== freeze.schemaDigest) {
            throw new Error(`UI_FEATURE_CATALOG_PROTOCOL_DIVERGENCE: expected '${freeze.schemaDigest}' observed '${featureCatalog.protocol.schemaDigest}'.`);
        }
        const requested = options.targets ? [...new Set(options.targets)] : catalog.capabilities.map((capability) => capability.embodimentTarget);
        const capabilities = requested.map((target) => {
            const capability = catalog.capabilities.find((candidate) => candidate.embodimentTarget === target);
            if (!capability)
                throw new Error(`UNKNOWN_SDA_UI_EMBODIMENT_TARGET: '${target}'.`);
            return capability;
        });
        const compilation = new UiPresentationCompiler(this.repositoryRoot).compile(documents.authority);
        const discoveredProviders = new Map();
        for (const capability of capabilities) {
            const provider = this.providerDiscovery.discover(capability.embodimentTarget, capability.capabilityId);
            if (provider)
                discoveredProviders.set(capability.embodimentTarget, provider);
        }
        const admitted = capabilities.filter((capability) => capability.status === "ADMITTED");
        const declared = capabilities.filter((capability) => capability.status === "DECLARED");
        if (admitted.length < 2)
            throw new Error("Cross-apply UI projection requires at least two admitted embodiment capabilities.");
        const staticAdmissions = new Map();
        const featureAdmissions = new Map();
        for (const capability of capabilities) {
            for (const reference of [capability.implementationRef, capability.conformanceRef, capability.staticConformanceRef]) {
                if (!fs.existsSync(path.join(this.repositoryRoot, reference)))
                    throw new Error(`MISSING_SDA_UI_EMBODIMENT_CAPABILITY: '${capability.embodimentTarget}' reference '${reference}' does not exist.`);
            }
            if (capability.status === "ADMITTED" && capability.implementationDisposition !== "NATIVE_PROOF_ADMITTED") {
                throw new Error(`UI claimant '${capability.embodimentTarget}' cannot be ADMITTED without native proof admission.`);
            }
            const featureAdmission = resolveUiFeatureCapabilities(documents.authority, featureCatalog, capability.embodimentTarget, capability.capabilityId);
            featureAdmissions.set(capability.embodimentTarget, featureAdmission);
            for (const reference of featureAdmission.resolutions.flatMap((resolution) => resolution.evidenceRefs)) {
                if (!fs.existsSync(path.join(this.repositoryRoot, reference))) {
                    throw new Error(`MISSING_UI_FEATURE_EVIDENCE: '${capability.embodimentTarget}' feature evidence '${reference}' does not exist.`);
                }
            }
            if (featureAdmission.disposition !== "SUPPORTED") {
                const missing = featureAdmission.resolutions.filter((resolution) => resolution.disposition === "NOT_SUPPORTED")
                    .map((resolution) => resolution.featureId);
                throw new Error(`NOT_SUPPORTED_UI_FEATURE: '${capability.embodimentTarget}' lacks ${missing.join(", ")}.`);
            }
            if (capability.staticConformanceRef.endsWith(".json")) {
                const staticDocument = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, capability.staticConformanceRef), "utf8"));
                const staticValidation = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"))
                    .validate(staticDocument, "consumer-ui-claimant-implementation.schema.json");
                if (!staticValidation.valid)
                    throw new Error(`UI claimant '${capability.embodimentTarget}' static manifest is not schema-admitted: ${JSON.stringify(staticValidation.errors)}`);
                if (staticDocument.disposition !== capability.implementationDisposition) {
                    throw new Error(`UI claimant '${capability.embodimentTarget}' static disposition '${staticDocument.disposition}' differs from catalog '${capability.implementationDisposition}'.`);
                }
                const admission = admitUiClaimantImplementation(this.repositoryRoot, capability.staticConformanceRef, capability.embodimentTarget, objectModel);
                if (admission.disposition !== "PASS")
                    throw new Error(`UI claimant '${capability.embodimentTarget}' static implementation failed: ${admission.findings.join("; ")}`);
                staticAdmissions.set(capability.embodimentTarget, admission);
            }
            else if (capability.implementationDisposition === "IMPLEMENTED_AWAITING_NATIVE_PROOF") {
                throw new Error(`UI claimant '${capability.embodimentTarget}' awaiting native proof must provide a JSON static implementation manifest.`);
            }
        }
        const outputRoot = path.join(path.resolve(workspaceRoot), "projected");
        const authorityContent = `${JSON.stringify(documents.authority, null, 2)}\n`;
        const identityContent = `${JSON.stringify(documents.identity, null, 2)}\n`;
        const vectorContent = `${JSON.stringify(documents.vectors, null, 2)}\n`;
        const coverageContent = `${JSON.stringify(documents.coverage, null, 2)}\n`;
        const objectModelContent = `${JSON.stringify(objectModel, null, 2)}\n`;
        const registry = {
            targetRegistryType: "consumer-ui-claimant-registry.v1",
            authorityDigest: documents.identity.authorityDigest,
            vectorCorpusDigest: canonicalDigest(documents.vectors),
            admittedTargets: admitted.map((capability) => capability.embodimentTarget),
            declaredTargets: declared.map((capability) => capability.embodimentTarget),
            claimants: capabilities.map((capability) => ({ capabilityId: capability.capabilityId,
                target: capability.embodimentTarget, status: capability.status, implementationDisposition: capability.implementationDisposition,
                embodimentProviderId: discoveredProviders.get(capability.embodimentTarget)?.providerId ?? null,
                presentationProtocolType: compilation.ir.presentationIrType,
                presentationIrDigest: compilation.evidence.presentationIrDigest,
                featureAdmission: featureAdmissions.get(capability.embodimentTarget),
                staticImplementation: staticAdmissions.get(capability.embodimentTarget) ?? null,
                toolchainRequirements: capability.toolchainRequirements ?? [] }))
        };
        const files = [
            projected("ui-parity/authority-identity.json", identityContent, [documents.authorityRef]),
            projected("ui-parity/vectors.json", vectorContent, [documents.vectorRef]),
            projected("ui-parity/experience-coverage.json", coverageContent, [documents.coverageRef]),
            projected("ui-parity/object-model.json", objectModelContent, [objectModelRef]),
            projected("ui-parity/presentation-ir.json", `${JSON.stringify(compilation.ir, null, 2)}\n`, [documents.authorityRef, protocolIdentityRef]),
            projected("ui-parity/presentation-compilation-evidence.json", `${JSON.stringify(compilation.evidence, null, 2)}\n`, [documents.authorityRef, protocolIdentityRef]),
            projected("ui-parity/targets.json", `${JSON.stringify(registry, null, 2)}\n`, [catalogRef, featureCatalogRef, providerRegistryRef, documents.authorityRef, documents.vectorRef])
        ];
        const appendTarget = (target, capability, targetFiles) => {
            const sterility = evaluateMechanicalSterility(projectionPlan(targetFiles));
            if (sterility.disposition !== "PURE_PROJECTION_CONFORMS") {
                throw new Error(`${target.toUpperCase()}_PROJECTION_STERILITY_FAILED: ${JSON.stringify(sterility.violations)}`);
            }
            targetFiles.push(projected(`${target}/projection-conformance.json`, `${JSON.stringify(sterility, null, 2)}\n`, [documents.authorityRef]));
            const manifest = {
                projectionManifestType: "consumer-ui-embodiment-projection-manifest.v1", generator: "scenario-driven-architecture/tools/src/ui-parity",
                target, claimantStatus: capability.status, implementationDisposition: capability.implementationDisposition,
                uiEmbodimentCapability: capability.capabilityId, authorityDigest: documents.identity.authorityDigest,
                embodimentProviderId: discoveredProviders.get(target)?.providerId ?? null,
                presentationProtocolType: compilation.ir.presentationIrType,
                presentationProtocolSchemaDigest: compilation.evidence.protocolSchemaDigest,
                presentationIrDigest: compilation.evidence.presentationIrDigest,
                featureCatalogDigest: canonicalDigest(featureCatalog), featureAdmission: featureAdmissions.get(target),
                objectModelDigest: canonicalDigest(objectModel), vectorCorpusDigest: canonicalDigest(documents.vectors),
                executableOrigin: "PROJECTED_ONLY", nativeTestimonyDisposition: capability.status === "ADMITTED" ? "REQUIRED" : "NOT_ADMITTED",
                files: targetFiles.map((file) => ({ path: file.relativePath, digest: file.digest, sourcePointers: file.sourcePointers }))
            };
            targetFiles.push(projected(`${target}/projection-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, [documents.authorityRef, documents.vectorRef, documents.coverageRef, objectModelRef, catalogRef, featureCatalogRef,
                protocolIdentityRef, providerRegistryRef, capability.staticConformanceRef]));
            files.push(...targetFiles);
        };
        for (const capability of capabilities.filter((candidate) => discoveredProviders.has(candidate.embodimentTarget))) {
            const provider = discoveredProviders.get(capability.embodimentTarget);
            const drafts = provider.materialize({
                target: capability.embodimentTarget,
                capabilityId: capability.capabilityId,
                authority: documents.authority,
                authorityRef: documents.authorityRef,
                authorityContent,
                identity: documents.identity,
                identityContent,
                vectorRef: documents.vectorRef,
                vectorContent,
                coverageRef: documents.coverageRef,
                coverageContent,
                objectModelRef,
                objectModel,
                objectModelContent,
                compilation
            });
            appendTarget(capability.embodimentTarget, capability, drafts.map((draft) => projected(draft.relativePath, draft.content, draft.sourcePointers)));
        }
        for (const target of admitted.map((capability) => capability.embodimentTarget)
            .filter((value) => value === "html" && !discoveredProviders.has(value))) {
            const targetFiles = [
                projected(`${target}/authority/ui-authority.${target}.json`, authorityContent, [documents.authorityRef]),
                projected(`${target}/authority/ui-authority.identity.json`, identityContent, [documents.authorityRef]),
                projected(`${target}/authority/ui-vectors.${target}.json`, vectorContent, [documents.vectorRef]),
                projected(`${target}/authority/ui-experience-coverage.${target}.json`, coverageContent, [documents.coverageRef]),
                projected(`${target}/authority/ui-object-model.${target}.json`, objectModelContent, [objectModelRef]),
                projected(`${target}/index.generated.html`, renderHtml(documents.authority.title), [documents.authorityRef]),
                projected(`${target}/application.generated.mjs`, renderHtmlApplicationSeam(), [documents.authorityRef])
            ];
            appendTarget(target, admitted.find((capability) => capability.embodimentTarget === target), targetFiles);
        }
        const projectionDocuments = {
            authority: { content: authorityContent, source: documents.authorityRef },
            identity: { content: identityContent, source: documents.authorityRef },
            vectors: { content: vectorContent, source: documents.vectorRef },
            coverage: { content: coverageContent, source: documents.coverageRef },
            objectModel: { content: objectModelContent, source: objectModelRef }
        };
        for (const capability of capabilities.filter((candidate) => candidate.projectionProfileRef)) {
            const profilePath = path.join(this.repositoryRoot, capability.projectionProfileRef);
            const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
            const profileValidation = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"))
                .validate(profile, "consumer-ui-projection-profile.schema.json");
            if (!profileValidation.valid)
                throw new Error(`UI projection profile '${capability.projectionProfileRef}' is not schema-admitted: ${JSON.stringify(profileValidation.errors)}`);
            if (profile.target !== capability.embodimentTarget)
                throw new Error(`UI projection profile target '${profile.target}' differs from '${capability.embodimentTarget}'.`);
            const targetFiles = profile.documentCopies.map((copy) => {
                const document = projectionDocuments[copy.document];
                return projected(safeProjectionPath(profile.target, copy.path), document.content, [document.source, capability.projectionProfileRef]);
            });
            for (const template of profile.templates) {
                const templatePath = path.resolve(this.repositoryRoot, template.templateRef);
                if (!templatePath.startsWith(`${path.resolve(this.repositoryRoot)}${path.sep}`) || !fs.existsSync(templatePath)) {
                    throw new Error(`UNSAFE_UI_PROJECTION_TEMPLATE: '${template.templateRef}'.`);
                }
                targetFiles.push(projected(safeProjectionPath(profile.target, template.path), fs.readFileSync(templatePath, "utf8"), [template.templateRef, capability.projectionProfileRef]));
            }
            appendTarget(profile.target, capability, targetFiles);
        }
        for (const capability of capabilities.filter((candidate) => candidate.embodimentTarget === "javafx" || candidate.embodimentTarget === "swiftui" || candidate.embodimentTarget === "android-compose")) {
            const target = capability.embodimentTarget;
            const authorityFiles = [
                projected(`${target}/authority/ui-authority.${target}.json`, authorityContent, [documents.authorityRef]),
                projected(`${target}/authority/ui-authority.identity.json`, identityContent, [documents.authorityRef]),
                projected(`${target}/authority/ui-vectors.${target}.json`, vectorContent, [documents.vectorRef]),
                projected(`${target}/authority/ui-experience-coverage.${target}.json`, coverageContent, [documents.coverageRef]),
                projected(`${target}/authority/ui-object-model.${target}.json`, objectModelContent, [objectModelRef])
            ];
            const targetFiles = [...authorityFiles];
            if (target === "javafx") {
                targetFiles.push(projected("javafx/src/main/java/sda/projected/ProjectedApplication.java", renderJavaFxSeam(), [documents.authorityRef]), projected("javafx/pom.generated.xml", renderJavaFxPom(), [capability.implementationRef]));
            }
            else if (target === "swiftui") {
                targetFiles.push(projected("swiftui/Package.swift", renderSwiftPackage(this.repositoryRoot), [capability.implementationRef]), projected("swiftui/Sources/ProjectedConsumer/main.generated.swift", renderSwiftSeam(), [documents.authorityRef]), projected("swiftui/Sources/ProjectedConsumer/authority/ui-authority.swiftui.json", authorityContent, [documents.authorityRef]));
            }
            else if (target === "android-compose") {
                targetFiles.push(projected("android-compose/settings.gradle.kts", renderComposeSettings(this.repositoryRoot), [capability.implementationRef]), projected("android-compose/build.gradle.kts", renderComposeBuild(), [capability.implementationRef]), projected("android-compose/app/build.gradle.kts", renderComposeAppBuild(), [capability.implementationRef]), projected("android-compose/app/src/main/AndroidManifest.xml", renderComposeManifest(), [capability.implementationRef]), projected("android-compose/app/src/main/kotlin/sda/projected/ProjectedConsumerActivity.generated.kt", renderComposeSeam(), [documents.authorityRef]), projected("android-compose/app/src/main/assets/ui-authority.android-compose.json", authorityContent, [documents.authorityRef]));
            }
            appendTarget(target, capability, targetFiles);
        }
        for (const file of files) {
            const destination = path.join(outputRoot, file.relativePath);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, file.content, "utf8");
        }
        const obsoleteJavaSeam = path.join(outputRoot, "javafx", "src", "main", "java", "sda", "projected", "Application.generated.java");
        if (fs.existsSync(obsoleteJavaSeam))
            fs.unlinkSync(obsoleteJavaSeam);
        return Object.freeze({
            projectionType: "consumer-ui-embodiment-projection.v1", applicationId: documents.identity.applicationId,
            authorityDigest: documents.identity.authorityDigest, vectorCorpusDigest: canonicalDigest(documents.vectors),
            targets: Object.freeze(admitted.map((capability) => capability.embodimentTarget)),
            declaredTargets: Object.freeze(declared.map((capability) => capability.embodimentTarget)),
            projectedTargets: Object.freeze(capabilities.map((capability) => capability.embodimentTarget)),
            outputDirectory: outputRoot, files: Object.freeze(files), executableOrigin: "PROJECTED_ONLY", disposition: "PROJECTED"
        });
    }
}
