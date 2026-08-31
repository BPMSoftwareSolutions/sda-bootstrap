import fs from "node:fs";
import path from "node:path";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { canonicalDigest } from "../proof/canonical-ui-authority.js";
import { collectUiFeatureRequirements } from "../proof/ui-feature-admission.js";
const PROTOCOL_ROOT = "capabilities/sda-platform/ui-presentation-protocol";
const SOURCE_ADAPTER_ID = "consumer-ui-v1-to-presentation-ir-v2.v1";
function record(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`UI_PRESENTATION_SOURCE_INVALID: ${label}.`);
    return value;
}
function records(value) {
    return Array.isArray(value) ? value.map((item, index) => record(item, `array item ${index}`)) : [];
}
function accessibility(value) {
    const source = record(value, "accessibility");
    return Object.freeze({
        name: String(source.name ?? ""),
        ...(source.description === undefined ? {} : { description: String(source.description) }),
        live: String(source.live ?? "off")
    });
}
function eventId(kind, elementId) {
    return `event.${kind}.${String(elementId)}`;
}
function normalizeOperation(value) {
    const { operationId, kind, ...argumentsValue } = value;
    return Object.freeze({ operationId, kind, arguments: Object.freeze(structuredClone(argumentsValue)) });
}
function semanticEvents(interaction) {
    const actions = records(interaction.actions).map((action) => Object.freeze({
        eventId: eventId("action", action.actionId),
        eventType: "ui.action-invoked.v1",
        sourceElementId: action.actionId,
        operationId: action.operationId
    }));
    const commits = records(interaction.inputs).filter((input) => input.commitOperationId !== undefined).map((input) => Object.freeze({
        eventId: eventId("input", input.inputId),
        eventType: "ui.input-committed.v1",
        sourceElementId: input.inputId,
        operationId: input.commitOperationId
    }));
    return Object.freeze([...actions, ...commits].sort((left, right) => String(left.eventId).localeCompare(String(right.eventId))));
}
function statePatches(interaction) {
    const patches = [];
    for (const operation of records(interaction.operations)) {
        const assignments = [];
        if (operation.kind === "load-fixture" && operation.targetStateId !== undefined) {
            assignments.push({ stateId: operation.targetStateId, sourceKind: "fixture-value", sourcePath: operation.fixtureId });
        }
        for (const binding of records(operation.targetBindings)) {
            if (binding.path !== undefined)
                assignments.push({ stateId: binding.stateId, sourceKind: "outcome-path", sourcePath: binding.path });
            else if (binding.role !== undefined)
                assignments.push({ stateId: binding.stateId, sourceKind: "semantic-output-role", sourcePath: binding.role });
        }
        if (assignments.length > 0)
            patches.push(Object.freeze({
                patchId: `patch.${String(operation.operationId)}`,
                operationId: operation.operationId,
                mode: "replace",
                assignments: Object.freeze(assignments.map((assignment) => Object.freeze(assignment)))
            }));
    }
    return Object.freeze(patches.sort((left, right) => String(left.patchId).localeCompare(String(right.patchId))));
}
function normalizeInteraction(source) {
    const events = semanticEvents(source);
    return Object.freeze({
        startViewId: source.startViewId,
        stateBindings: Object.freeze(records(source.stateBindings).map((item) => Object.freeze({
            stateId: item.stateId, valueIntent: item.valueIntent, source: item.source,
            path: String(item.path ?? ""), initialValue: item.initialValue ?? ""
        }))),
        information: Object.freeze(records(source.information).map((item) => Object.freeze({
            informationId: item.informationId, content: item.content, importance: item.importance,
            accessibility: accessibility(item.accessibility)
        }))),
        inputs: Object.freeze(records(source.inputs).map((item) => Object.freeze({
            inputId: item.inputId, label: item.label, inputIntent: item.inputIntent, stateId: item.stateId,
            commitEventId: item.commitOperationId === undefined ? "" : eventId("input", item.inputId),
            acceptedFileTypes: Object.freeze(Array.isArray(item.acceptedFileTypes) ? structuredClone(item.acceptedFileTypes) : []),
            placeholder: String(item.placeholder ?? ""), accessibility: accessibility(item.accessibility)
        }))),
        actions: Object.freeze(records(source.actions).map((item) => Object.freeze({
            actionId: item.actionId, label: item.label, eventId: eventId("action", item.actionId),
            importance: item.importance, availability: Object.freeze(structuredClone(record(item.availability, "action availability"))),
            accessibility: accessibility(item.accessibility)
        }))),
        collections: Object.freeze(records(source.collections).map((item) => Object.freeze({
            collectionId: item.collectionId, label: item.label, stateId: item.stateId,
            presentationIntent: item.presentationIntent ?? "tabular",
            fields: Object.freeze(records(item.fields).map((field) => Object.freeze(structuredClone(field)))),
            accessibility: accessibility(item.accessibility)
        }))),
        feedback: Object.freeze(records(source.feedback).map((item) => Object.freeze({
            feedbackId: item.feedbackId, label: item.label, feedbackIntent: item.feedbackIntent,
            presentationIntent: item.presentationIntent ?? "plain", stateId: item.stateId,
            accessibility: accessibility(item.accessibility)
        }))),
        operations: Object.freeze(records(source.operations).map(normalizeOperation)),
        validation: Object.freeze(records(source.validation).map((item) => Object.freeze(structuredClone(item)))),
        navigation: Object.freeze(records(source.navigation).map((item) => Object.freeze(structuredClone(item)))),
        events,
        statePatches: statePatches(source)
    });
}
function normalizePresentation(source, interaction) {
    const interactionViews = new Map(records(interaction.views).map((view) => [String(view.viewId), view]));
    const adaptation = record(source.adaptation, "presentation adaptation");
    const intent = record(source.intent, "presentation intent");
    return Object.freeze({
        profileId: source.profileId,
        density: source.density,
        tokens: Object.freeze(structuredClone(record(source.tokens, "presentation tokens"))),
        intent: Object.freeze({ experiencePattern: intent.experiencePattern ?? "standard", ...structuredClone(intent) }),
        adaptation: Object.freeze({
            ...structuredClone(adaptation),
            compactRegionOrder: Object.freeze(Array.isArray(adaptation.compactRegionOrder) ? structuredClone(adaptation.compactRegionOrder) : []),
            standardRegionOrder: Object.freeze(Array.isArray(adaptation.standardRegionOrder) ? structuredClone(adaptation.standardRegionOrder) : []),
            wideRegionOrder: Object.freeze(Array.isArray(adaptation.wideRegionOrder) ? structuredClone(adaptation.wideRegionOrder) : [])
        }),
        views: Object.freeze(records(source.views).map((view) => Object.freeze({
            viewId: view.viewId,
            title: String(interactionViews.get(String(view.viewId))?.title ?? view.viewId),
            sizeIntent: view.sizeIntent,
            layoutIntent: view.layoutIntent,
            regions: Object.freeze(records(view.regions).map((region) => Object.freeze({
                regionId: region.regionId, title: region.title, layoutIntent: region.layoutIntent,
                role: region.role ?? "primary-content", importance: region.importance ?? "secondary",
                elements: Object.freeze(records(region.items).map((item) => Object.freeze(structuredClone(item))))
            })))
        })))
    });
}
export class UiPresentationCompiler {
    repositoryRoot;
    identity;
    constructor(repositoryRoot) {
        this.repositoryRoot = repositoryRoot;
        const identityPath = path.join(repositoryRoot, PROTOCOL_ROOT, "protocol.identity.json");
        this.identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
        const schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, this.identity.schemaRef), "utf8"));
        const policy = JSON.parse(fs.readFileSync(path.join(repositoryRoot, this.identity.compatibilityPolicyRef), "utf8"));
        if (canonicalDigest(schema) !== this.identity.schemaDigest)
            throw new Error("UI_PRESENTATION_PROTOCOL_SCHEMA_DIVERGENCE");
        if (canonicalDigest(policy) !== this.identity.compatibilityPolicyDigest)
            throw new Error("UI_PRESENTATION_COMPATIBILITY_POLICY_DIVERGENCE");
    }
    compile(authority) {
        const sourceAdmission = new AjvSchemaAdmission(path.join(this.repositoryRoot, "kernel", "schemas"))
            .validate(authority, "consumer-ui-authority.schema.json");
        if (!sourceAdmission.valid)
            throw new Error(`UI_PRESENTATION_SOURCE_NOT_ADMITTED: ${JSON.stringify(sourceAdmission.errors)}`);
        const interactionSource = record(authority.interactionAuthority, "interaction authority");
        const presentationSource = record(authority.presentationProfile, "presentation profile");
        const experienceSource = record(authority.experienceAuthority, "experience authority");
        const requiredFeatureIds = Object.freeze(collectUiFeatureRequirements(authority).map((item) => item.featureId));
        const sourceAuthorityDigest = canonicalDigest(authority);
        const ir = Object.freeze({
            presentationIrType: "sda-ui-presentation-ir.v2",
            protocol: Object.freeze({
                schemaDigest: this.identity.schemaDigest,
                compatibilityPolicyDigest: this.identity.compatibilityPolicyDigest
            }),
            source: Object.freeze({
                authorityType: "consumer-ui-authority.v1",
                authorityDigest: sourceAuthorityDigest,
                adapterId: SOURCE_ADAPTER_ID
            }),
            application: Object.freeze({
                applicationId: authority.applicationId,
                title: authority.title,
                experience: Object.freeze({
                    experienceId: experienceSource.experienceId,
                    actor: experienceSource.actor,
                    promise: experienceSource.promise,
                    conditions: Object.freeze(records(experienceSource.conditions).map((condition) => Object.freeze({
                        conditionId: condition.conditionId,
                        assertion: condition.statement
                    })))
                }),
                interaction: normalizeInteraction(interactionSource),
                presentation: normalizePresentation(presentationSource, interactionSource)
            }),
            requiredFeatureIds
        });
        const irAdmission = new AjvSchemaAdmission(path.join(this.repositoryRoot, PROTOCOL_ROOT, "contracts"))
            .validate(ir, "sda-ui-presentation-ir.v2.schema.json");
        if (!irAdmission.valid)
            throw new Error(`UI_PRESENTATION_IR_NOT_ADMITTED: ${JSON.stringify(irAdmission.errors)}`);
        const presentationIrDigest = canonicalDigest(ir);
        return Object.freeze({
            ir,
            evidence: Object.freeze({
                evidenceType: "sda-ui-presentation-compilation-evidence.v1",
                compilerId: "sda-ui-presentation-compiler.v2",
                sourceAuthorityType: "consumer-ui-authority.v1",
                sourceAuthorityDigest,
                presentationIrType: "sda-ui-presentation-ir.v2",
                protocolSchemaDigest: this.identity.schemaDigest,
                presentationIrDigest,
                requiredFeatureIds,
                disposition: "COMPILED"
            })
        });
    }
}
