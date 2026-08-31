import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function normalizeText(text) {
  if (text === "") return "";
  try { return JSON.parse(text); }
  catch { return text; }
}

function emptyObservations() {
  return { information: [], availability: [], validation: [], state: [], feedback: [], navigation: [], accessibility: [] };
}

function attributeSelector(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function semanticLocator(tab, kind, id) {
  const native = kind === "input" ? ":is(input,textarea,select)" : kind === "action" ? ":is(button,[role=button])" : "";
  return tab.playwright.locator(`[data-sda-kind="${attributeSelector(kind)}"][data-sda-id="${attributeSelector(id)}"]${native}`);
}

function definition(authority, kind, id) {
  const interaction = authority.interactionAuthority;
  const [property, idName] = kind === "input" ? ["inputs", "inputId"]
    : kind === "action" ? ["actions", "actionId"]
      : kind === "feedback" ? ["feedback", "feedbackId"]
        : kind === "collection" ? ["collections", "collectionId"]
          : ["information", "informationId"];
  return (interaction[property] ?? []).find((item) => item[idName] === id) ?? null;
}

async function feedbackValue(tab, feedbackId) {
  const element = semanticLocator(tab, "feedback", feedbackId);
  const semanticValue = await element.getAttribute("data-sda-feedback-value", { timeoutMs: 10000 });
  if (semanticValue !== null) {
    const value = JSON.parse(semanticValue);
    if (typeof value === "string" && /^[\s]*[\[{]/u.test(value)) {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }
  const document = element.locator('[data-sda-document-model]').first();
  if ((await document.count()) > 0) return normalizeText(await document.getAttribute("data-sda-document-model", { timeoutMs: 10000 }) ?? "");
  const value = element.locator("output, pre", {}).first();
  return normalizeText((await value.count()) > 0 ? await value.innerText({ timeoutMs: 10000 }) : "");
}

async function waitForAction(tab, authority, priorStatus) {
  const status = authority.interactionAuthority.feedback.find((item) => item.feedbackIntent === "status");
  const expires = Date.now() + 120000;
  let changed = false;
  while (Date.now() < expires) {
    const current = await feedbackValue(tab, status.feedbackId);
    changed ||= current !== priorStatus;
    const busy = await tab.playwright.locator('[data-sda-ready="true"]').getAttribute("data-sda-busy", { timeoutMs: 10000 });
    if (changed && busy === "false" && !["Executing", "Querying", "Cancelling"].includes(current)) return;
    await tab.playwright.waitForTimeout(75);
  }
  throw new Error("Projected React action did not reach an observable terminal UI state.");
}

async function observeState(tab, authority, target) {
  const collection = definition(authority, "collection", target);
  if (collection) {
    const semanticValue = await semanticLocator(tab, "collection", target).getAttribute("data-sda-collection-value", { timeoutMs: 10000 });
    if (semanticValue !== null) return JSON.parse(semanticValue).map((row) => Object.fromEntries(
      collection.fields.map((field) => [field.fieldId, normalizeText(typeof row[field.fieldId] === "string" ? row[field.fieldId] : JSON.stringify(row[field.fieldId]))])));
    const rows = await semanticLocator(tab, "collection", target).locator("tbody tr", {}).all();
    const result = [];
    for (const row of rows) {
      const cells = await row.locator("td", {}).allTextContents({ timeoutMs: 10000 });
      result.push(Object.fromEntries(collection.fields.map((field, index) => [field.fieldId, normalizeText(cells[index] ?? "")])));
    }
    return result;
  }
  const state = authority.interactionAuthority.stateBindings.find((item) => item.stateId === target);
  if (!state) return null;
  if (state.source === "user-input") {
    const input = authority.interactionAuthority.inputs.find((item) => item.stateId === target);
    const value = await tab.playwright.evaluate(({ inputId }) => {
      const element = [...document.querySelectorAll("input,textarea,select")].find((candidate) => candidate.dataset.sdaKind === "input" && candidate.dataset.sdaId === inputId);
      if (!element) throw new Error(`Projected input '${inputId}' is not rendered.`);
      return element.value;
    }, { inputId: input.inputId }, { timeoutMs: 10000 });
    return state.valueIntent === "structured" ? { canonicalDigest: digest(JSON.parse(value)) } : value;
  }
  return null;
}

async function observe(tab, authority, dimension, target) {
  if (dimension === "availability") return semanticLocator(tab, "action", target).isEnabled();
  if (dimension === "accessibility") {
    const kinds = ["input", "action", "feedback", "collection", "information"];
    for (const kind of kinds) {
      const locator = semanticLocator(tab, kind, target);
      if ((await locator.count()) > 0) return { name: await locator.getAttribute("aria-label", { timeoutMs: 10000 }) };
    }
    return { name: null };
  }
  if (dimension === "validation") {
    const locator = semanticLocator(tab, "validation", target);
    return (await locator.count()) > 0 ? await locator.innerText({ timeoutMs: 10000 }) : "";
  }
  if (dimension === "feedback") return feedbackValue(tab, target);
  if (dimension === "information") return semanticLocator(tab, "information", target).innerText({ timeoutMs: 10000 });
  if (dimension === "navigation") return tab.playwright.locator('[data-sda-ready="true"]').getAttribute("data-sda-view-id", { timeoutMs: 10000 });
  if (dimension === "state") return observeState(tab, authority, target);
  return null;
}

async function actionDisposition(tab, authority) {
  if ((await tab.playwright.locator('[data-sda-kind="validation"]').count()) > 0) return "BLOCKED_BY_VALIDATION";
  const status = authority.interactionAuthority.feedback.find((item) => item.feedbackIntent === "status");
  return await feedbackValue(tab, status.feedbackId) === "Failed" ? "FAILED_TO_REALIZE" : "COMPLETED";
}

async function applyVector(tab, origin, applicationPath, authority, vector) {
  await tab.goto(`${origin}${applicationPath}`);
  await tab.playwright.locator('[data-sda-ready="true"]').waitFor({ state: "visible", timeoutMs: 15000 });
  const status = authority.interactionAuthority.feedback.find((item) => item.feedbackIntent === "status");
  const steps = [];
  let vectorDisposition = "COMPLETED";
  for (const step of vector.steps) {
    let interactionDisposition = "COMPLETED";
    const observations = emptyObservations();
    if (step.action === "set-state") {
      const input = authority.interactionAuthority.inputs.find((item) => item.stateId === step.target);
      const value = typeof step.value === "string" ? step.value : JSON.stringify(step.value, null, 2);
      await semanticLocator(tab, "input", input.inputId).fill(value, { timeoutMs: 15000 });
    } else if (step.action === "invoke-action") {
      const action = semanticLocator(tab, "action", step.target);
      if (!await action.isEnabled()) interactionDisposition = "UNAVAILABLE";
      else {
        const priorStatus = await feedbackValue(tab, status.feedbackId);
        await action.click({ timeoutMs: 15000 });
        await waitForAction(tab, authority, priorStatus);
        interactionDisposition = await actionDisposition(tab, authority);
      }
    } else {
      observations[step.dimension].push({ target: step.target, value: await observe(tab, authority, step.dimension, step.target) });
    }
    if (interactionDisposition !== "COMPLETED") vectorDisposition = interactionDisposition;
    steps.push({
      stepId: step.stepId,
      semanticAction: step.action,
      target: step.target,
      interactionDisposition,
      observations
    });
  }
  return { vectorId: vector.vectorId, interactionDisposition: vectorDisposition, steps };
}

async function observeWiring(tab, target, authority, identity) {
  const requiredInteractions = [
    ...authority.interactionAuthority.inputs.map((item) => ({
      semanticKind: "input", refId: item.inputId,
      ...(item.commitOperationId ? { commitOperationId: item.commitOperationId } : {})
    })),
    ...authority.interactionAuthority.actions.map((item) => ({ semanticKind: "action", refId: item.actionId }))
  ];
  const realizedInteractions = [];
  const unboundRequiredInteractions = [];
  for (const required of requiredInteractions) {
    const locator = semanticLocator(tab, required.semanticKind, required.refId);
    const count = await locator.count();
    const commitOperationId = count === 1 && required.semanticKind === "input"
      ? await locator.getAttribute("data-sda-commit-operation-id", { timeoutMs: 10000 }) : null;
    const commitIsWired = !required.commitOperationId || commitOperationId === required.commitOperationId;
    if (count === 1 && commitIsWired) realizedInteractions.push({
      ...required,
      nativeRole: required.semanticKind === "action" ? "button" : "textbox",
      nativeLocator: `[data-sda-kind=${required.semanticKind}][data-sda-id=${required.refId}]`
    });
    else unboundRequiredInteractions.push(required);
  }
  const inventedInteractions = [];
  for (const kind of ["input", "action"]) {
    const native = kind === "input" ? ":is(input,textarea,select)" : ":is(button,[role=button])";
    for (const locator of await tab.playwright.locator(`[data-sda-kind="${kind}"]${native}`).all()) {
      const refId = await locator.getAttribute("data-sda-id", { timeoutMs: 10000 });
      if (!requiredInteractions.some((item) => item.semanticKind === kind && item.refId === refId)) inventedInteractions.push({
        semanticKind: kind,
        refId,
        nativeRole: kind === "action" ? "button" : "textbox",
        nativeLocator: `[data-sda-kind=${kind}][data-sda-id=${refId}]`
      });
    }
  }
  return {
    wiringConformanceType: "consumer-ui-wiring-conformance.v1",
    applicationId: authority.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    requiredInteractions,
    realizedInteractions,
    unboundRequiredInteractions,
    inventedInteractions,
    disposition: unboundRequiredInteractions.length === 0 && inventedInteractions.length === 0 ? "PASS" : "FAIL"
  };
}

function presentationObservation(dimension, target, declaredIntent, observed, nativeEvidence) {
  return { dimension, target, declaredIntent, disposition: observed ? "OBSERVED" : "NOT_OBSERVED", nativeEvidence };
}

async function renderedSnapshot(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      tagName: element.tagName.toLowerCase(),
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      display: style.display,
      flexWrap: style.flexWrap,
      overflowX: style.overflowX,
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      boundingRectangle: { x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }
    };
  }, undefined, { timeoutMs: 10000 });
}

async function renderContext(tab) {
  return tab.playwright.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scale: devicePixelRatio,
    theme: getComputedStyle(document.documentElement).colorScheme === "dark" ? "dark" : "light",
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  }), undefined, { timeoutMs: 10000 });
}

