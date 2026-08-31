import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonical(record[key])]));
    }
    return value;
}
function derivedFact(sourceRef, value, observedAt) {
    const encoded = JSON.stringify(canonical(value));
    return Object.freeze({ sourceRef, digest: digest(encoded), observedAt, value });
}
function jsonFact(filePath, observedAt) {
    const encoded = fs.readFileSync(filePath, "utf8");
    return Object.freeze({
        sourceRef: filePath,
        digest: digest(encoded),
        observedAt,
        value: JSON.parse(encoded)
    });
}
export class NodeLanguageBindingRepository {
    repositoryRoot;
    clock;
    constructor(repositoryRoot, clock) {
        this.repositoryRoot = repositoryRoot;
        this.clock = clock;
    }
    load() {
        const observedAt = this.clock.now();
        const languagesDirectory = path.join(this.repositoryRoot, "languages");
        if (!fs.existsSync(languagesDirectory)) {
            return {
                languagesDirectory,
                languageDirectories: derivedFact(`${languagesDirectory}#/directories`, [], observedAt),
                bindingFiles: []
            };
        }
        const languageNames = fs
            .readdirSync(languagesDirectory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
        const bindingFiles = [];
        for (const language of languageNames) {
            const bindingDirectory = path.join(languagesDirectory, language, "binding");
            if (!fs.existsSync(bindingDirectory))
                continue;
            const files = fs
                .readdirSync(bindingDirectory)
                .filter((file) => file.endsWith(".binding.json"))
                .sort();
            for (const file of files) {
                const bindingPath = path.join(bindingDirectory, file);
                const fact = jsonFact(bindingPath, observedAt);
                const declaredLanguage = fact.value["language"];
                bindingFiles.push({
                    language: typeof declaredLanguage === "string" && declaredLanguage.length > 0 ? declaredLanguage : language,
                    fact
                });
            }
        }
        return {
            languagesDirectory,
            languageDirectories: derivedFact(`${languagesDirectory}#/directories`, languageNames, observedAt),
            bindingFiles
        };
    }
}
