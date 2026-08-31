// GENERIC UI AUTHORITY ADMISSION BOUNDARY: raw documents stop here.
function values(value) {
  return Array.isArray(value) ? value : [];
}

function required(value, label) {
  if (value === undefined || value === null) throw new Error(`UI authority is missing ${label}.`);
  return value;
}

function indexed(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function accessibility(raw = {}) {
  return Object.freeze({ accessibleName: raw.name ?? "", live: raw.live ?? "off" });
}

function admitStateBinding(raw) {
  return Object.freeze({ stateId: raw.stateId, source: raw.source, path: raw.path ?? "", initialValue: raw.initialValue ?? "" });
}

function admitInformation(raw) {
  return Object.freeze({ informationId: raw.informationId, content: raw.content, importance: raw.importance, ...accessibility(raw.accessibility) });
}

function admitInput(raw) {
  return Object.freeze({
    inputId: raw.inputId, stateId: raw.stateId, label: raw.label, inputIntent: raw.inputIntent,
    commitEventId: raw.commitEventId ?? (raw.commitOperationId ? `event.input.${raw.inputId}` : ""),
    commitOperationId: raw.commitOperationId ?? "",
    acceptedFileTypes: Object.freeze(values(raw.acceptedFileTypes).map(String)), placeholder: raw.placeholder ?? "",
    ...accessibility(raw.accessibility)
  });
}

function admitAvailability(raw) {
  return Object.freeze({
    stateId: raw.stateId, operator: raw.operator, value: raw.value,
    evaluate(state, stateBindings) {
      const binding = stateBindings.get(raw.stateId);
      const actual = state.resolve(binding);
      return raw.operator === "equals" ? actual === raw.value : actual !== raw.value;
    }
  });
}

function admitAction(raw) {
  const availability = admitAvailability(raw.availability);
  return Object.freeze({
    actionId: raw.actionId, operationId: raw.operationId, label: raw.label, importance: raw.importance,
    eventId: raw.eventId ?? `event.action.${raw.actionId}`,
    accessibleName: accessibility(raw.accessibility).accessibleName, availability,
    isAvailable(state, stateBindings) { return availability.evaluate(state, stateBindings); }
  });
}

function admitOperation(raw) {
  const { operationId, kind, ...argumentsValue } = raw;
  const admittedArguments = { ...argumentsValue };
  if (Array.isArray(argumentsValue.parameterBindings)) admittedArguments.parameterBindings = Object.freeze(
    argumentsValue.parameterBindings.map((binding) => Object.freeze({ parameter: binding.parameter, stateId: binding.stateId })));
  if (Array.isArray(argumentsValue.sourceBindings)) admittedArguments.sourceBindings = Object.freeze(
    argumentsValue.sourceBindings.map((binding) => Object.freeze({ role: binding.role, stateId: binding.stateId })));
  if (Array.isArray(argumentsValue.targetBindings)) admittedArguments.targetBindings = Object.freeze(
    argumentsValue.targetBindings.map((binding) => Object.freeze({ role: binding.role, path: binding.path, stateId: binding.stateId })));
  return Object.freeze({ operationId, kind, arguments: Object.freeze(admittedArguments) });
}

function derivedStatePatch(operation) {
  const assignments = [];
  const args = operation.arguments;
  if (operation.kind === "load-fixture") {
    assignments.push({ stateId: args.targetStateId, sourceKind: "fixture-value", sourcePath: args.fixtureId });
  }
  for (const binding of values(args.targetBindings)) {
    if (binding.path) assignments.push({ stateId: binding.stateId, sourceKind: "outcome-path", sourcePath: binding.path });
    else if (binding.role) assignments.push({ stateId: binding.stateId, sourceKind: "semantic-output-role", sourcePath: binding.role });
  }
  return assignments.length === 0 ? null : {
    patchId: `patch.${operation.operationId}`,
    operationId: operation.operationId,
    mode: "replace",
    assignments
  };
}

function admitStatePatch(raw) {
  return Object.freeze({
    patchId: raw.patchId,
    operationId: raw.operationId,
    mode: raw.mode,
    assignments: Object.freeze(values(raw.assignments).map((assignment) => Object.freeze({ ...assignment })))
  });
}

function admitSemanticEvent(raw) {
  return Object.freeze({
    eventId: raw.eventId,
    eventType: raw.eventType,
    sourceElementId: raw.sourceElementId,
    operationId: raw.operationId
  });
}

function patchValue(assignment, sources) {
  if (assignment.sourceKind === "outcome-path") return atPath(sources[assignment.sourceKind], assignment.sourcePath);
  return sources[assignment.sourceKind]?.[assignment.sourcePath];
}

function serializedPatchValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function admitValidation(raw) {
  return Object.freeze({
    validationId: raw.validationId, stateId: raw.stateId, rule: raw.rule, message: raw.message,
    evaluate(value) {
      if (raw.rule === "required") return value !== null && value !== undefined && String(value).trim() !== "";
      if (raw.rule === "json") { try { JSON.parse(String(value)); return true; } catch { return false; } }
      throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: validation rule '${raw.rule}'.`);
    }
  });
}

function admitFeedback(raw) {
  return Object.freeze({
    feedbackId: raw.feedbackId, stateId: raw.stateId, label: raw.label, feedbackIntent: raw.feedbackIntent,
    presentationIntent: raw.presentationIntent ?? "plain", ...accessibility(raw.accessibility)
  });
}

function admitCollection(raw) {
  return Object.freeze({
    collectionId: raw.collectionId, stateId: raw.stateId, label: raw.label, ...accessibility(raw.accessibility),
    presentationIntent: raw.presentationIntent ?? "tabular",
    fields: Object.freeze(values(raw.fields).map((field) => Object.freeze({ fieldId: field.fieldId, label: field.label, path: field.path })))
  });
}

function admitInteraction(raw) {
  const stateBindings = values(raw.stateBindings).map(admitStateBinding);
  const information = values(raw.information).map(admitInformation);
  const inputs = values(raw.inputs).map(admitInput);
  const actions = values(raw.actions).map(admitAction);
  const operations = values(raw.operations).map(admitOperation);
  const suppliedEvents = values(raw.events);
  const events = (suppliedEvents.length > 0 ? suppliedEvents : [
    ...actions.map((action) => ({
      eventId: action.eventId,
      eventType: "ui.action-invoked.v1",
      sourceElementId: action.actionId,
      operationId: action.operationId
    })),
    ...inputs.filter((input) => input.commitOperationId).map((input) => ({
      eventId: input.commitEventId,
      eventType: "ui.input-committed.v1",
      sourceElementId: input.inputId,
      operationId: input.commitOperationId
    }))
  ]).map(admitSemanticEvent);
  const suppliedPatches = values(raw.statePatches);
  const statePatches = (suppliedPatches.length > 0 ? suppliedPatches : operations.map(derivedStatePatch).filter(Boolean))
    .map(admitStatePatch);
  const eventIndex = indexed(events, "eventId");
  const statePatchIndex = indexed(statePatches, "operationId");
  const validation = values(raw.validation).map(admitValidation);
  const feedback = values(raw.feedback).map(admitFeedback);
  const collections = values(raw.collections).map(admitCollection);
  const definitions = {
    information: indexed(information, "informationId"), input: indexed(inputs, "inputId"), action: indexed(actions, "actionId"),
    collection: indexed(collections, "collectionId"), feedback: indexed(feedback, "feedbackId")
  };
  return Object.freeze({
    startViewId: raw.startViewId,
    stateBindings: Object.freeze(stateBindings), stateBindingIndex: indexed(stateBindings, "stateId"),
    information: Object.freeze(information), inputs: Object.freeze(inputs), actions: Object.freeze(actions),
    operations: Object.freeze(operations), operationIndex: indexed(operations, "operationId"), validation: Object.freeze(validation),
    feedback: Object.freeze(feedback), collections: Object.freeze(collections),
    events: Object.freeze(events), eventIndex,
    statePatches: Object.freeze(statePatches), statePatchIndex,
    applyStatePatch(operationId, currentInputs, sources) {
      const patch = statePatchIndex.get(operationId);
      if (!patch) return currentInputs;
      return Object.fromEntries([
        ...Object.entries(currentInputs),
        ...patch.assignments.map((assignment) => [assignment.stateId, serializedPatchValue(patchValue(assignment, sources))])
      ]);
    },
    resolveDefinition(reference) {
      const definition = definitions[reference.semanticKind]?.get(reference.refId);
      if (!definition) throw new Error(`UI authority has no ${reference.semanticKind} '${reference.refId}'.`);
      return definition;
    }
  });
}

function admitPresentation(raw) {
  const adaptation = Object.freeze({
    ...raw.adaptation,
    compactRegionOrder: Object.freeze(values(raw.adaptation.compactRegionOrder)),
    standardRegionOrder: Object.freeze(values(raw.adaptation.standardRegionOrder)),
    wideRegionOrder: Object.freeze(values(raw.adaptation.wideRegionOrder)),
    selectContext(width) { return width <= raw.adaptation.compactMaximumWidth ? "compact" : width >= raw.adaptation.wideMinimumWidth ? "wide" : "standard"; }
  });
  const views = values(raw.views).map((view) => Object.freeze({
    viewId: view.viewId, title: view.title, sizeIntent: view.sizeIntent ?? "standard", layoutIntent: view.layoutIntent ?? "stack",
    regions: Object.freeze(values(view.regions).map((region) => Object.freeze({
      regionId: region.regionId, title: region.title, layoutIntent: region.layoutIntent,
      role: region.role ?? "primary-content", importance: region.importance ?? "secondary",
      elements: Object.freeze(values(region.items).map((item) => Object.freeze({ ...item })))
    })))
  }));
  return Object.freeze({
    profileId: raw.profileId, density: raw.density,
    tokens: Object.freeze({ ...raw.tokens }), intent: Object.freeze({ experiencePattern: "standard", ...raw.intent }), adaptation,
    views: Object.freeze(views), viewIndex: indexed(views, "viewId")
  });
}

export function admitConsumerUiApplication(rawAuthority) {
  required(rawAuthority, "document");
  const experience = rawAuthority.experienceAuthority;
  const interaction = admitInteraction(required(rawAuthority.interactionAuthority, "interactionAuthority"));
  const presentation = admitPresentation(required(rawAuthority.presentationProfile, "presentationProfile"));
  return Object.freeze({
    applicationId: rawAuthority.applicationId, title: rawAuthority.title,
    experience: Object.freeze({
      experienceId: experience.experienceId, capabilityBinding: experience.capabilityBinding,
      promise: experience.promise, conditions: Object.freeze(values(experience.conditions).map((condition) => Object.freeze({
        conditionId: condition.conditionId, assertion: condition.assertion ?? condition.statement
      })))
    }),
    interaction, presentation,
    admitAuthority: admitConsumerUiApplication
  });
}

export async function loadConsumerUiApplication(authorityUrl) {
  const response = await fetch(authorityUrl);
  if (!response.ok) throw new Error(`UI authority request failed with ${response.status}.`);
  return admitConsumerUiApplication(await response.json());
}

function eventOperation(events, eventId, elementId) {
  if (!eventId) return "";
  const event = events.get(eventId);
  if (!event) throw new Error(`UI presentation IR has no semantic event '${eventId}' for '${elementId}'.`);
  return event.operationId;
}

function admitCompiledInteraction(raw) {
  const events = indexed(values(raw.events), "eventId");
  const compatibilityShape = {
    ...raw,
    inputs: values(raw.inputs).map((input) => ({
      ...input,
      ...(input.commitEventId ? { commitOperationId: eventOperation(events, input.commitEventId, input.inputId) } : {})
    })),
    actions: values(raw.actions).map((action) => ({
      ...action,
      operationId: eventOperation(events, action.eventId, action.actionId)
    })),
    operations: values(raw.operations).map((operation) => ({
      operationId: operation.operationId,
      kind: operation.kind,
      ...operation.arguments
    }))
  };
  return admitInteraction(compatibilityShape);
}

function admitCompiledPresentation(raw) {
  return admitPresentation({
    ...raw,
    views: values(raw.views).map((view) => ({
      ...view,
      regions: values(view.regions).map((region) => ({ ...region, items: values(region.elements) }))
    }))
  });
}

export function admitConsumerUiPresentationIr(rawIr) {
  required(rawIr, "presentation IR document");
  if (rawIr.presentationIrType !== "sda-ui-presentation-ir.v2") {
    throw new Error(`Unsupported UI presentation protocol '${rawIr.presentationIrType}'.`);
  }
  const raw = required(rawIr.application, "compiled application");
  const interaction = admitCompiledInteraction(required(raw.interaction, "compiled interaction"));
  const presentation = admitCompiledPresentation(required(raw.presentation, "compiled presentation"));
  return Object.freeze({
    applicationId: raw.applicationId,
    title: raw.title,
    protocol: Object.freeze({ ...rawIr.protocol }),
    source: Object.freeze({ ...rawIr.source }),
    requiredFeatureIds: Object.freeze(values(rawIr.requiredFeatureIds)),
    experience: Object.freeze({
      experienceId: raw.experience.experienceId,
      actor: raw.experience.actor,
      promise: raw.experience.promise,
      conditions: Object.freeze(values(raw.experience.conditions).map((condition) => Object.freeze({ ...condition })))
    }),
    interaction,
    presentation,
    admitPresentationIr: admitConsumerUiPresentationIr
  });
}

export async function loadConsumerUiPresentationIr(irUrl) {
  const response = await fetch(irUrl);
  if (!response.ok) throw new Error(`UI presentation IR request failed with ${response.status}.`);
  return admitConsumerUiPresentationIr(await response.json());
}

export function atPath(source, dottedPath = "") {
  return dottedPath.split(".").filter(Boolean).reduce((value, segment) => value?.[segment], source);
}

export function displayValue(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
