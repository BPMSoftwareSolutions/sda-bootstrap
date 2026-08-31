import { sha256 } from "../../primitives/sha256.js";
export const FORBIDDEN_EXECUTABLE_MECHANICS = Object.freeze({
    branch: /\b(?:if|else|switch|case)\b|\?\s*[^.]/,
    iteration: /\b(?:for|while|map|flatMap|reduce|forEach)\b/,
    "exception-handling": /\b(?:try|catch|finally)\b/,
    throw: /\bthrow\b/,
    "object-construction": /\bnew\s+[A-Za-z_$]|(?:^|[=(,])\s*\{\s*[A-Za-z_$"']/m,
    serialization: /\b(?:JSON\.(?:parse|stringify)|serialize|deserialize)\b/,
    normalization: /\bnormaliz(?:e|ation)\b/i,
    validation: /\b(?:validate|validator|assert)\b/i,
    fallback: /\b(?:fallback|default)\b|\?\?|\|\|/i,
    retry: /\bretr(?:y|ies)\b/i,
    "state-mutation": /(?:\+\+|--|\.(?:push|pop|shift|unshift|splice)\s*\()/,
    "meaning-hidden-in-text": /(?:score\s*[><=]|business\s*rule|domain\s*logic)/i
});
function executable(file) {
    if (file.relativePath.endsWith("/Package.swift"))
        return false;
    return /\.(?:js|mjs|cjs|ts|tsx|cs|py|java|swift|kt|cpp)$/.test(file.relativePath);
}
function recognizedSeam(file) {
    if (file.content.includes("\r")) {
        return recognizedSeam({ ...file, content: file.content.replace(/\r\n?/g, "\n") });
    }
    const base = file.relativePath.split("/").at(-1) ?? "";
    if (base === "Program.generated.cs") {
        return /^\/\/ GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\nusing ScenarioKernel\.Adapters\.Consumer;\nreturn await AdmittedConsumerPlatform\.RunAsync\("authority\/application-binding\.csharp\.json", args\);\n$/.test(file.content);
    }
    if (base === "ProjectedConsumerClient.generated.cs") {
        return /^\/\/ GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\n#nullable enable\nusing System\.Text\.Json\.Nodes;\nusing ScenarioKernel\.Adapters\.Consumer;\n\nnamespace ScenarioKernel\.ProjectedConsumer;\n\npublic sealed class ProjectedConsumerClient\n\{[\s\S]*public Task<AdmittedConsumerPlatform\.ConsumerExecutionResult> ExecuteAsync\(JsonNode input, CancellationToken cancellationToken = default\) =>\n        AdmittedConsumerPlatform\.ExecuteAsync\(_bindingPath, input, cancellationToken\);[\s\S]*public ValueTask<JsonNode\?> QueryAsync\([\s\S]*AdmittedConsumerPlatform\.QueryAsync\(_bindingPath, profile, queryId, parameters, cancellationToken\);\n\}\n$/.test(file.content);
    }
    if (base === "ProjectedUiViewModel.generated.cs") {
        return /^\/\/ GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\n#nullable enable\nusing System\.IO;\nusing ScenarioKernel\.Wpf;\n\nnamespace Sda\.ProjectedConsumer;\n\npublic sealed class ProjectedUiViewModel : AuthorityBackedViewModel\n\{\n    public ProjectedUiViewModel\(\)\n        : base\(\n            Path\.Combine\(AppContext\.BaseDirectory, "authority", "application-binding\.csharp\.json"\),\n            Path\.Combine\(AppContext\.BaseDirectory, "authority", "ui-authority\.csharp\.json"\)\)\n    \{\n    \}\n\}\n$/.test(file.content);
    }
    if (base === "consumer.generated.py") {
        return /^# GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\nfrom scenario_kernel\.platform\.consumer import main\n\nraise SystemExit\(main\(__file__\)\)\n$/.test(file.content);
    }
    if (base === "application.generated.mjs") {
        return /^(?:\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\nimport mountAuthorityApplication from "\/__sda\/(?:react\/authority-backed-application|html\/authority-backed-dom-application)\.mjs";\nmountAuthorityApplication\("sda-root", "\.\/authority\/ui-authority\.(?:react|html)\.json"\);|\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\nimport mountPresentationApplication from "\/__sda\/react\/authority-backed-application\.mjs";\nmountPresentationApplication\("sda-root", "\.\/authority\/ui-presentation-ir\.react\.json"\);)\n$/.test(file.content);
    }
    if (base === "ProjectedApplication.java") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\npackage sda\.projected;\n\nimport scenario\.kernel\.javafx\.AuthorityBackedJavaFxApplication;\n\npublic final class ProjectedApplication \{\n  private ProjectedApplication\(\) \{\}\n  public static void main\(String\[\] args\) \{\n    AuthorityBackedJavaFxApplication\.launchAuthority\("authority\/ui-authority\.javafx\.json", System\.getProperty\("sda\.ui\.platform-origin", "http:\/\/127\.0\.0\.1:43137"\), args\);\n  \}\n\}\n$/.test(file.content);
    }
    if (base === "main.generated.cpp") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\n#include "authority_backed_appkit_application\.hpp"\n#include "json_value\.hpp"\n\nint main\(int argc, char\* argv\[\]\) \{\n  return sda::ui::run_projected_appkit_application\(argc, argv, "authority\/ui-authority\.cpp-appkit\.json"\);\n\}\n$/.test(file.content);
    }
    if (base === "main.generated.swift") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\nimport SwiftUI\nimport ScenarioKernelSwiftUI\n\n@main struct ProjectedConsumerApplication: App \{\n  var body: some Scene \{\n    WindowGroup \{ AuthorityBackedApplication\(authorityURL: Bundle\.module\.url\(forResource: "ui-authority\.swiftui", withExtension: "json", subdirectory: "authority"\)!, platformOrigin: URL\(string: ProcessInfo\.processInfo\.environment\["SDA_UI_PLATFORM_ORIGIN"\] \?\? "http:\/\/127\.0\.0\.1:43137"\)!\) \}\n  \}\n\}\n$/.test(file.content);
    }
    if (base === "ProjectedConsumerActivity.generated.kt") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\npackage sda\.projected\n\nimport dev\.scenariodriven\.compose\.AuthorityBackedComposeActivity\n\nclass ProjectedConsumerActivity : AuthorityBackedComposeActivity\(\) \{\n  override val authorityAsset = "ui-authority\.android-compose\.json"\n\}\n$/.test(file.content);
    }
    if (base === "App.generated.axaml.cs") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\nusing Avalonia;\nusing Avalonia\.Controls\.ApplicationLifetimes;\nusing Avalonia\.Markup\.Xaml;\n\nnamespace Sda\.ProjectedConsumer;\n\npublic partial class App : Application\n\{\n    public override void Initialize\(\) => AvaloniaXamlLoader\.Load\(this\);\n\n    public override void OnFrameworkInitializationCompleted\(\)\n    \{\n        if \(ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop\) desktop\.MainWindow = new MainWindow\(\);\n        base\.OnFrameworkInitializationCompleted\(\);\n    \}\n\}\n$/.test(file.content);
    }
    if (base === "AvaloniaProgram.generated.cs") {
        return /^\/\/ GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\nusing Avalonia;\n\nnamespace Sda\.ProjectedConsumer;\n\ninternal static class AvaloniaProgram\n\{\n    \[STAThread\]\n    public static void Main\(string\[\] args\) => BuildAvaloniaApp\(\)\.StartWithClassicDesktopLifetime\(args\);\n\n    public static AppBuilder BuildAvaloniaApp\(\) => AppBuilder\.Configure<App>\(\)\.UsePlatformDetect\(\)\.LogToTrace\(\);\n\}\n$/.test(file.content);
    }
    if (base === "MainWindow.generated.axaml.cs") {
        return /^\/\/ GENERATED PURE UI PROJECTION SEAM\. Do not hand-edit\.\nusing Avalonia\.Controls;\n\nnamespace Sda\.ProjectedConsumer;\n\npublic partial class MainWindow : Window\n\{\n    public MainWindow\(\) => InitializeComponent\(\);\n\}\n$/.test(file.content);
    }
    if (base.endsWith(".generated.mjs") || base === "capability.projected.test.mjs") {
        return /^(?:#!\/usr\/bin\/env node\n)?\/\/ GENERATED PURE PROJECTION SEAM\. Do not hand-edit\.\nimport [A-Za-z]+ from "[^"]+";\n(?:export const [A-Za-z]+ = [^\n]+;|[A-Za-z]+\.[A-Za-z]+\([^\n]+\);)\n$/.test(file.content);
    }
    return false;
}
export function evaluateMechanicalSterility(files) {
    const violations = [];
    const forbiddenMarkup = /(?:x:Code|ObjectDataProvider|EventSetter|MethodName\s*=|Converter\s*=|MultiBinding|DataTrigger|EventTrigger|Click\s*=|Loaded\s*=|SelectionChanged\s*=|Interaction\.Behaviors|x:CompileBindings)/g;
    for (const file of files.filter((candidate) => candidate.relativePath.endsWith(".xaml") || candidate.relativePath.endsWith(".axaml"))) {
        const marker = "<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n";
        const count = file.content.match(forbiddenMarkup)?.length ?? 0;
        if (!file.content.replace(/\r\n?/g, "\n").startsWith(marker) || count > 0) {
            violations.push({ file: file.relativePath, mechanic: "meaning-hidden-in-text", count: Math.max(1, count) });
        }
    }
    for (const file of files.filter(executable)) {
        if (recognizedSeam(file))
            continue;
        for (const [mechanic, pattern] of Object.entries(FORBIDDEN_EXECUTABLE_MECHANICS)) {
            const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
            const count = file.content.match(new RegExp(pattern.source, flags))?.length ?? 0;
            if (count > 0)
                violations.push({ file: file.relativePath, mechanic, count });
        }
        violations.push({ file: file.relativePath, mechanic: "meaning-hidden-in-text", count: 1 });
    }
    const counts = Object.fromEntries(Object.keys(FORBIDDEN_EXECUTABLE_MECHANICS).map((mechanic) => [
        mechanic,
        violations.filter((violation) => violation.mechanic === mechanic).reduce((sum, violation) => sum + violation.count, 0)
    ]));
    return Object.freeze({
        conformanceType: "projected-artifact-mechanical-sterility.v1",
        sourceOrigin: "PROJECTED",
        forbiddenExecutableMechanics: counts,
        violations: Object.freeze(violations),
        disposition: violations.length === 0 ? "PURE_PROJECTION_CONFORMS" : "PROJECTED_EXECUTION_MECHANIC_VIOLATION"
    });
}
export function addSterilityEvidence(plan, evidence) {
    const content = `${JSON.stringify(evidence, null, 2)}\n`;
    const proofFile = Object.freeze({
        relativePath: "projection-conformance.json",
        content,
        digest: sha256(content),
        sourcePointers: ["consumer-assurance/prove-mechanical-sterility"],
        target: "shared"
    });
    return Object.freeze({ ...plan, files: Object.freeze([...plan.files, proofFile].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) });
}