async function observePresentation(tab, target, authority, identity) {
  const presentation = authority.presentationProfile;
  const root = tab.playwright.locator('[data-sda-ready="true"]');
  const context = await renderContext(tab);
  const contextId = context.width <= presentation.adaptation.compactMaximumWidth ? "compact"
    : context.width >= presentation.adaptation.wideMinimumWidth ? "wide" : "standard";
  const observations = [];
  const pageTitle = tab.playwright.locator('[data-sda-presentation-id="page-title"]');
  const pageSnapshot = await renderedSnapshot(pageTitle);
  observations.push(presentationObservation("hierarchy", "application-hierarchy", presentation.intent.hierarchy,
    await pageTitle.getAttribute("data-sda-hierarchy", { timeoutMs: 10000 }) === presentation.intent.hierarchy.pageTitle && pageSnapshot.tagName === "h1",
    { mechanism: "rendered-dom", locator: '[data-sda-presentation-id="page-title"]', ...pageSnapshot }));
  const typographyEvidence = await root.evaluate((element) => ({
    display: getComputedStyle(element.querySelector("h1")).fontSize,
    section: getComputedStyle(element.querySelector('.sda-region:not([data-sda-region-role="navigation"]):not([data-sda-region-role="hero"]) h2')).fontSize,
    label: getComputedStyle(element.querySelector("label, h3")).fontSize,
    body: getComputedStyle(element).fontSize
  }), undefined, { timeoutMs: 10000 });
  observations.push(presentationObservation("typography", "application-typography", presentation.tokens.typography,
    typographyEvidence.display === `${presentation.tokens.typography.display.size}px` &&
      typographyEvidence.section === `${presentation.tokens.typography.section.size}px` &&
      typographyEvidence.label === `${presentation.tokens.typography.label.size}px`,
    { mechanism: "computed-style", locator: '[data-sda-ready="true"]', ...typographyEvidence }));
  const tokenEvidence = await root.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      pageSurface: style.getPropertyValue("--sda-color-page").trim(),
      contentSurface: style.getPropertyValue("--sda-color-content").trim(),
      spacingXs: style.getPropertyValue("--sda-space-xs").trim(),
      spacingXl: style.getPropertyValue("--sda-space-xl").trim(),
      density: element.getAttribute("data-sda-spacing-density")
    };
  }, undefined, { timeoutMs: 10000 });
  observations.push(presentationObservation("spacing-density", "application-density",
    { density: presentation.density, spacing: presentation.tokens.spacing },
    tokenEvidence.density === presentation.density && tokenEvidence.spacingXs === `${presentation.tokens.spacing.xs}px` && tokenEvidence.spacingXl === `${presentation.tokens.spacing.xl}px`,
    { mechanism: "computed-style", locator: '[data-sda-ready="true"]', ...tokenEvidence }));
  const statusElement = tab.playwright.locator('[data-sda-kind="feedback"][data-sda-state-distinction="informative"]');
  const errorElement = tab.playwright.locator('[data-sda-kind="feedback"][data-sda-state-distinction="assertive"]');
  observations.push(presentationObservation("state-distinction", "application-states", presentation.intent.stateDistinction,
    (await statusElement.count()) > 0 && (await errorElement.count()) > 0 &&
      await root.getAttribute("data-sda-platform-adaptation", { timeoutMs: 10000 }) === presentation.intent.platformAdaptation,
    { mechanism: "rendered-dom", locator: '[data-sda-state-distinction]', statusCount: await statusElement.count(), errorCount: await errorElement.count() }));
  const actionGroup = tab.playwright.locator('.sda-action-group').first();
  const collection = tab.playwright.locator('.sda-collection').first();
  const actionGroupSnapshot = await renderedSnapshot(actionGroup);
  const collectionSnapshot = await renderedSnapshot(collection);
  const observedViewport = await root.getAttribute("data-sda-viewport-profile", { timeoutMs: 10000 });
  observations.push(presentationObservation("responsive-adaptive", "application-adaptation", presentation.adaptation,
    actionGroupSnapshot.flexWrap === "wrap" && collectionSnapshot.overflowX === "auto" && observedViewport === contextId,
    { mechanism: "computed-layout", locator: '.sda-action-group,.sda-collection', viewportProfile: observedViewport, actionGroup: actionGroupSnapshot, collection: collectionSnapshot }));
  const firstInput = tab.playwright.locator('[data-sda-kind="input"]:is(input,textarea)').first();
  await firstInput.press("Tab", { timeoutMs: 10000 });
  const focusTarget = tab.playwright.locator('[data-sda-focus="prominent"]:focus').first();
  const focusEvidence = (await focusTarget.count()) === 1 ? await renderedSnapshot(focusTarget) : { outlineStyle: "none", outlineColor: "none" };
  observations.push(presentationObservation("focus", "application-focus", presentation.intent.focus,
    (await focusTarget.count()) === 1 && focusEvidence.outlineStyle !== "none",
    { mechanism: "native-focus", locator: '[data-sda-kind="action"]:not([disabled])', ...focusEvidence }));
  observations.push(presentationObservation("media", "application-media", presentation.intent.media,
    presentation.intent.media === "none-required" || (await tab.playwright.locator('[data-sda-kind="media"]').count()) > 0,
    { mechanism: "rendered-dom", locator: '[data-sda-kind="media"]', required: presentation.intent.media }));
  observations.push(presentationObservation("motion", "application-motion", presentation.intent.motion,
    await root.getAttribute("data-sda-motion", { timeoutMs: 10000 }) === presentation.intent.motion.stateChange &&
      await root.getAttribute("data-sda-reduced-motion", { timeoutMs: 10000 }) === presentation.intent.motion.reducedMotionBehavior,
    { mechanism: "rendered-dom+user-preference", locator: '[data-sda-ready="true"]', reducedMotion: context.reducedMotion }));
  const nativeCounts = await root.evaluate((element) => ({
    buttons: element.querySelectorAll("button").length,
    textEntries: element.querySelectorAll("input,textarea").length,
    collections: element.querySelectorAll('[data-sda-kind="collection"]').length,
    tables: element.querySelectorAll("table").length,
    structuredCollections: element.querySelectorAll('[data-sda-kind="collection"] article,[data-sda-kind="collection"] .sda-metrics').length
  }), undefined, { timeoutMs: 10000 });
  observations.push(presentationObservation("platform-adaptation", "application-native-embodiment", presentation.intent.platformAdaptation,
    nativeCounts.buttons === authority.interactionAuthority.actions.length && nativeCounts.textEntries === authority.interactionAuthority.inputs.length && nativeCounts.collections === authority.interactionAuthority.collections.length,
    { mechanism: "native-dom-roles+semantic-collection-surfaces", locator: 'button,input,textarea,[data-sda-kind="collection"]', ...nativeCounts }));
  for (const view of presentation.views) for (const region of view.regions) {
    const locator = tab.playwright.locator(`[data-sda-region-id="${attributeSelector(region.regionId)}"]`);
    observations.push(presentationObservation("grouping", region.regionId, region.layoutIntent,
      await locator.getAttribute("data-sda-grouping", { timeoutMs: 10000 }) === region.layoutIntent,
      { mechanism: "rendered-dom", locator: `[data-sda-region-id="${region.regionId}"]`, ...await renderedSnapshot(locator) }));
    observations.push(presentationObservation("surface", region.regionId, presentation.intent.surfaces.region,
      await locator.getAttribute("data-sda-surface", { timeoutMs: 10000 }) === presentation.intent.surfaces.region,
      { mechanism: "computed-style", locator: `[data-sda-region-id="${region.regionId}"]`, ...await renderedSnapshot(locator) }));
  }
  for (const action of authority.interactionAuthority.actions) {
    const locator = semanticLocator(tab, "action", action.actionId);
    const expected = presentation.intent.actionEmphasis[action.importance];
    observations.push(presentationObservation("action-emphasis", action.actionId, expected,
      await locator.getAttribute("data-sda-action-emphasis", { timeoutMs: 10000 }) === expected,
      { mechanism: "native-button+computed-style", locator: `[data-sda-kind="action"][data-sda-id="${action.actionId}"]`, ...await renderedSnapshot(locator) }));
  }
  for (const feedback of authority.interactionAuthority.feedback) {
    const locator = semanticLocator(tab, "feedback", feedback.feedbackId);
    const expected = presentation.intent.surfaces[feedback.feedbackIntent];
    observations.push(presentationObservation("surface", feedback.feedbackId, expected,
      await locator.getAttribute("data-sda-surface", { timeoutMs: 10000 }) === expected,
      { mechanism: "rendered-dom", locator: `[data-sda-kind="feedback"][data-sda-id="${feedback.feedbackId}"]`, ...await renderedSnapshot(locator) }));
  }
  for (const declaredCollection of authority.interactionAuthority.collections) {
    const locator = semanticLocator(tab, "collection", declaredCollection.collectionId);
    observations.push(presentationObservation("surface", declaredCollection.collectionId, presentation.intent.surfaces.collection,
      await locator.getAttribute("data-sda-surface", { timeoutMs: 10000 }) === presentation.intent.surfaces.collection,
      { mechanism: "native-table+computed-style", locator: `[data-sda-kind="collection"][data-sda-id="${declaredCollection.collectionId}"]`, ...await renderedSnapshot(locator) }));
  }
  return {
    presentationTestimonyType: "consumer-ui-presentation-testimony.v1",
    applicationId: authority.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    presentationProfileDigest: digest(presentation),
    renderContexts: [{ contextId, viewport: { width: context.width, height: context.height }, scale: context.scale, theme: context.theme, reducedMotion: context.reducedMotion }],
    observations,
    platformNativeDisposition: observations.every((observation) => observation.disposition === "OBSERVED") ? "PASS" : "FAIL"
  };
}

