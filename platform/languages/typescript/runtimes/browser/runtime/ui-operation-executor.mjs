async function requestJson(path, options) {
  const response = await fetch(path, options);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `UI platform request failed with ${response.status}.`);
  return value;
}

export function createUiOperationExecutor({ interaction, state, updateModel, activeRequest }) {
  async function execute(operation, sourceOverrides = {}) {
    const args = operation.arguments;
    if (operation.kind === "cancel") {
      updateModel((current) => ({ ...current, status: "Cancelling" }));
      activeRequest.current?.abort();
      return;
    }
    if (operation.kind === "load-fixture") {
      updateModel((current) => ({ ...current, busy: true, error: "", validation: {} }));
      try {
        const fixture = await requestJson(`/__sda/api/fixture?fixtureId=${encodeURIComponent(args.fixtureId)}`);
        updateModel((current) => ({ ...current, busy: false, status: `Loaded ${args.fixtureId}`,
          inputs: interaction.applyStatePatch(operation.operationId, current.inputs, {
            "fixture-value": { [args.fixtureId]: fixture.input }
          }) }));
      } catch (error) { updateModel((current) => ({ ...current, busy: false, status: "Failed", error: error.message })); }
      return;
    }
    if (operation.kind === "execute-capability") {
      const failure = interaction.validation.find((rule) => rule.stateId === args.inputStateId && !rule.evaluate(state.inputs[args.inputStateId]));
      if (failure) {
        updateModel((current) => ({ ...current, status: "Failed", error: failure.message, validation: { [failure.validationId]: failure } }));
        return;
      }
      const request = new AbortController();
      activeRequest.current = request;
      updateModel((current) => ({ ...current, busy: true, status: "Executing", error: "", validation: {} }));
      try {
        const result = await requestJson("/__sda/api/execute", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: JSON.parse(state.inputs[args.inputStateId]) }), signal: request.signal });
        updateModel((current) => {
          const inputs = interaction.applyStatePatch(operation.operationId, current.inputs, { "outcome-path": result.outcome });
          return { ...current, inputs, busy: false, status: result.outcome == null ? result.disposition : "Completed",
            result, queryResult: null, outcome: result.outcome, error: "" };
        });
      } catch (error) {
        const cancelled = error.name === "AbortError";
        updateModel((current) => ({ ...current, busy: false, status: cancelled ? "Cancelled" : "Failed", error: cancelled ? "" : error.message }));
      } finally { activeRequest.current = null; }
      return;
    }
    if (operation.kind === "resolve-input") {
      const sources = Object.fromEntries((args.sourceBindings ?? []).map((binding) => [
        binding.stateId,
        Object.prototype.hasOwnProperty.call(sourceOverrides, binding.stateId)
          ? sourceOverrides[binding.stateId]
          : state.inputs[binding.stateId] ?? ""
      ]));
      const request = new AbortController();
      activeRequest.current = request;
      updateModel((current) => ({ ...current, busy: true, status: "Importing", error: "", validation: {} }));
      try {
        const resolution = await requestJson("/__sda/api/resolve-input", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ operation: args, sources }), signal: request.signal });
        updateModel((current) => {
          const inputs = interaction.applyStatePatch(operation.operationId, current.inputs, {
            "semantic-output-role": resolution.outputs ?? {}
          });
          return { ...current, inputs, busy: false, status: "Sources admitted", error: "" };
        });
      } catch (error) {
        const cancelled = error.name === "AbortError";
        updateModel((current) => ({ ...current, busy: false, status: cancelled ? "Cancelled" : "Failed", error: cancelled ? "" : error.message }));
      } finally { activeRequest.current = null; }
      return;
    }
    if (operation.kind === "execute-query") {
      if (state.outcome === null) {
        updateModel((current) => ({ ...current, status: "Failed", error: "A capability outcome is required before a query can execute." }));
        return;
      }
      const params = Object.fromEntries((args.parameterBindings ?? []).map((binding) => [binding.parameter, state.inputs[binding.stateId]]));
      const request = new AbortController();
      activeRequest.current = request;
      updateModel((current) => ({ ...current, busy: true, status: "Querying", error: "" }));
      try {
        const queryResult = await requestJson("/__sda/api/query", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile: state.outcome, queryId: args.queryId, params }), signal: request.signal });
        updateModel((current) => ({ ...current, busy: false, status: "Query completed", queryResult, error: "" }));
      } catch (error) {
        const cancelled = error.name === "AbortError";
        updateModel((current) => ({ ...current, busy: false, status: cancelled ? "Cancelled" : "Failed", error: cancelled ? "" : error.message }));
      } finally { activeRequest.current = null; }
      return;
    }
    throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: UI operation kind '${operation.kind}'.`);
  }
  async function executeEvent(eventId, sourceOverrides = {}) {
    const event = interaction.eventIndex.get(eventId);
    if (!event) throw new Error(`Unknown UI semantic event '${eventId}'.`);
    const operation = interaction.operationIndex.get(event.operationId);
    if (!operation) throw new Error(`Unknown UI operation '${event.operationId}' for semantic event '${eventId}'.`);
    await execute(operation, sourceOverrides);
  }
  return Object.freeze({ bindingPath: "/__sda/api", state, interaction, execute, executeEvent });
}

export function createUiActionDispatcher(interaction, state, executor) {
  return Object.freeze({
    interaction, state, executor,
    isAvailable(action) { return action.isAvailable(state, interaction.stateBindingIndex); },
    async dispatch(action) {
      if (!this.isAvailable(action)) return;
      await executor.executeEvent(action.eventId);
    }
  });
}
