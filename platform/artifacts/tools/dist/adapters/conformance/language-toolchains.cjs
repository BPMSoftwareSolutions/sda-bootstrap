"use strict";
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const url = require("node:url");
function javaSources(packageRoot) { const files = []; const walk = (directory) => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory())
        walk(resolved);
    else if (entry.isFile() && entry.name.endsWith(".java"))
        files.push(resolved);
} }; for (const root of [path.join(packageRoot, "src", "main", "java"), path.join(packageRoot, "src", "test", "java")])
    walk(root); return files.sort(); }
function compileJavaConformance(packageRoot, outputDirectory, repositoryRoot) { fs.rmSync(outputDirectory, { recursive: true, force: true }); fs.mkdirSync(outputDirectory, { recursive: true }); return childProcess.spawnSync("javac", ["--release", "17", "-d", outputDirectory, ...javaSources(packageRoot)], { cwd: repositoryRoot, encoding: "utf8", timeout: 120000 }); }
function runJavaConformance(packageRoot, suite = "kernel", repositoryRoot = process.cwd()) { const outputDirectory = path.join(packageRoot, "target", "conformance-classes"); const compile = compileJavaConformance(packageRoot, outputDirectory, repositoryRoot); if (compile.error || compile.status !== 0)
    return compile; return childProcess.spawnSync("java", ["-ea", "-cp", outputDirectory, "scenario.kernel.conformance.ConformanceSuite", suite], { cwd: repositoryRoot, encoding: "utf8", timeout: 120000 }); }
