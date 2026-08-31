// GENERATED PURE PROJECTION. Do not hand-edit.
#nullable enable
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using ScenarioKernel.UiEmbodiment;

namespace Sda.ProjectedPresentation.Wpf;

public static class ProjectedSemanticElementRealization
{
    public static FrameworkElement Realize(
        UiPlanElement element,
        IReadOnlyDictionary<string, object?>? readModel = null,
        Action<string>? dispatch = null)
    {
        readModel ??= new Dictionary<string, object?>();
        dispatch ??= _ => { };
        var content = element.Content is null ? null : element.Content.Kind == "LITERAL"
            ? element.Content.Value
            : readModel.GetValueOrDefault(element.Content.Value)?.ToString();
        FrameworkElement control = element.SemanticKind switch
        {
            "INFORMATION" => new TextBlock { Text = content ?? string.Empty },
            "ACTION" => new Button { Content = content },
            "INPUT" => new TextBox { Text = content ?? string.Empty },
            "NAVIGATION" => new Button { Content = content },
            "FEEDBACK" => new TextBlock { Text = content ?? string.Empty },
            "REGION" => new Border { Child = new TextBlock { Text = content ?? string.Empty } },
            _ => throw new InvalidOperationException("SEMANTIC_ELEMENT_KIND_UNSUPPORTED")
        };
        AutomationProperties.SetAutomationId(control, $"sda-v3:{element.SemanticElementRef}");
        if (element.AccessibilityObligations.Any(value => value.ObligationKind == "NAME") && !string.IsNullOrWhiteSpace(content))
            AutomationProperties.SetName(control, content);
        if (element.AccessibilityObligations.Any(value => value.ObligationKind == "LIVE_FEEDBACK"))
            AutomationProperties.SetLiveSetting(control, AutomationLiveSetting.Polite);
        foreach (var binding in element.EventBindings)
        {
            if (control is Button button && binding.Trigger is "ACTIVATE" or "NAVIGATE" or "DISMISS")
                button.Click += (_, _) => dispatch(binding.SemanticEventRef);
            if (control is TextBox textBox && binding.Trigger == "CHANGE")
                textBox.TextChanged += (_, _) => dispatch(binding.SemanticEventRef);
        }
        return control;
    }
}
