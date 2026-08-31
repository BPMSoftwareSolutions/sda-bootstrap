import { atPath } from "/__sda/browser/consumer-ui-semantic-model.mjs";

export function createUiStateStore(interaction, model, updateModel) {
  return Object.freeze({
    inputs: model.inputs, busy: model.busy, status: model.status, error: model.error, result: model.result,
    queryResult: model.queryResult, outcome: model.outcome, validation: model.validation,
    resolve(binding) {
      if (binding.source === "user-input") return model.inputs[binding.stateId];
      if (binding.source === "execution-busy") return model.busy;
      if (binding.source === "execution-status") return model.status;
      if (binding.source === "execution-error") return model.error;
      if (binding.source === "execution-result") return model.result;
      if (binding.source === "query-result") return model.queryResult;
      if (binding.source === "outcome") return atPath(model.outcome, binding.path);
      throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: state source '${binding.source}'.`);
    },
    updateInput(stateId, value) {
      updateModel((current) => ({
        ...current, inputs: { ...current.inputs, [stateId]: value },
        validation: Object.fromEntries(Object.entries(current.validation).filter(([, entry]) => entry.stateId !== stateId))
      }));
    }
  });
}

export function createInitialUiState(interaction) {
  return {
    inputs: Object.fromEntries(interaction.stateBindings.filter((binding) => binding.source === "user-input")
      .map((binding) => [binding.stateId, binding.initialValue])),
    busy: false, status: "Ready", error: "", result: null, queryResult: null, outcome: null, validation: {}
  };
}


