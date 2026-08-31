import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NodeLanguageTargetRegistry, repositoryTextDigest } from "../projection/node-language-target-registry.js";
const CHECKS = {
    csharp: [
        ["input.contract", /AdmitAsync\s*\(\s*scenario\.Input\.Contract\b/],
        ["event.executionAuthorityId", /ResolveAsync\s*\(\s*scenario\.Event\b/],
        ["outcome.contract", /AdmitAsync\s*\(\s*scenario\.Outcome\.Contract\b/],
        ["outcome.terminal", /scenario\.Outcome\.Terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.completed", /scenario\.Outcome\.Terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.terminated", /scenario\.Outcome\.Terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.rejected", /Disposition:\s*"rejected"/],
        ["disposition.failed", /Disposition:\s*"failed"/]
    ],
    node: [
        ["input.contract", /contracts\.admit\s*\(\s*scenario\.input\.contract\b/],
        ["event.executionAuthorityId", /authorityResolver\.resolve\s*\(\s*scenario\.event\b/],
        ["outcome.contract", /contracts\.admit\s*\(\s*scenario\.outcome\.contract\b/],
        ["outcome.terminal", /scenario\.outcome\.terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.completed", /scenario\.outcome\.terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.terminated", /scenario\.outcome\.terminal\s*\?\s*"terminated"\s*:\s*"completed"/],
        ["disposition.rejected", /disposition:\s*"rejected"/],
        ["disposition.failed", /disposition:\s*"failed"/]
    ],
    python: [
        ["input.contract", /_contracts\.admit\s*\(\s*scenario\.input\.contract\b/],
        ["event.executionAuthorityId", /_authority_resolver\.resolve\s*\(\s*scenario\.event\b/],
        ["outcome.contract", /_contracts\.admit\s*\(\s*scenario\.outcome\.contract\b/],
        ["outcome.terminal", /"terminated"\s+if\s+scenario\.outcome\.terminal\s+else\s+"completed"/],
        ["disposition.completed", /"terminated"\s+if\s+scenario\.outcome\.terminal\s+else\s+"completed"/],
        ["disposition.terminated", /"terminated"\s+if\s+scenario\.outcome\.terminal\s+else\s+"completed"/],
        ["disposition.rejected", /disposition\s*=\s*"rejected"/],
        ["disposition.failed", /disposition\s*=\s*"failed"/]
    ],
    java: [
        ["input.contract", /contracts\.admit\s*\(\s*scenario\.input\(\)\.contract\(\)/],
        ["event.executionAuthorityId", /authorityResolver\.resolve\s*\(\s*scenario\.event\(\)/],
        ["outcome.contract", /contracts\.admit\s*\(\s*scenario\.outcome\(\)\.contract\(\)/],
        ["outcome.terminal", /scenario\.outcome\(\)\.terminal\(\)[\s\S]*?Disposition\.TERMINATED[\s\S]*?Disposition\.COMPLETED/],
        ["disposition.completed", /Disposition\.COMPLETED/],
        ["disposition.terminated", /Disposition\.TERMINATED/],
        ["disposition.rejected", /Disposition\.REJECTED/],
        ["disposition.failed", /Disposition\.FAILED/]
    ],
    go: [
        ["input.contract", /contracts\.Admit\s*\(\s*ctx\s*,\s*scenario\.Input\.Contract\b/],
        ["event.executionAuthorityId", /authorityResolver\.Resolve\s*\(\s*ctx\s*,\s*scenario\.Event\b/],
        ["outcome.contract", /contracts\.Admit\s*\(\s*ctx\s*,\s*scenario\.Outcome\.Contract\b/],
        ["outcome.terminal", /scenario\.Outcome\.Terminal[\s\S]*?DispositionTerminated[\s\S]*?DispositionCompleted/],
        ["disposition.completed", /DispositionCompleted/],
        ["disposition.terminated", /DispositionTerminated/],
        ["disposition.rejected", /DispositionRejected/],
        ["disposition.failed", /DispositionFailed/]
    ]
};
function sourceReferences(manifest) {
    const steps = Array.isArray(manifest["executionStepEmbodiments"])
        ? manifest["executionStepEmbodiments"]
        : [];
    const references = steps.flatMap((step) => {
        if (!step || typeof step !== "object")
            return [];
        const embodiment = step["embodiment"];
        if (!embodiment || typeof embodiment !== "object")
            return [];
        const sourceRef = embodiment["sourceRef"];
        return typeof sourceRef === "string" ? [sourceRef] : [];
    });
    return [...new Set(references)].sort();
}
export class NodeAuthoritySourceInspector {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    inspect(language, manifest) {
        const definitions = CHECKS[language];
        const sourceRefs = sourceReferences(manifest);
        const missingSourceRefs = sourceRefs.filter((sourceRef) => !fs.existsSync(path.join(this.repositoryRoot, sourceRef)));
        const sources = sourceRefs
            .filter((sourceRef) => !missingSourceRefs.includes(sourceRef))
            .map((sourceRef) => ({ sourceRef, content: fs.readFileSync(path.join(this.repositoryRoot, sourceRef), "utf8") }));
        if (!definitions)
            return this.inspectRegistered(language, sourceRefs, missingSourceRefs, sources);
        const source = sources.map((item) => item.content).join("\n");
        const checks = definitions.map(([value, pattern]) => ({ value, observed: pattern.test(source) }));
        return {
            conforming: sourceRefs.length > 0 && missingSourceRefs.length === 0 && checks.every((check) => check.observed),
            sourceRefs,
            missingSourceRefs,
            checks
        };
    }
    inspectRegistered(language, sourceRefs, missingSourceRefs, sources) {
        const registry = new NodeLanguageTargetRegistry(this.repositoryRoot);
        const registration = registry.discover().find((candidate) => candidate.targetId === language);
        if (!registration?.providers.sourceMechanicObserver) {
            return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: `no authority source inspector for ${language}` };
        }
        try {
            const provider = registry.verifiedProvider(language, "sourceMechanicObserver");
            if (!provider.authorityRef || !provider.authorityDigest) {
                return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: `registered authority source inspector for ${language} has no digest-bound authority` };
            }
            const authorityPath = registry.targetPath(language, provider.authorityRef);
            const encodedAuthority = fs.readFileSync(authorityPath, "utf8");
            const observedDigest = repositoryTextDigest(encodedAuthority);
            if (observedDigest !== provider.authorityDigest) {
                return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: `registered authority source inspector authority digest mismatch for ${language}` };
            }
            const child = spawnSync(process.execPath, [registry.repositoryPath(provider.implementationRef), provider.operation ?? "inspect-authority-source"], {
                cwd: this.repositoryRoot,
                encoding: "utf8",
                input: JSON.stringify({ language, authority: JSON.parse(encodedAuthority), sourceRefs, missingSourceRefs, sources }),
                timeout: 30_000,
                maxBuffer: 16 * 1024 * 1024
            });
            if (child.error || child.status !== 0) {
                return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: child.error?.message ?? child.stderr.trim() ?? `source inspector exited ${child.status}` };
            }
            const result = JSON.parse(child.stdout);
            if (typeof result.conforming !== "boolean" || !Array.isArray(result.sourceRefs) || !Array.isArray(result.checks) ||
                result.checks.some((check) => typeof check.value !== "string" || typeof check.observed !== "boolean")) {
                return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: `registered authority source inspector for ${language} returned invalid evidence` };
            }
            return result;
        }
        catch (error) {
            return { conforming: false, sourceRefs, missingSourceRefs, checks: [], reason: error instanceof Error ? error.message : String(error) };
        }
    }
}