function parseDotnet(stdout) { const match = stdout.match(/(Passed!|Failed!).*?Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)/); return match ? { summary: match[0].trim(), testsFailed: Number(match[2]), testsPassed: Number(match[3]), testsSkipped: Number(match[4]), testsTotal: Number(match[5]) } : null; }
function parseNode(stdout) { const pass = stdout.match(/^# pass (\d+)$/m); const fail = stdout.match(/^# fail (\d+)$/m); const tests = stdout.match(/^# tests (\d+)$/m); const skipped = stdout.match(/^# skipped (\d+)$/m); if (!pass || !fail || !tests)
    return null; return { summary: `tests ${tests[1]}, pass ${pass[1]}, fail ${fail[1]}`, testsFailed: Number(fail[1]), testsPassed: Number(pass[1]), testsSkipped: skipped ? Number(skipped[1]) : 0, testsTotal: Number(tests[1]) }; }
function parsePytest(stdout) { const lastLine = stdout.trim().split("\n").map((line) => line.trim()).at(-1); if (!lastLine || !/ in [\d.]+s/.test(lastLine))
    return null; const passed = lastLine.match(/(\d+) passed/); const failed = lastLine.match(/(\d+) failed/); const errors = lastLine.match(/(\d+) error/); const skipped = lastLine.match(/(\d+) skipped/); const testsPassed = passed ? Number(passed[1]) : 0; const testsFailed = (failed ? Number(failed[1]) : 0) + (errors ? Number(errors[1]) : 0); const testsSkipped = skipped ? Number(skipped[1]) : 0; return { summary: lastLine, testsFailed, testsPassed, testsSkipped, testsTotal: testsPassed + testsFailed + testsSkipped }; }
function parseJava(stdout) { const match = stdout.match(/JAVA(?: [A-Z]+)* CONFORMANCE: tests (\d+), pass (\d+), fail (\d+)/); return match ? { summary: match[0], testsTotal: Number(match[1]), testsPassed: Number(match[2]), testsFailed: Number(match[3]), testsSkipped: 0 } : null; }
function parseRegistered(stdout) { const match = stdout.match(/[A-Z][A-Z+ #.-]* CONFORMANCE: tests (\d+), pass (\d+), fail (\d+)/); if (!match)
    return null; const native = stdout.match(/[A-Z][A-Z+ #.-]* NATIVE RUNTIME:[^\r\n]+/); return { summary: native ? `${native[0]} | ${match[0]}` : match[0], testsTotal: Number(match[1]), testsPassed: Number(match[2]), testsFailed: Number(match[3]), testsSkipped: 0 }; }
function summary(language, stdout) { try {
    const registered = parseRegistered(stdout);
    if (registered)
        return registered;
    if (language === "csharp")
        return parseDotnet(stdout);
    if (language === "java")
        return parseJava(stdout);
    if (language === "node")
        return parseNode(stdout);
    if (language === "python")
        return parsePytest(stdout);
    return null;
}
catch {
    return null;
} }
function commandAvailable(command, args, cwd) { const result = childProcess.spawnSync(command, [...args], { cwd, encoding: "utf8", timeout: 30000 }); return !result.error && result.status === 0; }
function toolchainResult(language, command, result) { const ran = !result.error; const conforming = ran && result.status === 0; return { language, ran, conforming, disposition: !ran ? "NOT_OBSERVABLE" : conforming ? "SATISFIED" : "NOT_SATISFIED", ...(ran ? {} : { reason: result.error?.message ?? "did not run" }) }; }
function ecosystemRoot(repositoryRoot, language) { return path.join(repositoryRoot, "languages", language === "node" ? "typescript" : language); }
function registeredArgvProfile(repositoryRoot, language) {
    const languageRoot = ecosystemRoot(repositoryRoot, language);
    const registrationPath = path.join(languageRoot, "projection", "language-target-registration.json");
    if (!fs.existsSync(registrationPath))
        return null;
    const registration = JSON.parse(fs.readFileSync(registrationPath, "utf8"));
    if (registration.targetId !== language || typeof registration.toolchainProfileRef !== "string")
        return null;
    if (path.isAbsolute(registration.toolchainProfileRef) || registration.toolchainProfileRef.split(/[\\/]/).includes(".."))
        return null;
    const profile = JSON.parse(fs.readFileSync(path.join(languageRoot, registration.toolchainProfileRef), "utf8"));
    return profile.profileType === "target-toolchain-profile.v1" && profile.targetId === language && profile.driver === "argv.v1" ? profile : null;
}
function nativeRuntimeHostCompatible(repositoryRoot, language) {
    const boundaryPath = path.join(ecosystemRoot(repositoryRoot, language), "conformance", "native-runtime-boundary.json");
    if (!fs.existsSync(boundaryPath))
        return true;
    try {
        const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
        const operatingSystem = { darwin: "macOS", linux: "Linux", win32: "Windows" }[process.platform];
        const physicalTarget = boundary.physicalTarget;
        return boundary.boundaryType === "native-runtime-boundary.v1" && boundary.targetId === language && physicalTarget?.operatingSystem === operatingSystem && physicalTarget?.architecture === process.arch;
    }
    catch {
        return false;
    }
}
function runRegisteredOperation(repositoryRoot, language, operation) {
    const languageRoot = ecosystemRoot(repositoryRoot, language);
    const command = operation.description ?? operation.steps.map((step) => [step.command, ...step.args].join(" ")).join(" && ");
    let last;
    for (const step of operation.steps) {
        const cwd = step.workingDirectory === "repository" ? repositoryRoot : languageRoot;
        for (const directory of step.ensureDirectories ?? []) {
            if (path.isAbsolute(directory) || directory.split(/[\\/]/).includes("..")) {
                return { command, result: { error: new Error(`unsafe toolchain directory '${directory}'`), pid: 0, output: [], stdout: "", stderr: "", status: null, signal: null } };
            }
            fs.mkdirSync(path.join(cwd, directory), { recursive: true });
        }
        last = childProcess.spawnSync(step.command, [...step.args], { cwd, encoding: "utf8", timeout: step.timeoutMs ?? 120000 });
        if (last.error || last.status !== 0)
            return { command, result: last };
    }
    if (!last)
        return { command, result: { error: new Error("toolchain operation has no steps"), pid: 0, output: [], stdout: "", stderr: "", status: null, signal: null } };
    return { command, result: last };
}
class NodeLanguageToolchains {
    repositoryRoot;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
    }
    observeBehavior(obligation) {
        const language = obligation.language;
        const refs = obligation.binding["projectReferences"];
        const conformanceTests = refs && typeof refs === "object" ? refs["conformanceTests"] : undefined;
        if (typeof conformanceTests !== "string")
            return { language, toolchainAvailable: false, ran: false, conforming: false, reason: "binding manifest has no projectReferences.conformanceTests path" };
        const packageRoot = ecosystemRoot(this.repositoryRoot, language);
        const projectPath = path.join(packageRoot, conformanceTests);
        if (!fs.existsSync(projectPath))
            return { language, toolchainAvailable: false, ran: false, conforming: false, reason: `conformance test project not found at ${projectPath}` };
        const registered = registeredArgvProfile(this.repositoryRoot, language);
        if (registered) {
            if (!nativeRuntimeHostCompatible(this.repositoryRoot, language))
                return { language, toolchainAvailable: false, ran: false, conforming: false, reason: "registered native runtime target is not compatible with the current host" };
            const availability = registered.operations.availability;
            const behavior = registered.operations.behavior;
            if (!availability || !behavior)
                return { language, toolchainAvailable: false, ran: false, conforming: false, reason: "registered argv toolchain does not declare availability and behavior operations" };
            const checked = runRegisteredOperation(this.repositoryRoot, language, availability).result;
            if (checked.error || checked.status !== 0)
                return { language, toolchainAvailable: false, ran: false, conforming: false, reason: `${language} registered toolchain is not available` };
            const observed = runRegisteredOperation(this.repositoryRoot, language, behavior);
            const result = observed.result;
            if (result.error)
                return { language, toolchainAvailable: true, ran: false, conforming: false, reason: `failed to launch registered behavioral conformance run: ${result.error.message}` };
            const parsed = summary(language, result.stdout);
            return { language, toolchainAvailable: true, ran: true, exitCode: result.status, conforming: result.status === 0, ...(parsed ?? { summary: observed.command }), ...(result.stderr.trim() ? { stderr: result.stderr.trim().slice(0, 2000) } : {}) };
        }
        const python = this.pythonExecutable();
        const checks = { csharp: ["dotnet", ["--version"], this.repositoryRoot], java: ["javac", ["-version"], this.repositoryRoot], node: [process.execPath, ["--version"], this.repositoryRoot], go: ["go", ["version"], this.repositoryRoot], python: [python, ["-m", "pytest", "--version"], packageRoot] };
        const check = checks[language];
        if (!check)
            return { language, toolchainAvailable: false, ran: false, conforming: false, reason: `no behavioral conformance runner is wired up for language "${language}" yet` };
        if (!commandAvailable(check[0], check[1], check[2]))
            return { language, toolchainAvailable: false, ran: false, conforming: false, reason: `${language} toolchain not available on PATH` };
        let result;
        if (language === "csharp")
            result = childProcess.spawnSync("dotnet", ["test", projectPath, "--filter", "FullyQualifiedName~ScenarioKernel.ConformanceTests.ExecutionVectorFixtureTests", "--nologo"], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120000 });
        else if (language === "node")
            result = childProcess.spawnSync(process.execPath, ["--test", path.join(packageRoot, "dist", "test", "conformance", "execution-vector.test.js")], { cwd: packageRoot, encoding: "utf8", timeout: 120000 });
        else if (language === "go")
            result = childProcess.spawnSync("go", ["test", "./..."], { cwd: packageRoot, encoding: "utf8", timeout: 120000 });
        else if (language === "java")
            result = runJavaConformance(packageRoot, "kernel", this.repositoryRoot);
        else
            result = childProcess.spawnSync(python, ["-m", "pytest", path.join(projectPath, "test_execution_vector.py"), "-q"], { cwd: packageRoot, encoding: "utf8", timeout: 120000 });
        if (result.error)
            return { language, toolchainAvailable: true, ran: false, conforming: false, reason: `failed to launch behavioral conformance run: ${result.error.message}` };
        const parsed = summary(language, result.stdout);
        return { language, toolchainAvailable: true, ran: true, exitCode: result.status, conforming: result.status === 0, ...(parsed ?? {}), ...(result.stderr.trim() ? { stderr: result.stderr.trim().slice(0, 2000) } : {}) };
    }
    async observeExecutionClosure(language) {
        const registered = registeredArgvProfile(this.repositoryRoot, language);
        if (registered) {
            if (!nativeRuntimeHostCompatible(this.repositoryRoot, language))
                return { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "registered native runtime target is not compatible with the current host" };
            const availability = registered.operations.availability;
            const behavior = registered.operations.behavior;
            if (!availability || !behavior)
                return { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "registered argv toolchain does not declare availability and behavior operations" };
            const checked = runRegisteredOperation(this.repositoryRoot, language, availability).result;
            if (checked.error || checked.status !== 0)
                return { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "required registered toolchain is not available" };
            const observed = runRegisteredOperation(this.repositoryRoot, language, behavior);
            return toolchainResult(language, observed.command, observed.result);
        }
        if (language === "node")
            return this.observeNodeClosure();
        const command = language === "csharp" ? "dotnet execution-vector fixture tests" : language === "python" ? "python execution-vector fixture tests" : language === "java" ? "java conformance suite" : "go shared execution-vector test";
        const packageRoot = ecosystemRoot(this.repositoryRoot, language);
        const python = this.pythonExecutable();
        if (language === "csharp")
            return commandAvailable("dotnet", ["--version"], this.repositoryRoot) ? toolchainResult(language, command, childProcess.spawnSync("dotnet", ["test", "languages/csharp/tests/ScenarioKernel.ConformanceTests", "--filter", "FullyQualifiedName~ScenarioKernel.ConformanceTests.ExecutionVectorFixtureTests", "--nologo"], { cwd: this.repositoryRoot, encoding: "utf8", timeout: 120000 })) : { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "required toolchain is not available" };
        if (language === "python")
            return fs.existsSync(python) && commandAvailable(python, ["-c", "pass"], packageRoot) ? toolchainResult(language, command, childProcess.spawnSync(python, ["-m", "pytest", "tests/conformance/test_execution_vector.py", "-q"], { cwd: packageRoot, encoding: "utf8", timeout: 120000 })) : { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "required toolchain is not available" };
        if (language === "java")
            return commandAvailable("javac", ["-version"], this.repositoryRoot) ? toolchainResult(language, command, runJavaConformance(packageRoot, "kernel", this.repositoryRoot)) : { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "required toolchain is not available" };
        if (language === "go")
            return commandAvailable("go", ["version"], this.repositoryRoot) ? toolchainResult(language, command, childProcess.spawnSync("go", ["test", "./conformance", "-run", "^TestSharedExecutionVector$"], { cwd: packageRoot, encoding: "utf8", timeout: 120000 })) : { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "required toolchain is not available" };
        return { language, ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: "no execution-closure runner" };
    }
    pythonExecutable() { const root = path.join(this.repositoryRoot, "languages", "python", ".venv"); return [path.join(root, "bin", "python"), path.join(root, "Scripts", "python.exe")].find((candidate) => fs.existsSync(candidate)) ?? path.join(root, "bin", "python"); }
    async observeNodeClosure() {
        const nodeRoot = path.join(this.repositoryRoot, "languages", "typescript");
        const build = childProcess.spawnSync("npx", ["tsc"], { cwd: nodeRoot, encoding: "utf8", timeout: 120000, shell: true });
        if (build.error || build.status !== 0)
            return { language: "node", ran: false, conforming: false, disposition: "NOT_OBSERVABLE", reason: build.error?.message ?? `node build failed (exit ${build.status})`, fixtures: [] };
        const importDist = (relative) => import(url.pathToFileURL(path.join(nodeRoot, "dist", relative)).href);
        const [kernelModule, dispositionModule, validatorModule, executorModule, resolverModule, observerModule, closureModule] = await Promise.all([importDist("src/kernel/scenario-kernel.js"), importDist("src/kernel/disposition-resolver.js"), importDist("test/conformance/fixture-driven-contract-validator.js"), importDist("test/conformance/fixture-driven-semantic-executor.js"), importDist("test/conformance/passthrough-execution-authority-resolver.js"), importDist("test/conformance/in-memory-execution-observer.js"), import(url.pathToFileURL(path.join(this.repositoryRoot, "artifacts", "tools", "dist", "conformance", "proof", "execution-closure-mechanics.js")).href)]);
        const ScenarioKernel = kernelModule.ScenarioKernel;
        const DispositionResolver = dispositionModule.DispositionResolver;
        const Validator = validatorModule.FixtureDrivenContractValidator;
        const Executor = executorModule.FixtureDrivenSemanticExecutor;
        const Resolver = resolverModule.PassthroughExecutionAuthorityResolver;
        const Observer = observerModule.InMemoryExecutionObserver;
        const evaluate = closureModule.evaluateExecutionClosureTrace;
        const vector = JSON.parse(fs.readFileSync(path.join(this.repositoryRoot, "kernel", "contracts", "execution", "scenario-kernel-execution-vector.json"), "utf8"));
        const canonicalSteps = vector.steps.map((step) => step.stepId);
        const corpus = path.join(this.repositoryRoot, "conformance", "corpus", "execution");
        const fixtures = [];
        for (const file of fs.readdirSync(corpus).filter((candidate) => candidate.endsWith(".json")).sort()) {
            const fixture = JSON.parse(fs.readFileSync(path.join(corpus, file), "utf8"));
            const admissionBehaviors = [fixture["admitInput"], ...(fixture["admitOutcome"] ? [fixture["admitOutcome"]] : [])];
            const observer = new Observer();
            const kernel = new ScenarioKernel(new Validator(admissionBehaviors), new Resolver(), new Executor(fixture["executeEventAuthority"] ?? { outcome: "succeed" }), new DispositionResolver(), observer, { now: () => new Date().toISOString() });
            const fixtureId = String(fixture["fixtureId"]);
            const executionId = `${fixtureId}.execution`;
            const execution = await kernel.execute(fixture["scenario"], { executionId, rootExecutionId: executionId, input: fixture["input"] });
            fixtures.push({ fixtureId, executionId, disposition: execution.disposition, ...evaluate(observer.observations, canonicalSteps) });
        }
        const conforming = fixtures.every((fixture) => fixture["conforming"] === true);
        return { language: "node", ran: true, conforming, disposition: conforming ? "SATISFIED" : "NOT_SATISFIED", fixtures };
    }
}
module.exports = { NodeLanguageToolchains, compileJavaConformance, runJavaConformance };
