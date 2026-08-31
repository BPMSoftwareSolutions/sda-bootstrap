"use strict";
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const AUTHORITY_PATH = path.join(REPO_ROOT, "examples", "generic-capability", "ui.authority.json");
const FRAMEWORK_LEAK = /(?:wpf|xaml|react|javafx|swiftui|android|html|css|<div|textbox|datagrid|combobox|stackpanel|grid\.row|flex-row|icommand|viewmodel)/i;

function stringsAndKeys(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) stringsAndKeys(item, result);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      result.push(key);
      stringsAndKeys(item, result);
    }
  } else if (typeof value === "string") {
    result.push(value);
  }
  return result;
}

test("canonical UI authority is framework-neutral and topologically closed", () => {
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  assert.ok(authority.experienceAuthority);
  assert.ok(authority.interactionAuthority);
  assert.ok(authority.presentationProfile);
  assert.equal(stringsAndKeys(authority).filter((value) => FRAMEWORK_LEAK.test(value)).length, 0);

  const interaction = authority.interactionAuthority;
  const definitions = {
    information: new Set(interaction.information.map((item) => item.informationId)),
    input: new Set(interaction.inputs.map((item) => item.inputId)),
    action: new Set(interaction.actions.map((item) => item.actionId)),
    collection: new Set(interaction.collections.map((item) => item.collectionId)),
    feedback: new Set(interaction.feedback.map((item) => item.feedbackId))
  };
  const states = new Set(interaction.stateBindings.map((state) => state.stateId));
  const operations = new Set(interaction.operations.map((operation) => operation.operationId));
  const assertReference = (reference) => assert.ok(
    definitions[reference.semanticKind]?.has(reference.refId),
    `${reference.semanticKind}:${reference.refId}`
  );

  for (const view of interaction.views) for (const member of view.members) assertReference(member);
  for (const view of authority.presentationProfile.views) {
    assert.ok(interaction.views.some((candidate) => candidate.viewId === view.viewId));
    for (const region of view.regions) for (const item of region.items) assertReference(item);
  }
  for (const input of interaction.inputs) {
    assert.ok(states.has(input.stateId), input.inputId);
    if (input.commitOperationId) assert.ok(operations.has(input.commitOperationId), input.inputId);
    assert.ok(input.accessibility.name, input.inputId);
  }
  for (const action of interaction.actions) {
    assert.ok(operations.has(action.operationId), action.actionId);
    assert.ok(states.has(action.availability.stateId), action.actionId);
    assert.ok(action.accessibility.name, action.actionId);
  }
  for (const collection of interaction.collections) {
    assert.ok(states.has(collection.stateId), collection.collectionId);
    assert.ok(collection.accessibility.name, collection.collectionId);
  }
  for (const feedback of interaction.feedback) {
    assert.ok(states.has(feedback.stateId), feedback.feedbackId);
    assert.ok(feedback.accessibility.name, feedback.feedbackId);
  }
  for (const operation of interaction.operations) {
    for (const binding of operation.targetBindings ?? []) {
      assert.ok(states.has(binding.stateId), `${operation.operationId}:${binding.stateId}`);
      if (operation.kind === "execute-capability") assert.ok(binding.path, operation.operationId);
    }
  }
  for (const validation of interaction.validation) assert.ok(states.has(validation.stateId), validation.validationId);
  assert.ok(authority.experienceAuthority.conditions.length > 0);
});
