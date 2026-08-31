#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateUiChangeAmplification } from "../../governance/ui-change-amplification.js";
function option(name) {
    const found = process.argv.slice(2).find((value) => value.startsWith(`${name}=`));
    return found?.slice(name.length + 1);
}
export function checkUiChangeAmplification(repositoryRoot, base) {
    const policy = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "governance/ui/change-amplification-policy.json"), "utf8"));
    const declarationPath = path.join(repositoryRoot, policy.declarationRef);
    const declaration = fs.existsSync(declarationPath)
        ? JSON.parse(fs.readFileSync(declarationPath, "utf8")) : null;
    const diff = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: repositoryRoot, encoding: "utf8" });
    if (diff.error || diff.status !== 0)
        throw new Error(`UI change amplification could not read '${base}...HEAD': ${diff.stderr || diff.error?.message}`);
    return evaluateUiChangeAmplification(policy, declaration, diff.stdout.split(/\r?\n/u).filter(Boolean));
}
function main() {
    const repositoryRoot = process.cwd();
    const base = option("--base") || process.env.SDA_UI_CHANGE_BASE || "HEAD^";
    const evidence = checkUiChangeAmplification(repositoryRoot, base);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    if (evidence.disposition === "CHANGE_AMPLIFICATION_VIOLATION")
        process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))
    main();
