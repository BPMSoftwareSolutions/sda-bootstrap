import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NodeLanguageTargetRegistry } from "./node-language-target-registry.js";
const commands = {
    csharp: {
        availability: ["dotnet", ["--version"]],
        structural: "dotnet build languages/csharp/src/ScenarioKernel.Contracts --nologo",
        execution: "dotnet build languages/csharp/src/ScenarioKernel --nologo",
        behavior: "dotnet test GeneratedExecutionVectorFixtureTests"
    },
    go: {
        availability: ["go", ["version"]],
        structural: "go test ./...",
        execution: "go test ./... -run ^$",
        behavior: "go test ./conformance -run TestGeneratedExecutionVector"
    },
    java: {
        availability: ["javac", ["-version"]],
        structural: "javac --release 17 (main sources)",
        execution: "javac --release 17 (main and conformance sources)",
        behavior: "java -ea scenario.kernel.conformance.ConformanceSuite generated"
    },
    node: {
        availability: ["npx", ["tsc", "--version"]],
        structural: "npx tsc --noEmit",
        execution: "npx tsc --noEmit",
        behavior: "npx tsc && node --test dist/test/projection/generated-execution-vector.test.js"
    },
    python: {
        availability: ["python-venv", ["-c", "pass"]],
        structural: ".venv/bin/python -m mypy",
        execution: ".venv/bin/python -m mypy",
        behavior: ".venv/bin/python -m pytest tests/conformance -m generated -q"
    }
};
function nativeRuntimeHostCompatible(targetRoot, target) {
    const boundaryPath = path.join(targetRoot, "conformance", "native-runtime-boundary.json");
    if (!fs.existsSync(boundaryPath))
        return true;
    try {
        const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
        const operatingSystem = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform];
        const physicalTarget = boundary.physicalTarget;
        return boundary.boundaryType === "native-runtime-boundary.v1" &&
            boundary.targetId === target &&
            physicalTarget?.operatingSystem === operatingSystem &&
            physicalTarget?.architecture === process.arch;
    }
    catch {
        return false;
    }
}
function javaSources(root, includeTests) {
    const files = [];
    const walk = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            // Projection transactions keep the previously admitted tree in a hidden
            // sibling while the candidate is proved. That backup is rollback state,
            // not a second Java source root.
            if (entry.name.startsWith("."))
                continue;
            const resolved = path.join(directory, entry.name);
            if (entry.isDirectory())
                walk(resolved);
            else if (entry.isFile() && entry.name.endsWith(".java"))
                files.push(resolved);
        }
    };
    walk(path.join(root, "src", "main", "java"));
    if (includeTests)
        walk(path.join(root, "src", "test", "java"));
    return files.sort();
}
function result(command, processResult) {
    const ran = !processResult.error;
    const conforming = ran && processResult.status === 0;
    const stderr = processResult.stderr?.trim();
    return Object.freeze({
        command,
        ran,
        exitCode: ran ? processResult.status : null,
        conforming,
        ...(!ran ? { reason: processResult.error?.message ?? "toolchain did not run" } : {}),
        ...(stderr ? { stderr: stderr.slice(0, 2000) } : {})
    });
}
export class NodeTargetToolchain {
    repositoryRoot;
    target;
    languageRoot;
    pythonExecutable;
    profile;
    hostCompatible;
    constructor(repositoryRoot, target) {
        this.repositoryRoot = repositoryRoot;
        this.target = target;
        const registry = new NodeLanguageTargetRegistry(repositoryRoot);
        this.languageRoot = registry.targetRoot(target);
        this.profile = registry.toolchainProfile(target);
        this.hostCompatible = nativeRuntimeHostCompatible(this.languageRoot, target);
        const candidates = [
            path.join(this.languageRoot, ".venv", "bin", "python"),
            path.join(this.languageRoot, ".venv", "Scripts", "python.exe")
        ];
        this.pythonExecutable = candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0] ?? "python";
    }
    available() {
        if (!this.hostCompatible)
            return false;
        if (this.profile.driver === "argv.v1") {
            const operation = this.profile.operations.availability;
            return operation ? this.runOperation(operation).conforming : false;
        }
        const commandProfile = this.legacyCommands();
        if (this.target === "python" && !fs.existsSync(this.pythonExecutable))
            return false;
        const [declaredCommand, args] = commandProfile.availability;
        const command = declaredCommand === "python-venv" ? this.pythonExecutable : declaredCommand;
        const checked = spawnSync(command, [...args], {
            cwd: this.languageRoot,
            encoding: "utf8",
            timeout: 30_000,
            ...(this.target === "node" ? { shell: true } : {})
        });
        return !checked.error && checked.status === 0;
    }
    compileStructural() {
        if (this.profile.driver === "argv.v1")
            return this.requiredOperation("structural");
        const commandProfile = this.legacyCommands();
        return this.target === "java"
            ? this.compileJava(false, "projection-classes", commandProfile.structural)
            : this.compileLanguage(commandProfile.structural, false);
    }
    compileExecution() {
        if (this.profile.driver === "argv.v1")
            return this.requiredOperation("execution");
        const commandProfile = this.legacyCommands();
        return this.target === "java"
            ? this.compileJava(true, "projection-conformance-classes", commandProfile.execution)
            : this.compileLanguage(commandProfile.execution, true);
    }
    proveExecutionBehavior() {
        if (this.profile.driver === "argv.v1")
            return this.requiredOperation("behavior");
        const command = this.legacyCommands().behavior;
        switch (this.target) {
            case "csharp":
                return result(command, spawnSync("dotnet", [
                    "test", "languages/csharp/tests/ScenarioKernel.ConformanceTests", "--filter",
                    "FullyQualifiedName~GeneratedExecutionVectorFixtureTests", "--nologo"
                ], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000 }));
            case "go":
                return result(command, spawnSync("go", ["test", "./conformance", "-run", "TestGeneratedExecutionVector"], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000
                }));
            case "java": {
                const output = path.join(this.languageRoot, "target", "projection-conformance-classes");
                return result(command, spawnSync("java", [
                    "-ea", "-cp", output, "scenario.kernel.conformance.ConformanceSuite", "generated"
                ], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000 }));
            }
            case "node": {
                const build = spawnSync("npx", ["tsc"], { cwd: this.languageRoot, encoding: "utf8", timeout: 120_000, shell: true });
                if (build.error || build.status !== 0)
                    return result(command, build);
                return result(command, spawnSync("node", ["--test", "dist/test/projection/generated-execution-vector.test.js"], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000
                }));
            }
            case "python":
                return result(command, spawnSync(this.pythonExecutable, ["-m", "pytest", "tests/conformance", "-m", "generated", "-q"], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000
                }));
            default:
                throw new Error(`No legacy execution behavior runner is admitted for '${this.target}'.`);
        }
    }
    proveConsumerPlatform() {
        if (this.profile.driver !== "argv.v1") {
            return Object.freeze({ command: `${this.target} consumer`, ran: false, exitCode: null, conforming: false, reason: "legacy consumer toolchains are observed by their existing conformance runners" });
        }
        return this.requiredOperation("consumer");
    }
    proveUiClaimant() {
        if (this.profile.driver !== "argv.v1") {
            return Object.freeze({ command: `${this.target} ui`, ran: false, exitCode: null, conforming: false, reason: "legacy UI claimants use their native collectors" });
        }
        return this.requiredOperation("ui");
    }
    compileLanguage(command, execution) {
        switch (this.target) {
            case "csharp":
                return result(command, spawnSync("dotnet", [
                    "build", execution ? "languages/csharp/src/ScenarioKernel" : "languages/csharp/src/ScenarioKernel.Contracts", "--nologo"
                ], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000 }));
            case "go":
                return result(command, spawnSync("go", execution ? ["test", "./...", "-run", "^$"] : ["test", "./..."], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000
                }));
            case "node":
                return result(command, spawnSync("npx", ["tsc", "--noEmit"], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000, shell: true
                }));
            case "python":
                return result(command, spawnSync(this.pythonExecutable, ["-m", "mypy"], {
                    cwd: this.languageRoot, encoding: "utf8", timeout: 120_000
                }));
            case "java":
                throw new Error("Java compilation uses compileJava.");
            default:
                throw new Error(`No legacy compiler is admitted for '${this.target}'.`);
        }
    }
    legacyCommands() {
        const profile = commands[this.target];
        if (!profile)
            throw new Error(`Target '${this.target}' declares the legacy driver but has no legacy command profile.`);
        return profile;
    }
    requiredOperation(name) {
        if (!this.hostCompatible) {
            return Object.freeze({ command: `${this.target} ${name}`, ran: false, exitCode: null, conforming: false, reason: "declared native runtime target is not compatible with the current host" });
        }
        const operation = this.profile.operations[name];
        if (!operation) {
            return Object.freeze({ command: `${this.target} ${name}`, ran: false, exitCode: null, conforming: false, reason: `toolchain profile does not declare '${name}'` });
        }
        return this.runOperation(operation);
    }
    runOperation(operation) {
        const display = operation.description ?? operation.steps.map((step) => [step.command, ...step.args].join(" ")).join(" && ");
        let last;
        for (const step of operation.steps) {
            const cwd = step.workingDirectory === "repository" ? this.repositoryRoot : this.languageRoot;
            for (const directory of step.ensureDirectories ?? []) {
                if (path.isAbsolute(directory) || directory.split(/[\\/]/).includes("..")) {
                    return Object.freeze({ command: display, ran: false, exitCode: null, conforming: false, reason: `unsafe toolchain directory '${directory}'` });
                }
                fs.mkdirSync(path.join(cwd, directory), { recursive: true });
            }
            last = spawnSync(step.command, [...step.args], {
                cwd,
                encoding: "utf8",
                timeout: step.timeoutMs ?? 120_000
            });
            if (last.error || last.status !== 0)
                return result(display, last);
        }
        if (!last)
            return Object.freeze({ command: display, ran: false, exitCode: null, conforming: false, reason: "toolchain operation has no steps" });
        return result(display, last);
    }
    compileJava(includeTests, outputName, command) {
        const output = path.join(this.languageRoot, "target", outputName);
        fs.rmSync(output, { recursive: true, force: true });
        fs.mkdirSync(output, { recursive: true });
        return result(command, spawnSync("javac", ["--release", "17", "-d", output, ...javaSources(this.languageRoot, includeTests)], {
            cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000
        }));
    }
}
