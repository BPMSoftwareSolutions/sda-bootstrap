// GENERATED PURE PROJECTION SEAM. Do not hand-edit.
#nullable enable
using System.Text.Json.Nodes;
using ScenarioKernel.Adapters.Consumer;

namespace ScenarioKernel.ProjectedConsumer;

public sealed class ProjectedConsumerClient
{
    private readonly string _bindingPath;

    public ProjectedConsumerClient(string bindingPath)
    {
        _bindingPath = bindingPath;
    }

    public static ProjectedConsumerClient CreateDefault() =>
        new(Path.Combine(AppContext.BaseDirectory, "authority", "application-binding.csharp.json"));

    public Task<AdmittedConsumerPlatform.ConsumerExecutionResult> ExecuteAsync(JsonNode input, CancellationToken cancellationToken = default) =>
        AdmittedConsumerPlatform.ExecuteAsync(_bindingPath, input, cancellationToken);

    public ValueTask<JsonNode?> QueryAsync(
        JsonNode profile,
        string queryId,
        JsonObject? parameters = null,
        CancellationToken cancellationToken = default) =>
        AdmittedConsumerPlatform.QueryAsync(_bindingPath, profile, queryId, parameters, cancellationToken);
}
