const INSTRUCTION_KINDS = new Set([
  "REALIZE_SEMANTIC_ELEMENT",
  "COMPOSE_NODE",
  "BIND_EVENT",
  "APPLY_ADAPTATION",
  "APPLY_ACCESSIBILITY",
  "APPLY_PROFILE_REFERENCE",
  "APPLY_TOKEN_REFERENCE"
]);

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function requirePlan(plan) {
  if (plan?.planType !== "ui-embodiment-plan.v1") throw new Error("UI_EMBODIMENT_PLAN_TYPE_UNSUPPORTED");
  if (!Array.isArray(plan.instructions) || !Array.isArray(plan.rootNodeRefs)) throw new Error("UI_EMBODIMENT_PLAN_INCOMPLETE");
  const instructionIds = new Set();
  for (const instruction of plan.instructions) {
    if (!INSTRUCTION_KINDS.has(instruction.instructionKind)) throw new Error("UI_EMBODIMENT_INSTRUCTION_UNSUPPORTED");
    if (instructionIds.has(instruction.instructionId)) throw new Error("UI_EMBODIMENT_INSTRUCTION_DUPLICATE");
    instructionIds.add(instruction.instructionId);
  }
}

export function applyUiEmbodimentPlan(plan, adapter) {
  requirePlan(plan);
  if (!adapter?.targetKind || !adapter?.constructionApi || typeof adapter.nativeRoleFor !== "function") {
    throw new Error("UI_EMBODIMENT_ADAPTER_INVALID");
  }

  const ofKind = (kind) => plan.instructions.filter((instruction) => instruction.instructionKind === kind);
  const events = ofKind("BIND_EVENT");
  const accessibility = ofKind("APPLY_ACCESSIBILITY");
  const elements = ofKind("REALIZE_SEMANTIC_ELEMENT").map((instruction) => Object.freeze({
    semanticElementRef: instruction.sourceRef,
    semanticKind: instruction.semanticKind,
    semanticRole: instruction.semanticRole,
    nativeRole: adapter.nativeRoleFor(instruction.semanticKind, instruction.semanticRole),
    content: instruction.content,
    stateRefs: sorted(instruction.stateRefs),
    eventBindings: events
      .filter((event) => event.semanticElementRef === instruction.sourceRef)
      .map((event) => Object.freeze({
        bindingRef: event.sourceRef,
        semanticEventRef: event.semanticEventRef,
        trigger: event.trigger,
        mechanicId: event.mechanicId
      }))
      .sort((left, right) => left.bindingRef.localeCompare(right.bindingRef)),
    accessibilityObligations: accessibility
      .filter((obligation) => obligation.semanticElementRef === instruction.sourceRef)
      .map((obligation) => Object.freeze({
        obligationRef: obligation.sourceRef,
        obligationKind: obligation.obligationKind,
        mechanicId: obligation.mechanicId
      }))
      .sort((left, right) => left.obligationRef.localeCompare(right.obligationRef))
  })).sort((left, right) => left.semanticElementRef.localeCompare(right.semanticElementRef));

  const nodes = ofKind("COMPOSE_NODE").map((instruction) => Object.freeze({
    nodeRef: instruction.sourceRef,
    mechanicId: instruction.mechanicId,
    nativeRole: adapter.containerRoleFor(instruction.configuration),
    configuration: Object.freeze({ ...instruction.configuration }),
    childNodeRefs: [...instruction.childNodeRefs],
    semanticElementRefs: [...instruction.semanticElementRefs]
  })).sort((left, right) => left.nodeRef.localeCompare(right.nodeRef));
  const nodeRefs = new Set(nodes.map((node) => node.nodeRef));
  if (plan.rootNodeRefs.some((nodeRef) => !nodeRefs.has(nodeRef))) throw new Error("UI_EMBODIMENT_ROOT_UNRESOLVED");
  const elementRefs = new Set(elements.map((element) => element.semanticElementRef));
  if (nodes.some((node) => node.childNodeRefs.some((nodeRef) => !nodeRefs.has(nodeRef)))) {
    throw new Error("UI_EMBODIMENT_CHILD_NODE_UNRESOLVED");
  }
  if (nodes.some((node) => node.semanticElementRefs.some((elementRef) => !elementRefs.has(elementRef))) ||
      events.some((event) => !elementRefs.has(event.semanticElementRef)) ||
      accessibility.some((obligation) => !elementRefs.has(obligation.semanticElementRef))) {
    throw new Error("UI_EMBODIMENT_ELEMENT_UNRESOLVED");
  }

  const adaptations = ofKind("APPLY_ADAPTATION").map((instruction) => Object.freeze({
    sourceRef: instruction.sourceRef,
    semanticAdaptationRef: instruction.semanticAdaptationRef,
    contextRef: instruction.contextRef,
    operationKind: instruction.operationKind,
    nodeRefs: [...instruction.nodeRefs],
    invariantRefs: [...instruction.invariantRefs],
    mechanicId: instruction.mechanicId
  })).sort((left, right) => `${left.sourceRef}:${left.operationKind}`.localeCompare(`${right.sourceRef}:${right.operationKind}`));
  if (adaptations.some((adaptation) => adaptation.nodeRefs.some((nodeRef) => !nodeRefs.has(nodeRef)))) {
    throw new Error("UI_EMBODIMENT_ADAPTATION_NODE_UNRESOLVED");
  }

  return Object.freeze({
    projectionType: "ui-embodiment-projection.v1",
    planDigest: plan.canonicalDigest,
    providerId: plan.providerId,
    providerDigest: plan.providerDigest,
    targetKind: adapter.targetKind,
    constructionApi: adapter.constructionApi,
    rootNodeRefs: [...plan.rootNodeRefs],
    elements,
    nodes,
    adaptations,
    profileRefs: sorted(ofKind("APPLY_PROFILE_REFERENCE").map((instruction) => instruction.profileRef)),
    tokenRefs: sorted(ofKind("APPLY_TOKEN_REFERENCE").map((instruction) => instruction.sourceRef))
  });
}

export function observeUiEmbodimentProjection(projection) {
  const elementResults = projection.elements.map((element) => Object.freeze({
    semanticElementRef: element.semanticElementRef,
    semanticKind: element.semanticKind,
    nativeRole: element.nativeRole,
    eventRefs: element.eventBindings.map((binding) => binding.semanticEventRef).sort(),
    accessibilityObligationRefs: element.accessibilityObligations.map((obligation) => obligation.obligationRef).sort(),
    disposition: "REALIZED"
  }));
  const compositionResults = projection.nodes.map((node) => Object.freeze({
    nodeRef: node.nodeRef,
    nativeRole: node.nativeRole,
    semanticElementRefs: [...node.semanticElementRefs],
    childNodeRefs: [...node.childNodeRefs],
    disposition: "REALIZED"
  }));
  const adaptationResults = projection.adaptations.map((adaptation) => Object.freeze({
    sourceRef: adaptation.sourceRef,
    operationKind: adaptation.operationKind,
    nodeRefs: [...adaptation.nodeRefs],
    disposition: "PRESERVED"
  }));
  return Object.freeze({
    testimonyType: "ui-embodiment-structural-testimony.v1",
    planDigest: projection.planDigest,
    providerId: projection.providerId,
    providerDigest: projection.providerDigest,
    targetKind: projection.targetKind,
    constructionApi: projection.constructionApi,
    rootNodeRefs: [...projection.rootNodeRefs],
    elementResults,
    compositionResults,
    adaptationResults,
    findings: [],
    disposition: "STRUCTURALLY_CONFORMANT"
  });
}
