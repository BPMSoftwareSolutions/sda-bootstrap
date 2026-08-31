import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import toolchainModule from "../conformance/language-toolchains.cjs";
import { consumerPlatformInputDigest } from "./consumer-platform-input-digest.js";
import { NodeLanguageTargetRegistry } from "../projection/node-language-target-registry.js";
import { NodeTargetToolchain } from "../projection/node-target-toolchain.js";
const { runJavaConformance } = toolchainModule;
function unavailable() {
    return { error: new Error("required toolchain is not available"), status: null, signal: null, output: [], pid: 0, stdout: "", stderr: "" };
}
function available(command, args, cwd) {
    const result = spawnSync(command, [...args], { cwd, encoding: "utf8", timeout: 30_000 });
    return !result.error && result.status === 0;
}
export class NodeConsumerPlatformToolchains {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    observe(catalog) {
        const executions = {
            csharp: [
                "dotnet test ScenarioKernel.ConformanceTests AdapterConformanceTests",
                available("dotnet", ["--version"], this.repositoryRoot)
                    ? spawnSync("dotnet", [
                        "test", "languages/csharp/tests/ScenarioKernel.ConformanceTests", "--filter",
                        "FullyQualifiedName~ScenarioKernel.ConformanceTests.AdapterConformanceTests", "--nologo"
                    ], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000 })
                    : unavailable()
            ],
            java: [
                "java -ea scenario.kernel.conformance.ConformanceSuite consumer",
                available("javac", ["-version"], this.repositoryRoot)
                    ? runJavaConformance(path.join(this.repositoryRoot, "languages", "java"), "consumer", this.repositoryRoot)
                    : unavailable()
            ],
            go: [
                "go test ./conformance -run TestConsumerPlatform",
                spawnSync("go", ["test", "./conformance", "-run", "TestConsumerPlatform"], {
                    cwd: path.join(this.repositoryRoot, "languages", "go"), encoding: "utf8", timeout: 120_000
                })
            ],
            node: ["node platform conformance and projected circuit tests", this.runNode()],
            python: ["python adapter and projected circuit tests", this.runPython()]
        };
        const registry = new NodeLanguageTargetRegistry(this.repositoryRoot);
        for (const registration of registry.discover()) {
            if (executions[registration.targetId])
                continue;
            const profile = registry.toolchainProfile(registration.targetId);
            if (profile.driver !== "argv.v1" || !profile.operations.consumer)
                continue;
            const toolchain = new NodeTargetToolchain(this.repositoryRoot, registration.targetId);
            const result = toolchain.available()
                ? toolchain.proveConsumerPlatform()
                : { command: `${registration.targetId} registered consumer toolchain`, ran: false, exitCode: null, conforming: false, reason: "required toolchain is not available" };
            executions[registration.targetId] = [result.command, {
                    ...(result.ran ? {} : { error: new Error(result.reason ?? "registered consumer toolchain did not run") }),
                    status: result.exitCode,
                    signal: null,
                    output: [],
                    pid: 0,
                    stdout: "",
                    stderr: result.stderr ?? ""
                }];
        }
        return Object.freeze(Object.fromEntries(Object.entries(executions).map(([language, [command, execution]]) => {
            const ran = !execution.error;
            const conforming = ran && execution.status === 0;
            const stderr = execution.stderr?.trim();
            return [language, Object.freeze({
                    language,
                    command,
                    ran,
                    exitCode: ran ? execution.status : null,
                    conforming,
                    disposition: !ran ? "NOT_OBSERVABLE" : conforming ? "SATISFIED" : "NOT_SATISFIED",
                    proofInputDigest: consumerPlatformInputDigest(this.repositoryRoot, language, catalog),
                    ...(!ran ? { reason: execution.error?.message ?? "did not run" } : {}),
                    ...(stderr ? { stderr: stderr.slice(0, 2000) } : {})
                })];
        })));
    }
    runNode() {
        const tests = [
            "languages/typescript/runtimes/node/external-observation-port.conformance.test.mjs",
            "languages/typescript/runtimes/node/projected-capability-invocation-port.conformance.test.mjs",
            "languages/typescript/runtimes/node/query-cli.conformance.test.mjs",
            "examples/generic-capability/projected/node/capability.projected.test.mjs"
        ];
        return spawnSync(process.execPath, ["--test", ...tests], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120_000 });
    }
    runPython() {
        const pythonRoot = path.join(this.repositoryRoot, "languages", "python");
        const python = [path.join(pythonRoot, ".venv", "bin", "python"), path.join(pythonRoot, ".venv", "Scripts", "python.exe")]
            .find((candidate) => fs.existsSync(candidate));
        if (!python || !available(python, ["-c", "pass"], pythonRoot))
            return unavailable();
        const adapters = spawnSync(python, ["-m", "pytest", "tests/conformance/test_platform_adapters.py", "-q"], {
            cwd: pythonRoot, encoding: "utf8", timeout: 120_000
        });
        if (adapters.error || adapters.status !== 0)
            return adapters;
        const sourceRoot = path.join(pythonRoot, "src");
        return spawnSync(python, [path.join(this.repositoryRoot, "examples", "generic-capability", "projected", "python", "consumer.generated.py"), "--test"], {
            cwd: this.repositoryRoot,
            encoding: "utf8",
            timeout: 120_000,
            env: { ...process.env, PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
        });
    }
}
