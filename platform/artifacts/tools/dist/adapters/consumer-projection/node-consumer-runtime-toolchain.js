import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const RUNTIME_TESTIMONY_BUFFER_BYTES = 128 * 1024 * 1024;
function lastJson(stdout) {
    const line = stdout.trim().split(/\r?\n/).at(-1);
    if (!line)
        throw new Error("Consumer runtime produced no JSON result.");
    return JSON.parse(line);
}
function resolveCsharpProject(workspaceRoot) {
    const next = path.join(workspaceRoot, "projected", "csharp", "ProjectedConsumerCli.generated.csproj");
    if (fs.existsSync(next))
        return next;
    return path.join(workspaceRoot, "projected", "csharp", "ProjectedConsumer.generated.csproj");
}
export class NodeConsumerRuntimeToolchain {
    repositoryRoot;
    python;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
        const pythonRoot = path.join(repositoryRoot, "languages", "python");
        const candidates = [
            path.join(pythonRoot, ".venv", "bin", "python"),
            path.join(pythonRoot, ".venv", "Scripts", "python.exe")
        ];
        this.python = candidates.find((candidate) => fs.existsSync(candidate)) ?? "python";
    }
    available(target) {
        const command = target === "csharp" ? "dotnet" : target === "python" ? this.python : process.execPath;
        const args = target === "csharp" ? ["--version"] : target === "python" ? ["-c", "pass"] : ["--version"];
        if (target === "python" && this.python === "python")
            return false;
        const result = spawnSync(command, args, { cwd: this.repositoryRoot, encoding: "utf8", timeout: 30_000 });
        return !result.error && result.status === 0;
    }
    prepare(target, workspaceRoot) {
        if (target !== "csharp")
            return;
        const project = resolveCsharpProject(workspaceRoot);
        const result = spawnSync("dotnet", ["build", project, "--nologo"], {
            cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000
        });
        if (result.error || result.status !== 0) {
            throw new Error(result.error?.message || result.stderr || result.stdout || "C# consumer build failed");
        }
    }
    execute(target, workspaceRoot, interfaceId, input) {
        return this.executeArgument(target, workspaceRoot, interfaceId, JSON.stringify(input));
    }
    executeFixture(target, workspaceRoot, interfaceId, fixtureId) {
        return this.executeArgument(target, workspaceRoot, interfaceId, `--fixture=${fixtureId}`);
    }
    executeArgument(target, workspaceRoot, interfaceId, argument) {
        let result;
        if (target === "node") {
            result = spawnSync(process.execPath, [path.join(workspaceRoot, "projected", "node", `${interfaceId}.generated.mjs`), argument], {
                cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000, maxBuffer: RUNTIME_TESTIMONY_BUFFER_BYTES
            });
        }
        else if (target === "csharp") {
            result = spawnSync("dotnet", [
                "run", "--project", resolveCsharpProject(workspaceRoot),
                "--no-build", "--", argument
            ], {
                cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000, maxBuffer: RUNTIME_TESTIMONY_BUFFER_BYTES
            });
        }
        else {
            const sourceRoot = path.join(this.repositoryRoot, "languages", "python", "src");
            result = spawnSync(this.python, [path.join(workspaceRoot, "projected", "python", "consumer.generated.py"), argument], {
                cwd: this.repositoryRoot,
                encoding: "utf8",
                timeout: 120_000,
                maxBuffer: RUNTIME_TESTIMONY_BUFFER_BYTES,
                env: { ...process.env, PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
            });
        }
        if (result.error || result.status !== 0) {
            const detail = result.error?.message || result.stderr || result.stdout || "no runtime diagnostics";
            throw new Error(`${target} consumer execution failed (exit=${String(result.status)}): ${detail}`);
        }
        return lastJson(result.stdout);
    }
}
export class NodeInspectableQueryExecutor {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    async execute(catalog, profile, queryId, params) {
        const moduleUrl = pathToFileURL(path.join(this.repositoryRoot, "languages", "typescript", "runtimes", "node", "query-cli.mjs")).href;
        const module = await import(moduleUrl);
        return module.runQuery(catalog, profile, queryId, params);
    }
}
