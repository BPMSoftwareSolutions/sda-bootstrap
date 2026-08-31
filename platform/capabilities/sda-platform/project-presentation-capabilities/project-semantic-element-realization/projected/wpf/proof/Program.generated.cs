// GENERATED NATIVE EQUIVALENCE PROOF. Do not hand-edit.
#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.ExceptionServices;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using ScenarioKernel.UiEmbodiment;
using ScenarioKernel.Wpf;
using Sda.ProjectedPresentation.Wpf;

var repositoryRoot = RepositoryRoot();
var planPath = Path.Combine(repositoryRoot, "capabilities", "sda-platform", "project-presentation-capabilities", "project-semantic-element-realization", "projected", "wpf", "proof", "fixtures", "all-semantic-kinds.ui-embodiment-plan.v1.json");
RunSta(() =>
{
    var planJson = File.ReadAllText(planPath);
    var readModel = new Dictionary<string, object?>();
    var oracleDispatch = new List<string>();
    var projectedDispatch = new List<string>();
    var oracle = V3PlanEmbodiment.Materialize(planJson, readModel, oracleDispatch.Add);
    var projection = UiEmbodimentPlan.Apply(planJson);
    var oracleControls = ((StackPanel)oracle.Roots.Single()).Children.Cast<FrameworkElement>().ToArray();
    var projectedControls = projection.Elements
        .Select(element => ProjectedSemanticElementRealization.Realize(element, readModel, projectedDispatch.Add))
        .ToArray();
    Require(oracleControls.Length == projectedControls.Length, "ELEMENT_COUNT_MISMATCH");
    for (var index = 0; index < oracleControls.Length; index++)
    {
        var expected = oracleControls[index];
        var actual = projectedControls[index];
        Require(expected.GetType() == actual.GetType(), $"NATIVE_TYPE_MISMATCH:{index}");
        Require(Content(expected) == Content(actual), $"CONTENT_MISMATCH:{index}");
        Require(AutomationProperties.GetAutomationId(expected) == AutomationProperties.GetAutomationId(actual), $"AUTOMATION_ID_MISMATCH:{index}");
        Require(AutomationProperties.GetName(expected) == AutomationProperties.GetName(actual), $"AUTOMATION_NAME_MISMATCH:{index}");
        Require(AutomationProperties.GetLiveSetting(expected) == AutomationProperties.GetLiveSetting(actual), $"LIVE_SETTING_MISMATCH:{index}");
    }
    ((Button)oracleControls[1]).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    ((Button)projectedControls[1]).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    Require(oracleDispatch.SequenceEqual(projectedDispatch), "EVENT_DISPATCH_MISMATCH");
});
Console.WriteLine("WPF_PROJECTED_SEMANTIC_ELEMENT_EQUIVALENT");

static string Content(FrameworkElement value) => value switch
{
    Button button => button.Content?.ToString() ?? string.Empty,
    TextBox textBox => textBox.Text,
    TextBlock textBlock => textBlock.Text,
    Border { Child: TextBlock textBlock } => textBlock.Text,
    _ => string.Empty
};

static string RepositoryRoot()
{
    var current = new DirectoryInfo(AppContext.BaseDirectory);
    while (current is not null && !File.Exists(Path.Combine(current.FullName, "package.json"))) current = current.Parent;
    return current?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
}

static void Require(bool condition, string code)
{
    if (!condition) throw new InvalidOperationException(code);
}

static void RunSta(Action action)
{
    Exception? failure = null;
    var thread = new Thread(() =>
    {
        try { action(); }
        catch (Exception exception) { failure = exception; }
    });
    thread.SetApartmentState(ApartmentState.STA);
    thread.Start();
    thread.Join();
    if (failure is not null) ExceptionDispatchInfo.Capture(failure).Throw();
}