export async function runBrowserUiVectors(tab, options) {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const projected = path.join(workspaceRoot, "projected");
  const target = options.target;
  const applicationPath = options.applicationPath ?? `/${target}/`;
  const authority = readJson(path.join(projected, target, "authority", `ui-authority.${target}.json`));
  const identity = readJson(path.join(projected, "ui-parity", "authority-identity.json"));
  const vectors = readJson(path.join(projected, "ui-parity", "vectors.json"));
  const objectModel = readJson(path.join(projected, "ui-parity", "object-model.json"));
  const vectorResults = [];
  for (const vector of vectors.vectors) vectorResults.push(await applyVector(tab, options.origin, applicationPath, authority, vector));
  await tab.goto(`${options.origin}${applicationPath}`);
  await tab.playwright.locator('[data-sda-ready="true"]').waitFor({ state: "visible", timeoutMs: 15000 });
  const wiring = await observeWiring(tab, target, authority, identity);
  const presentation = await observePresentation(tab, target, authority, identity);
  const testimony = {
    testimonyType: "consumer-ui-testimony.v1",
    applicationId: authority.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    vectorCorpusDigest: digest(vectors),
    executableOrigin: "PROJECTED_ONLY",
    vectorResults
  };
  const structure = options.emitStructuralTestimony(objectModel, digest(objectModel));
  for (const [kind, evidence] of Object.entries({ testimony, wiring, presentation, structure })) {
    const response = await fetch(`${options.origin}/__sda/api/evidence/${target}/${kind}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(evidence)
    });
    if (!response.ok) throw new Error(`${target} UI ${kind} evidence could not be recorded.`);
  }
  return { testimony, wiring, presentation, structure };
}
