#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { provisionCapability } from "./provision-capability.mjs";

/* @reveal-semantic-model/v2
{
  "schema": "reveal.semantic-model.v2",
  "capability": {
    "capabilityId": "manage-capsule-estate",
    "name": "Capsule Manager"
  },
  "features": [
    {
      "featureId": "operate-capsule-estate",
      "name": "Operate a capsule estate from its bootstrap authority",
      "scenarios": [
        {
          "scenarioId": "admit-capsule-manager-command",
          "input": {
            "dataType": "process-invocation",
            "fields": [
              { "name": "argv", "valueType": "string[]", "required": true },
              { "name": "stdin", "valueType": "string", "required": false },
              { "name": "environment", "valueType": "object", "required": true }
            ]
          },
          "event": {
            "eventId": "capsule-manager-command-received",
            "executionProjectionRef": "event-execution:admit-capsule-manager-command",
            "action": {
              "actionId": "admit-capsule-manager-command",
              "responsibility": "Admit one supported command and its command-specific operands."
            }
          },
          "outcome": {
            "outcomeId": "capsule-manager-command-admitted",
            "experience": "One capsule-estate operation is selected with its exact operands.",
            "product": {
              "dataType": "admitted-capsule-manager-command",
              "fields": [
                { "name": "command", "valueType": "CapsuleManagerCommand", "required": true },
                { "name": "operand", "valueType": "string", "required": false },
                { "name": "input", "valueType": "JSON", "required": false }
              ]
            },
            "variants": [
              { "variantId": "VERIFY", "terminal": false },
              { "variantId": "RESOLVE", "terminal": false },
              { "variantId": "LIST", "terminal": false },
              { "variantId": "INSPECT", "terminal": false },
              { "variantId": "DIRECT_OR_TEST", "terminal": false },
              { "variantId": "INVOKE", "terminal": false },
              { "variantId": "EXPAND", "terminal": false },
              { "variantId": "PROJECT", "terminal": false },
              { "variantId": "PROOF", "terminal": false },
              { "variantId": "STERILE_PROOF", "terminal": false },
              { "variantId": "MIGRATE_LEGACY", "terminal": false }
            ]
          },
          "routes": [
            { "routeId": "dispatch-verify", "targetScenarioId": "verify-capsule-estate", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-resolve", "targetScenarioId": "resolve-capsule-estate", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-list", "targetScenarioId": "list-capsules", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-inspect", "targetScenarioId": "inspect-capsule", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-direct", "targetScenarioId": "prove-direct-execution", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-invoke", "targetScenarioId": "invoke-capability", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-expand", "targetScenarioId": "expand-capsule-estate", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-project", "targetScenarioId": "project-capsule-estate", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-proof", "targetScenarioId": "prove-capsule-first", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-sterile-proof", "targetScenarioId": "run-sterile-proof", "semanticProgress": "BRANCHES" },
            { "routeId": "dispatch-migrate", "targetScenarioId": "migrate-legacy-estate", "semanticProgress": "BRANCHES" }
          ]
        },
        {
          "scenarioId": "verify-capsule-estate",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "environment"]
          },
          "event": {
            "eventId": "capsule-estate-verification-requested",
            "executionProjectionRef": "event-execution:verify-capsule-estate",
            "action": {
              "actionId": "verify-capsule-estate",
              "responsibility": "Verify capsule identity, encoded entries, runtime closure, and collapsed durable layout."
            }
          },
          "outcome": {
            "outcomeId": "capsule-estate-verification-available",
            "experience": "The operator knows the estate is internally consistent and durably collapsed.",
            "product": {
              "dataType": "capsule-estate-verification",
              "fields": [
                { "name": "capabilityCount", "valueType": "number", "required": true },
                { "name": "entryCount", "valueType": "number", "required": true },
                { "name": "expandedCapabilityRoot", "valueType": "ABSENT", "required": true }
              ]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "resolve-capsule-estate",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "environment"]
          },
          "event": {
            "eventId": "capsule-estate-resolution-requested",
            "executionProjectionRef": "event-execution:resolve-capsule-estate",
            "action": {
              "actionId": "resolve-capsule-estate",
              "responsibility": "Resolve declared capsule dependencies and external tool roots against present authority."
            }
          },
          "outcome": {
            "outcomeId": "capsule-estate-resolution-available",
            "experience": "The operator knows every declared dependency and tool root is present with the expected identity.",
            "product": {
              "dataType": "capsule-estate-resolution",
              "fields": ["declaredDependencies", "present", "toolRootsDeclared", "toolRootsPresent"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "list-capsules",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand?"]
          },
          "event": {
            "eventId": "capsule-list-requested",
            "executionProjectionRef": "event-execution:list-capsules",
            "action": {
              "actionId": "list-capsules",
              "responsibility": "Verify and list the capsules matching an optional capability query."
            }
          },
          "outcome": {
            "outcomeId": "capsule-list-available",
            "experience": "The operator can see the eligible capsules and their runtime eligibility.",
            "product": {
              "dataType": "capsule-list",
              "fields": [
                { "name": "capsules[]", "valueType": "CapsuleSummary[]", "required": true }
              ]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "inspect-capsule",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand"]
          },
          "event": {
            "eventId": "capsule-inspection-requested",
            "executionProjectionRef": "event-execution:inspect-capsule",
            "action": {
              "actionId": "inspect-capsule",
              "responsibility": "Verify, select, and describe one capsule without expanding it."
            }
          },
          "outcome": {
            "outcomeId": "capsule-inspection-available",
            "experience": "The operator can review one capsule's lineage, runtime binding, fixtures, and packed entries.",
            "product": {
              "dataType": "capsule-inspection",
              "fields": ["capabilityId", "lineage", "runtimeBindings[]", "fixtures[]", "entries[]"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "prove-direct-execution",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand?"]
          },
          "event": {
            "eventId": "direct-execution-proof-requested",
            "executionProjectionRef": "event-execution:prove-direct-execution",
            "action": {
              "actionId": "prove-direct-execution",
              "responsibility": "Reconstruct selected capsule runtimes in an owned temporary root and execute their fixtures."
            }
          },
          "outcome": {
            "outcomeId": "direct-execution-proof-available",
            "experience": "The operator has deterministic proof that selected capsules execute directly from packed authority.",
            "product": {
              "dataType": "direct-execution-proof",
              "fields": ["eligible", "reconstructedEntryCount", "fixtureCount", "tests", "passed", "failed", "broken"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "invoke-capability",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand", "input"]
          },
          "event": {
            "eventId": "capability-invocation-requested",
            "executionProjectionRef": "event-execution:invoke-capability",
            "action": {
              "actionId": "invoke-capability",
              "responsibility": "Reconstruct the admitted runtime estate and invoke one capability with canonical input."
            }
          },
          "outcome": {
            "outcomeId": "capability-invocation-completed",
            "experience": "The caller receives the selected capability's runtime result from capsule-carried authority.",
            "product": {
              "dataType": "capability-invocation-result",
              "fields": ["disposition", "outcome", "executions[]"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "expand-capsule-estate",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand"]
          },
          "event": {
            "eventId": "capsule-estate-expansion-requested",
            "executionProjectionRef": "event-execution:expand-capsule-estate",
            "action": {
              "actionId": "expand-capsule-estate",
              "responsibility": "Materialize packed entries into a non-durable target and verify the reconstructed capability count."
            }
          },
          "outcome": {
            "outcomeId": "capsule-estate-expansion-available",
            "experience": "The operator has a bounded expanded estate outside the durable repository.",
            "product": {
              "dataType": "capsule-estate-expansion",
              "fields": ["capabilityCount", "entryCount", "targetRoot"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "project-capsule-estate",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand"]
          },
          "event": {
            "eventId": "capsule-estate-projection-requested",
            "executionProjectionRef": "event-execution:project-capsule-estate",
            "action": {
              "actionId": "project-capsule-estate",
              "responsibility": "Project capabilities in dependency order into a non-durable target."
            }
          },
          "outcome": {
            "outcomeId": "capsule-estate-projection-available",
            "experience": "The operator has dependency-ordered projected capabilities with all failures accounted for.",
            "product": {
              "dataType": "capsule-estate-projection",
              "fields": ["eligible", "projected", "broken", "targetRoot"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "prove-capsule-first",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "environment"]
          },
          "event": {
            "eventId": "capsule-first-proof-requested",
            "executionProjectionRef": "event-execution:prove-capsule-first",
            "action": {
              "actionId": "prove-capsule-first",
              "responsibility": "Prove verification, resolution, direct execution, expansion, projection, and aggregate tests in an owned sterile checkout."
            }
          },
          "outcome": {
            "outcomeId": "capsule-first-proof-available",
            "experience": "The operator has one closed proof that capsule authority reconstructs and proves the estate.",
            "product": {
              "dataType": "capsule-first-proof",
              "fields": ["proofType", "capsuleCount", "capsuleEntryCount", "dependencies", "directExecution", "expansion", "projection", "proof", "broken"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "run-sterile-proof",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "environment"]
          },
          "event": {
            "eventId": "sterile-proof-run-requested",
            "executionProjectionRef": "event-execution:run-sterile-proof",
            "action": {
              "actionId": "run-sterile-proof",
              "responsibility": "Stage an owned sterile checkout, execute capsule-first proof there, and remove the stage."
            }
          },
          "outcome": {
            "outcomeId": "sterile-proof-run-completed",
            "experience": "The operator knows a checkout reconstructed from bootstrap roots and capsules is green.",
            "product": {
              "dataType": "sterile-proof-result",
              "fields": ["sterileRoot", "status"]
            },
            "variants": []
          },
          "routes": []
        },
        {
          "scenarioId": "migrate-legacy-estate",
          "input": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "environment"]
          },
          "event": {
            "eventId": "legacy-estate-migration-requested",
            "executionProjectionRef": "event-execution:migrate-legacy-estate",
            "action": {
              "actionId": "migrate-legacy-estate",
              "responsibility": "Adopt legacy packs, close missing runtime entries, and write the capsule-estate manifest."
            }
          },
          "outcome": {
            "outcomeId": "legacy-estate-migration-completed",
            "experience": "The operator has a runtime-closed capsule estate and its governing manifest.",
            "product": {
              "dataType": "legacy-estate-migration-result",
              "fields": ["capabilityCount", "adoptedRuntimeClosedCount", "capsuleRoot", "estateManifestPath"]
            },
            "variants": []
          },
          "routes": []
        }
      ]
    }
  ],
  "eventExecutionProjections": [
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:admit-capsule-manager-command",
      "eventId": "capsule-manager-command-received",
      "actionId": "admit-capsule-manager-command",
      "parentScenarioId": "admit-capsule-manager-command",
      "input": { "dataType": "process-invocation" },
      "result": { "dataType": "admitted-capsule-manager-command" },
      "rootCellId": "execution-cell:parse-capsule-manager-command",
      "cells": [
        {
          "cellId": "execution-cell:parse-capsule-manager-command",
          "input": { "dataType": "process-invocation", "fields": ["argv", "stdin?", "environment"] },
          "responsibility": {
            "responsibilityId": "parse-capsule-manager-command",
            "statement": "Parse the command name and required operands from the process invocation."
          },
          "result": {
            "dataType": "admitted-capsule-manager-command",
            "fields": ["command", "operand?", "input?"],
            "variants": ["VERIFY", "RESOLVE", "LIST", "INSPECT", "DIRECT_OR_TEST", "INVOKE", "EXPAND", "PROJECT", "PROOF", "STERILE_PROOF", "MIGRATE_LEGACY"]
          },
          "providerProjectionRefs": []
        }
      ],
      "routes": []
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:verify-capsule-estate",
      "eventId": "capsule-estate-verification-requested",
      "actionId": "verify-capsule-estate",
      "parentScenarioId": "verify-capsule-estate",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-estate-verification" },
      "rootCellId": "execution-cell:verify-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:verify-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command", "fields": ["command", "environment"] },
          "responsibility": { "responsibilityId": "load-capsule-estate", "statement": "Load the admitted estate manifest and exact capsule bytes." },
          "result": { "dataType": "loaded-capsule-estate", "fields": ["manifest", "records[]"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:verify-read-estate"]
        },
        {
          "cellId": "execution-cell:verify-validate-estate",
          "input": { "dataType": "loaded-capsule-estate", "fields": ["manifest", "records[]"] },
          "responsibility": { "responsibilityId": "validate-capsule-estate", "statement": "Validate capsule identity, entry bytes, authority digests, and runtime closure." },
          "result": { "dataType": "verified-capsule-estate", "fields": ["capabilityCount", "entryCount"], "variants": [] },
          "mechanicProjectionRef": "mechanic-circuit:verify-capsule-record",
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:verify-assert-collapsed-layout",
          "input": { "dataType": "verified-capsule-estate", "fields": ["capabilityCount", "entryCount"] },
          "responsibility": { "responsibilityId": "assert-collapsed-durable-layout", "statement": "Require the durable repository to contain no expanded capability root." },
          "result": { "dataType": "capsule-estate-verification", "fields": ["capabilityCount", "entryCount", "expandedCapabilityRoot"], "variants": [] },
          "providerProjectionRefs": []
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:verify-load-estate", "toCellId": "execution-cell:verify-validate-estate", "product": "loaded-capsule-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:verify-validate-estate", "toCellId": "execution-cell:verify-assert-collapsed-layout", "product": "verified-capsule-estate", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:resolve-capsule-estate",
      "eventId": "capsule-estate-resolution-requested",
      "actionId": "resolve-capsule-estate",
      "parentScenarioId": "resolve-capsule-estate",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-estate-resolution" },
      "rootCellId": "execution-cell:resolve-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:resolve-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-resolution-estate", "statement": "Load the capsule estate to be resolved." },
          "result": { "dataType": "loaded-resolution-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:resolve-bindings-and-tools",
          "input": { "dataType": "loaded-resolution-estate" },
          "responsibility": { "responsibilityId": "resolve-bindings-and-tool-roots", "statement": "Resolve internal and external bindings plus declared tool roots." },
          "result": { "dataType": "capsule-estate-resolution", "fields": ["declaredDependencies", "present", "toolRootsDeclared", "toolRootsPresent"], "variants": [] },
          "providerProjectionRefs": []
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:resolve-load-estate", "toCellId": "execution-cell:resolve-bindings-and-tools", "product": "loaded-resolution-estate", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:list-capsules",
      "eventId": "capsule-list-requested",
      "actionId": "list-capsules",
      "parentScenarioId": "list-capsules",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-list" },
      "rootCellId": "execution-cell:list-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:list-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-listing-estate", "statement": "Load the capsule estate and optional query." },
          "result": { "dataType": "loaded-listing-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:list-verify-filter-project",
          "input": { "dataType": "loaded-listing-estate" },
          "responsibility": { "responsibilityId": "verify-filter-and-project-capsules", "statement": "Verify the estate, filter capability identities, and project capsule summaries." },
          "result": { "dataType": "capsule-list", "fields": ["capsules[]"], "variants": [] },
          "providerProjectionRefs": []
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:list-load-estate", "toCellId": "execution-cell:list-verify-filter-project", "product": "loaded-listing-estate", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:inspect-capsule",
      "eventId": "capsule-inspection-requested",
      "actionId": "inspect-capsule",
      "parentScenarioId": "inspect-capsule",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-inspection" },
      "rootCellId": "execution-cell:inspect-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:inspect-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-inspection-estate", "statement": "Load the capsule estate and requested capability identity." },
          "result": { "dataType": "loaded-inspection-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:inspect-verify-select",
          "input": { "dataType": "loaded-inspection-estate" },
          "responsibility": { "responsibilityId": "verify-and-select-capsule", "statement": "Verify the estate and select the exact requested capsule." },
          "result": { "dataType": "selected-capsule", "fields": ["record", "capsule"], "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:inspect-project-description",
          "input": { "dataType": "selected-capsule", "fields": ["record", "capsule"] },
          "responsibility": { "responsibilityId": "project-capsule-description", "statement": "Project lineage, bindings, fixtures, and entry identities without expansion." },
          "result": { "dataType": "capsule-inspection", "fields": ["lineage", "runtimeBindings[]", "fixtures[]", "entries[]"], "variants": [] },
          "providerProjectionRefs": []
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:inspect-load-estate", "toCellId": "execution-cell:inspect-verify-select", "product": "loaded-inspection-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:inspect-verify-select", "toCellId": "execution-cell:inspect-project-description", "product": "selected-capsule", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:prove-direct-execution",
      "eventId": "direct-execution-proof-requested",
      "actionId": "prove-direct-execution",
      "parentScenarioId": "prove-direct-execution",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "direct-execution-proof" },
      "rootCellId": "execution-cell:direct-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:direct-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-direct-execution-estate", "statement": "Load the estate and optional capability selection." },
          "result": { "dataType": "loaded-direct-execution-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:direct-verify-estate",
          "input": { "dataType": "loaded-direct-execution-estate" },
          "responsibility": { "responsibilityId": "verify-direct-execution-estate", "statement": "Verify the capsule estate before reconstructing executable applications." },
          "result": { "dataType": "verified-direct-execution-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:direct-reconstruct-runtime",
          "input": { "dataType": "verified-direct-execution-estate" },
          "responsibility": { "responsibilityId": "reconstruct-selected-runtimes", "statement": "Materialize packed entries and selected runtime applications in an owned temporary root." },
          "result": { "dataType": "reconstructed-runtime-estate", "fields": ["applications[]", "reconstructedEntryCount"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:direct-write-runtime"]
        },
        {
          "cellId": "execution-cell:direct-run-fixtures",
          "input": { "dataType": "reconstructed-runtime-estate", "fields": ["applications[]", "reconstructedEntryCount"] },
          "responsibility": { "responsibilityId": "execute-selected-runtime-fixtures", "statement": "Execute the aggregate runtime tests and reconcile their exact counts." },
          "result": { "dataType": "direct-execution-proof", "fields": ["eligible", "fixtureCount", "tests", "passed", "failed", "broken"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:direct-execute-tests"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:direct-load-estate", "toCellId": "execution-cell:direct-verify-estate", "product": "loaded-direct-execution-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:direct-verify-estate", "toCellId": "execution-cell:direct-reconstruct-runtime", "product": "verified-direct-execution-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:direct-reconstruct-runtime", "toCellId": "execution-cell:direct-run-fixtures", "product": "reconstructed-runtime-estate", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:invoke-capability",
      "eventId": "capability-invocation-requested",
      "actionId": "invoke-capability",
      "parentScenarioId": "invoke-capability",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capability-invocation-result" },
      "rootCellId": "execution-cell:invoke-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:invoke-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-invocation-estate", "statement": "Load the estate, selected capability identity, and canonical input." },
          "result": { "dataType": "loaded-invocation-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:invoke-verify-resolve-select",
          "input": { "dataType": "loaded-invocation-estate" },
          "responsibility": { "responsibilityId": "verify-resolve-and-select-capability", "statement": "Verify the estate, resolve dependencies, and select the requested capsule." },
          "result": { "dataType": "resolved-capability-invocation", "fields": ["capabilityId", "input", "estate"], "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:invoke-reconstruct-runtime",
          "input": { "dataType": "resolved-capability-invocation", "fields": ["capabilityId", "input", "estate"] },
          "responsibility": { "responsibilityId": "reconstruct-invocation-runtime", "statement": "Materialize the runtime estate and selected application binding in an owned temporary root." },
          "result": { "dataType": "executable-capability-invocation", "fields": ["bindingUrl", "input"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:invoke-write-runtime"]
        },
        {
          "cellId": "execution-cell:invoke-execute-capability",
          "input": { "dataType": "executable-capability-invocation", "fields": ["bindingUrl", "input"] },
          "responsibility": { "responsibilityId": "execute-capability-invocation", "statement": "Load the admitted runtime and execute the selected capability input." },
          "result": { "dataType": "capability-invocation-result", "fields": ["disposition", "outcome", "executions[]"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:invoke-load-and-execute-module"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:invoke-load-estate", "toCellId": "execution-cell:invoke-verify-resolve-select", "product": "loaded-invocation-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:invoke-verify-resolve-select", "toCellId": "execution-cell:invoke-reconstruct-runtime", "product": "resolved-capability-invocation", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:invoke-reconstruct-runtime", "toCellId": "execution-cell:invoke-execute-capability", "product": "executable-capability-invocation", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:expand-capsule-estate",
      "eventId": "capsule-estate-expansion-requested",
      "actionId": "expand-capsule-estate",
      "parentScenarioId": "expand-capsule-estate",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-estate-expansion" },
      "rootCellId": "execution-cell:expand-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:expand-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-expansion-estate", "statement": "Load the estate and require a non-durable expansion target." },
          "result": { "dataType": "bounded-expansion-request", "fields": ["estate", "targetRoot"], "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:expand-materialize-entries",
          "input": { "dataType": "bounded-expansion-request", "fields": ["estate", "targetRoot"] },
          "responsibility": { "responsibilityId": "materialize-and-verify-expansion", "statement": "Write collision-safe capsule entries and reconcile the expanded capability count." },
          "result": { "dataType": "capsule-estate-expansion", "fields": ["capabilityCount", "entryCount", "targetRoot"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:expand-write-entries"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:expand-load-estate", "toCellId": "execution-cell:expand-materialize-entries", "product": "bounded-expansion-request", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:project-capsule-estate",
      "eventId": "capsule-estate-projection-requested",
      "actionId": "project-capsule-estate",
      "parentScenarioId": "project-capsule-estate",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-estate-projection" },
      "rootCellId": "execution-cell:project-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:project-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-projection-estate", "statement": "Load the estate and require a non-durable projection target." },
          "result": { "dataType": "bounded-projection-request", "fields": ["estate", "targetRoot"], "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:project-order-capabilities",
          "input": { "dataType": "bounded-projection-request", "fields": ["estate", "targetRoot"] },
          "responsibility": { "responsibilityId": "order-capabilities-by-dependency", "statement": "Resolve a complete deterministic topological capability order." },
          "result": { "dataType": "ordered-projection-request", "fields": ["capabilityIds[]", "targetRoot"], "variants": [] },
          "mechanicProjectionRef": "mechanic-circuit:topological-capability-order",
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:project-capabilities",
          "input": { "dataType": "ordered-projection-request", "fields": ["capabilityIds[]", "targetRoot"] },
          "responsibility": { "responsibilityId": "project-ordered-capabilities", "statement": "Invoke the platform projector for every capability and account for all findings." },
          "result": { "dataType": "capsule-estate-projection", "fields": ["eligible", "projected", "broken", "targetRoot"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:project-load-and-execute-module"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:project-load-estate", "toCellId": "execution-cell:project-order-capabilities", "product": "bounded-projection-request", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:project-order-capabilities", "toCellId": "execution-cell:project-capabilities", "product": "ordered-projection-request", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:prove-capsule-first",
      "eventId": "capsule-first-proof-requested",
      "actionId": "prove-capsule-first",
      "parentScenarioId": "prove-capsule-first",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "capsule-first-proof" },
      "rootCellId": "execution-cell:proof-load-estate",
      "cells": [
        {
          "cellId": "execution-cell:proof-load-estate",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "load-owned-sterile-estate", "statement": "Require the owned sterile-root marker and load the capsule estate." },
          "result": { "dataType": "loaded-sterile-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:proof-verify-resolve",
          "input": { "dataType": "loaded-sterile-estate" },
          "responsibility": { "responsibilityId": "verify-and-resolve-sterile-estate", "statement": "Verify capsule closure and resolve every dependency before reconstruction." },
          "result": { "dataType": "resolved-sterile-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:proof-direct-execution",
          "input": { "dataType": "resolved-sterile-estate" },
          "responsibility": { "responsibilityId": "prove-packed-direct-execution", "statement": "Materialize shared authority and prove direct execution from packed runtime entries." },
          "result": { "dataType": "directly-proven-sterile-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:proof-expand-project",
          "input": { "dataType": "directly-proven-sterile-estate" },
          "responsibility": { "responsibilityId": "expand-and-project-sterile-estate", "statement": "Expand the estate and project every capability in dependency order." },
          "result": { "dataType": "projected-sterile-estate", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:proof-aggregate-tests",
          "input": { "dataType": "projected-sterile-estate" },
          "responsibility": { "responsibilityId": "aggregate-capsule-first-proof", "statement": "Run the selected pretest and aggregate suites and assemble one closed proof." },
          "result": { "dataType": "capsule-first-proof", "fields": ["proofType", "capsuleCount", "directExecution", "projection", "proof", "broken"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:proof-execute-tests"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:proof-load-estate", "toCellId": "execution-cell:proof-verify-resolve", "product": "loaded-sterile-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:proof-verify-resolve", "toCellId": "execution-cell:proof-direct-execution", "product": "resolved-sterile-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:proof-direct-execution", "toCellId": "execution-cell:proof-expand-project", "product": "directly-proven-sterile-estate", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:proof-expand-project", "toCellId": "execution-cell:proof-aggregate-tests", "product": "projected-sterile-estate", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:run-sterile-proof",
      "eventId": "sterile-proof-run-requested",
      "actionId": "run-sterile-proof",
      "parentScenarioId": "run-sterile-proof",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "sterile-proof-result" },
      "rootCellId": "execution-cell:sterile-assert-collapsed",
      "cells": [
        {
          "cellId": "execution-cell:sterile-assert-collapsed",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "assert-collapsed-source-repository", "statement": "Require the source repository to contain no expanded capability root." },
          "result": { "dataType": "sterile-stage-request", "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:sterile-stage-checkout",
          "input": { "dataType": "sterile-stage-request" },
          "responsibility": { "responsibilityId": "stage-owned-sterile-checkout", "statement": "Create an owned sterile root and copy only bootstrap roots and capsule authority." },
          "result": { "dataType": "staged-sterile-checkout", "fields": ["sterileRoot", "marker"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:sterile-write-stage"]
        },
        {
          "cellId": "execution-cell:sterile-execute-proof",
          "input": { "dataType": "staged-sterile-checkout", "fields": ["sterileRoot", "marker"] },
          "responsibility": { "responsibilityId": "execute-sterile-child-proof", "statement": "Run the capsule-first proof command inside the staged checkout." },
          "result": { "dataType": "completed-sterile-child-proof", "fields": ["sterileRoot", "childStatus"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:sterile-execute-child"]
        },
        {
          "cellId": "execution-cell:sterile-remove-stage",
          "input": { "dataType": "completed-sterile-child-proof", "fields": ["sterileRoot", "childStatus"] },
          "responsibility": { "responsibilityId": "remove-owned-sterile-checkout", "statement": "Validate the ownership marker and remove the sterile stage." },
          "result": { "dataType": "sterile-proof-result", "fields": ["sterileRoot", "status"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:sterile-remove-stage"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:sterile-assert-collapsed", "toCellId": "execution-cell:sterile-stage-checkout", "product": "sterile-stage-request", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:sterile-stage-checkout", "toCellId": "execution-cell:sterile-execute-proof", "product": "staged-sterile-checkout", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:sterile-execute-proof", "toCellId": "execution-cell:sterile-remove-stage", "product": "completed-sterile-child-proof", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "eventExecutionProjectionType": "event-execution-projection.v1",
      "projectionId": "event-execution:migrate-legacy-estate",
      "eventId": "legacy-estate-migration-requested",
      "actionId": "migrate-legacy-estate",
      "parentScenarioId": "migrate-legacy-estate",
      "input": { "dataType": "admitted-capsule-manager-command" },
      "result": { "dataType": "legacy-estate-migration-result" },
      "rootCellId": "execution-cell:migrate-discover-legacy-capsules",
      "cells": [
        {
          "cellId": "execution-cell:migrate-discover-legacy-capsules",
          "input": { "dataType": "admitted-capsule-manager-command" },
          "responsibility": { "responsibilityId": "discover-legacy-capsules", "statement": "Read legacy capsule packs and proof selections from the source repository." },
          "result": { "dataType": "legacy-capsule-set", "fields": ["capsules[]", "proofSelection"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:migrate-read-legacy-estate"]
        },
        {
          "cellId": "execution-cell:migrate-close-runtime-bindings",
          "input": { "dataType": "legacy-capsule-set", "fields": ["capsules[]", "proofSelection"] },
          "responsibility": { "responsibilityId": "close-legacy-runtime-bindings", "statement": "Adopt already-closed packs and add missing runtime binding entries to the rest." },
          "result": { "dataType": "runtime-closed-capsule-set", "fields": ["capsules[]", "adoptedRuntimeClosedCount"], "variants": [] },
          "providerProjectionRefs": []
        },
        {
          "cellId": "execution-cell:migrate-publish-estate",
          "input": { "dataType": "runtime-closed-capsule-set", "fields": ["capsules[]", "adoptedRuntimeClosedCount"] },
          "responsibility": { "responsibilityId": "write-capsules-and-estate-manifest", "statement": "Atomically write runtime-closed packs and the resulting estate manifest." },
          "result": { "dataType": "legacy-estate-migration-result", "fields": ["capabilityCount", "adoptedRuntimeClosedCount", "capsuleRoot", "estateManifestPath"], "variants": [] },
          "providerProjectionRefs": ["provider-circuit:migrate-write-estate"]
        }
      ],
      "routes": [
        { "fromCellId": "execution-cell:migrate-discover-legacy-capsules", "toCellId": "execution-cell:migrate-close-runtime-bindings", "product": "legacy-capsule-set", "semanticProgress": "NARROWS" },
        { "fromCellId": "execution-cell:migrate-close-runtime-bindings", "toCellId": "execution-cell:migrate-publish-estate", "product": "runtime-closed-capsule-set", "semanticProgress": "NARROWS" }
      ]
    }
  ],
  "mechanicCircuits": [
    {
      "mechanicProjectionType": "mechanic-circuit.v1",
      "projectionId": "mechanic-circuit:verify-capsule-record",
      "parentExecutionCellId": "execution-cell:verify-validate-estate",
      "rootCellId": "mechanic-cell:verify-capsule-identity",
      "cells": [
        {
          "cellId": "mechanic-cell:verify-capsule-identity",
          "input": { "dataType": "unverified-capsule-record" },
          "mechanic": { "mechanicId": "verify-unique-capsule-identity" },
          "result": { "dataType": "identity-verified-capsule-record", "variants": [] }
        },
        {
          "cellId": "mechanic-cell:verify-packed-entries",
          "input": { "dataType": "identity-verified-capsule-record" },
          "mechanic": { "mechanicId": "verify-safe-canonical-entry-bytes" },
          "result": { "dataType": "entry-verified-capsule-record", "variants": [] }
        },
        {
          "cellId": "mechanic-cell:verify-runtime-closure",
          "input": { "dataType": "entry-verified-capsule-record" },
          "mechanic": { "mechanicId": "verify-authority-and-runtime-closure" },
          "result": { "dataType": "verified-capsule-record", "variants": [] }
        }
      ],
      "routes": [
        { "fromCellId": "mechanic-cell:verify-capsule-identity", "toCellId": "mechanic-cell:verify-packed-entries", "product": "identity-verified-capsule-record", "semanticProgress": "NARROWS" },
        { "fromCellId": "mechanic-cell:verify-packed-entries", "toCellId": "mechanic-cell:verify-runtime-closure", "product": "entry-verified-capsule-record", "semanticProgress": "NARROWS" }
      ]
    },
    {
      "mechanicProjectionType": "mechanic-circuit.v1",
      "projectionId": "mechanic-circuit:topological-capability-order",
      "parentExecutionCellId": "execution-cell:project-order-capabilities",
      "rootCellId": "mechanic-cell:index-capability-dependencies",
      "cells": [
        {
          "cellId": "mechanic-cell:index-capability-dependencies",
          "input": { "dataType": "unordered-capability-set" },
          "mechanic": { "mechanicId": "index-indegree-and-dependents" },
          "result": { "dataType": "indexed-capability-dependency-graph", "variants": [] }
        },
        {
          "cellId": "mechanic-cell:drain-ready-capabilities",
          "input": { "dataType": "indexed-capability-dependency-graph" },
          "mechanic": { "mechanicId": "drain-sorted-zero-indegree-capabilities" },
          "result": { "dataType": "candidate-topological-order", "variants": [] }
        },
        {
          "cellId": "mechanic-cell:verify-complete-order",
          "input": { "dataType": "candidate-topological-order" },
          "mechanic": { "mechanicId": "reject-dependency-cycle" },
          "result": { "dataType": "complete-topological-order", "variants": [] }
        }
      ],
      "routes": [
        { "fromCellId": "mechanic-cell:index-capability-dependencies", "toCellId": "mechanic-cell:drain-ready-capabilities", "product": "indexed-capability-dependency-graph", "semanticProgress": "NARROWS" },
        { "fromCellId": "mechanic-cell:drain-ready-capabilities", "toCellId": "mechanic-cell:verify-complete-order", "product": "candidate-topological-order", "semanticProgress": "NARROWS" }
      ]
    }
  ],
  "providerCircuits": [
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:verify-read-estate",
      "parentExecutionCellId": "execution-cell:verify-load-estate",
      "rootCellId": "provider-cell:verify-read-estate-files",
      "cells": [
        {
          "cellId": "provider-cell:verify-read-estate-files",
          "physicalInput": { "dataType": "estate-path-set", "fields": ["manifestPath", "capsulePaths[]"] },
          "nativeOperation": { "operationId": "read-estate-files", "boundary": "filesystem", "effect": "READS" },
          "physicalResult": { "dataType": "estate-file-bytes", "fields": ["manifestBytes", "capsuleBytes[]"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:direct-write-runtime",
      "parentExecutionCellId": "execution-cell:direct-reconstruct-runtime",
      "rootCellId": "provider-cell:direct-write-runtime-files",
      "cells": [
        {
          "cellId": "provider-cell:direct-write-runtime-files",
          "physicalInput": { "dataType": "packed-runtime-entry-bytes", "fields": ["targetRoot", "entries[]"] },
          "nativeOperation": { "operationId": "write-runtime-files", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "materialized-runtime-files", "fields": ["paths[]"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:direct-execute-tests",
      "parentExecutionCellId": "execution-cell:direct-run-fixtures",
      "rootCellId": "provider-cell:direct-spawn-node-tests",
      "cells": [
        {
          "cellId": "provider-cell:direct-spawn-node-tests",
          "physicalInput": { "dataType": "node-test-request", "fields": ["cwd", "testRefs[]"] },
          "nativeOperation": { "operationId": "spawn-node-tests", "boundary": "process", "effect": "EXECUTES" },
          "physicalResult": { "dataType": "node-test-output", "fields": ["status", "stdout", "stderr"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:invoke-write-runtime",
      "parentExecutionCellId": "execution-cell:invoke-reconstruct-runtime",
      "rootCellId": "provider-cell:invoke-write-runtime-files",
      "cells": [
        {
          "cellId": "provider-cell:invoke-write-runtime-files",
          "physicalInput": { "dataType": "invocation-runtime-entry-bytes", "fields": ["targetRoot", "entries[]"] },
          "nativeOperation": { "operationId": "write-invocation-runtime", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "invocation-runtime-files", "fields": ["bindingPath"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:invoke-load-and-execute-module",
      "parentExecutionCellId": "execution-cell:invoke-execute-capability",
      "rootCellId": "provider-cell:invoke-import-runtime",
      "cells": [
        {
          "cellId": "provider-cell:invoke-import-runtime",
          "physicalInput": { "dataType": "runtime-module-url", "fields": ["runtimeUrl", "bindingUrl"] },
          "nativeOperation": { "operationId": "import-and-execute-runtime", "boundary": "module-loader", "effect": "EXECUTES" },
          "physicalResult": { "dataType": "runtime-execution-result", "fields": ["result"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:expand-write-entries",
      "parentExecutionCellId": "execution-cell:expand-materialize-entries",
      "rootCellId": "provider-cell:expand-write-entry-files",
      "cells": [
        {
          "cellId": "provider-cell:expand-write-entry-files",
          "physicalInput": { "dataType": "verified-entry-byte-set", "fields": ["targetRoot", "entries[]"] },
          "nativeOperation": { "operationId": "write-expanded-entries", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "expanded-entry-files", "fields": ["paths[]"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:project-load-and-execute-module",
      "parentExecutionCellId": "execution-cell:project-capabilities",
      "rootCellId": "provider-cell:project-import-projector",
      "cells": [
        {
          "cellId": "provider-cell:project-import-projector",
          "physicalInput": { "dataType": "projector-module-request", "fields": ["projectorUrl", "capabilityRoots[]"] },
          "nativeOperation": { "operationId": "import-and-execute-projector", "boundary": "module-loader", "effect": "EXECUTES" },
          "physicalResult": { "dataType": "projection-execution-results", "fields": ["projected", "failures[]"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:proof-execute-tests",
      "parentExecutionCellId": "execution-cell:proof-aggregate-tests",
      "rootCellId": "provider-cell:proof-spawn-node-tests",
      "cells": [
        {
          "cellId": "provider-cell:proof-spawn-node-tests",
          "physicalInput": { "dataType": "aggregate-node-test-request", "fields": ["cwd", "pretestRefs[]", "aggregateRefs[]"] },
          "nativeOperation": { "operationId": "spawn-proof-tests", "boundary": "process", "effect": "EXECUTES" },
          "physicalResult": { "dataType": "aggregate-node-test-output", "fields": ["pretest", "aggregate"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:sterile-write-stage",
      "parentExecutionCellId": "execution-cell:sterile-stage-checkout",
      "rootCellId": "provider-cell:sterile-copy-bootstrap-roots",
      "cells": [
        {
          "cellId": "provider-cell:sterile-copy-bootstrap-roots",
          "physicalInput": { "dataType": "sterile-copy-request", "fields": ["sourceRoots[]", "sterileRoot"] },
          "nativeOperation": { "operationId": "copy-sterile-bootstrap-roots", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "staged-bootstrap-roots", "fields": ["sterileRoot", "marker"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:sterile-execute-child",
      "parentExecutionCellId": "execution-cell:sterile-execute-proof",
      "rootCellId": "provider-cell:sterile-spawn-child-proof",
      "cells": [
        {
          "cellId": "provider-cell:sterile-spawn-child-proof",
          "physicalInput": { "dataType": "sterile-child-process-request", "fields": ["entryPath", "cwd", "environment"] },
          "nativeOperation": { "operationId": "spawn-sterile-proof", "boundary": "process", "effect": "EXECUTES" },
          "physicalResult": { "dataType": "sterile-child-process-result", "fields": ["status", "stdout", "stderr"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:sterile-remove-stage",
      "parentExecutionCellId": "execution-cell:sterile-remove-stage",
      "rootCellId": "provider-cell:sterile-remove-owned-root",
      "cells": [
        {
          "cellId": "provider-cell:sterile-remove-owned-root",
          "physicalInput": { "dataType": "owned-sterile-root", "fields": ["root", "marker"] },
          "nativeOperation": { "operationId": "remove-owned-sterile-root", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "removed-sterile-root", "fields": ["root", "removed"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:migrate-read-legacy-estate",
      "parentExecutionCellId": "execution-cell:migrate-discover-legacy-capsules",
      "rootCellId": "provider-cell:migrate-read-legacy-files",
      "cells": [
        {
          "cellId": "provider-cell:migrate-read-legacy-files",
          "physicalInput": { "dataType": "legacy-estate-path-set", "fields": ["legacyRoot", "packageJsonPath"] },
          "nativeOperation": { "operationId": "read-legacy-estate-files", "boundary": "filesystem", "effect": "READS" },
          "physicalResult": { "dataType": "legacy-estate-file-bytes", "fields": ["capsuleBytes[]", "packageJsonBytes"] }
        }
      ],
      "routes": []
    },
    {
      "providerCircuitType": "provider-circuit.v1",
      "projectionId": "provider-circuit:migrate-write-estate",
      "parentExecutionCellId": "execution-cell:migrate-publish-estate",
      "rootCellId": "provider-cell:migrate-write-capsules-and-manifest",
      "cells": [
        {
          "cellId": "provider-cell:migrate-write-capsules-and-manifest",
          "physicalInput": { "dataType": "runtime-closed-estate-bytes", "fields": ["capsules[]", "manifest"] },
          "nativeOperation": { "operationId": "write-capsules-and-manifest", "boundary": "filesystem", "effect": "WRITES" },
          "physicalResult": { "dataType": "written-capsule-estate", "fields": ["capsuleRoot", "estateManifestPath"] }
        }
      ],
      "routes": []
    }
  ]
}
*/

const bootstrapEntryPath = fileURLToPath(import.meta.url);
const bootstrapRoot = path.dirname(bootstrapEntryPath);
const installedPackageRoot = path.resolve(bootstrapRoot, "..");
const repositoryRoot = path.resolve(process.env.CAPSULE_SOURCE_REPOSITORY_ROOT || process.cwd());
const capsuleEstateRef = "capsules/capsule-estate.manifest.json";
const capsuleRoot = path.resolve(repositoryRoot, "capsules");
const estateManifestPath = path.resolve(repositoryRoot, capsuleEstateRef);
const runtimeEntryRoot = "capsule-runtime/";
const ephemeralCapabilityRoot = "capabilities";
const platformRuntimeModuleRef = "languages/typescript/runtimes/node/admitted-consumer-platform.mjs";
const platformProjectorModuleRef = "artifacts/tools/dist/interfaces/consumer-projection/project.js";
const externalBindings = [
  {
    bindingRef: "package:sda-bootstrap/platform/capabilities/sda-platform/bind-os-environment-credential/projected/application-binding.node.json",
    projectedRootRef: "capabilities/sda-platform/bind-os-environment-credential/projected"
  },
  {
    bindingRef: "package:sda-bootstrap/platform/capabilities/sda-tooling/projected-tools/decide-tooling-migration/projected/application-binding.node.json",
    projectedRootRef: "capabilities/sda-tooling/projected-tools/decide-tooling-migration/projected"
  }
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalDigest(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), "utf8"));
}

function normalizedRef(reference) {
  return String(reference).replaceAll("\\", "/");
}

function safeEntryRef(reference) {
  const normalized = normalizedRef(reference);
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;
  return !normalized.split("/").some((part) => part === "" || part === "." || part === "..");
}

function entryBytes(entry) {
  const bytes = Buffer.from(entry.entryBytesBase64, "base64");
  if (bytes.toString("base64") !== entry.entryBytesBase64) {
    throw new Error(`CAPSULE_ENTRY_BASE64_NOT_CANONICAL: '${entry.entryRef}'.`);
  }
  if (sha256(bytes) !== entry.entryDigest) throw new Error(`CAPSULE_ENTRY_DIGEST_DIVERGED: '${entry.entryRef}'.`);
  return bytes;
}

function entryMap(capsule) {
  return new Map(capsule.entries.map((entry) => [normalizedRef(entry.entryRef), entry]));
}

function capabilityIdFromBindingRef(bindingRef) {
  const parts = normalizedRef(bindingRef).split("/");
  const projected = parts.lastIndexOf("projected");
  return projected > 0 ? parts[projected - 1] : null;
}

function loadEstate() {
  const manifest = readJson(estateManifestPath);
  if (manifest.estateManifestType !== "sidefx-capsule-estate-manifest.v1") throw new Error("CAPSULE_ESTATE_MANIFEST_NOT_ADMITTED");
  if (manifest.capabilityCount !== manifest.capsules?.length) throw new Error("CAPSULE_ESTATE_COUNT_DIVERGED");
  const records = manifest.capsules.map((record) => {
    const file = path.resolve(capsuleRoot, record.file);
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) !== record.capsuleDigest) throw new Error(`CAPSULE_FILE_DIGEST_DIVERGED: '${record.capabilityId}'.`);
    const capsule = JSON.parse(bytes.toString("utf8"));
    if (capsule.capabilityId !== record.capabilityId) throw new Error(`CAPSULE_IDENTITY_DIVERGED: '${record.capabilityId}'.`);
    return { record, file, bytes, capsule };
  });
  return { manifest, records };
}

function capsuleRecord(estate, capabilityId) {
  const item = estate.records.find(({ capsule }) => capsule.capabilityId === capabilityId);
  if (!item) throw new Error(`CAPSULE_NOT_FOUND: '${capabilityId}'.`);
  return item;
}

function capsuleFixtures(capsule) {
  const entries = entryMap(capsule);
  const runtime = capsule.runtimeBindings[0];
  return JSON.parse(entryBytes(entries.get(normalizedRef(runtime.fixturesEntryRef))).toString("utf8"));
}

function listCapsules(estate = loadEstate(), query = null) {
  verifyEstate(estate);
  const normalizedQuery = query?.trim().toLowerCase() || null;
  return estate.records
    .filter(({ capsule }) => !normalizedQuery || capsule.capabilityId.toLowerCase().includes(normalizedQuery))
    .map(({ record, capsule }) => ({
      capabilityId: capsule.capabilityId,
      capabilityVersion: capsule.capabilityVersion,
      capsuleDigest: record.capsuleDigest,
      capabilityAuthorityDigest: record.capabilityAuthorityDigest,
      target: capsule.runtimeBindings[0].target,
      directExecutionEligibility: capsule.runtimeBindings[0].directExecutionEligibility,
      fixtureCount: capsuleFixtures(capsule).fixtures?.length ?? 0
    }));
}

function inspectCapsule(capabilityId, estate = loadEstate()) {
  verifyEstate(estate);
  const { record, capsule } = capsuleRecord(estate, capabilityId);
  const fixtures = capsuleFixtures(capsule).fixtures ?? [];
  return {
    capsuleFormat: capsule.capsuleFormat,
    capsuleFormatVersion: capsule.capsuleFormatVersion,
    capabilityId: capsule.capabilityId,
    capabilityVersion: capsule.capabilityVersion,
    capsuleDigest: record.capsuleDigest,
    capabilityAuthorityDigest: record.capabilityAuthorityDigest,
    lineage: capsule.lineage,
    packing: capsule.packing,
    declaredDependencies: capsule.declaredDependencies ?? [],
    externalToolRoots: capsule.externalToolRoots ?? [],
    runtimeBindings: capsule.runtimeBindings,
    fixtures: fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      expectedDisposition: fixture.expected?.disposition,
      expectedScenarioSequence: fixture.expected?.scenarioSequence ?? []
    })),
    entries: capsule.entries.map(({ entryId, entryRef, entryDigest }) => ({ entryId, entryRef, entryDigest }))
  };
}

function verifyEstate(estate = loadEstate()) {
  const ids = new Set();
  let entryCount = 0;
  for (const { record, capsule } of estate.records) {
    if (ids.has(capsule.capabilityId)) throw new Error(`CAPSULE_IDENTITY_DUPLICATED: '${capsule.capabilityId}'.`);
    ids.add(capsule.capabilityId);
    if (capsule.capsuleFormat !== "sidefx-capsule-pack.v1" || !Array.isArray(capsule.entries) || capsule.entries.length === 0) {
      throw new Error(`CAPSULE_FORMAT_NOT_ADMITTED: '${capsule.capabilityId}'.`);
    }
    const refs = new Set();
    for (const entry of capsule.entries) {
      const reference = normalizedRef(entry.entryRef);
      if (!safeEntryRef(reference)) throw new Error(`CAPSULE_ENTRY_REFERENCE_REJECTED: '${reference}'.`);
      if (refs.has(reference)) throw new Error(`CAPSULE_ENTRY_REFERENCE_DUPLICATED: '${reference}'.`);
      refs.add(reference);
      entryBytes(entry);
      entryCount++;
    }
    const entries = entryMap(capsule);
    const authority = capsule.entries.find((entry) => entry.entryId === "capability.authority.json");
    if (!authority || authority.entryDigest !== record.capabilityAuthorityDigest) {
      throw new Error(`CAPSULE_AUTHORITY_DIGEST_DIVERGED: '${capsule.capabilityId}'.`);
    }
    if (!Array.isArray(capsule.runtimeBindings) || capsule.runtimeBindings.length !== 1) {
      throw new Error(`CAPSULE_RUNTIME_BINDING_REQUIRED: '${capsule.capabilityId}'.`);
    }
    const runtime = capsule.runtimeBindings[0];
    for (const key of ["bindingEntryRef", "planEntryRef", "fixturesEntryRef", "sterilityEntryRef"]) {
      if (!entries.has(normalizedRef(runtime[key]))) throw new Error(`CAPSULE_RUNTIME_ENTRY_MISSING: '${capsule.capabilityId}.${key}'.`);
    }
    const binding = JSON.parse(entryBytes(entries.get(normalizedRef(runtime.bindingEntryRef))).toString("utf8"));
    const planEntry = entries.get(normalizedRef(runtime.planEntryRef));
    if (binding.executionPlanDigest !== planEntry.entryDigest) {
      throw new Error(`CAPSULE_RUNTIME_PLAN_DIGEST_DIVERGED: '${capsule.capabilityId}'.`);
    }
  }
  return { capabilityCount: ids.size, entryCount };
}

function resolveEstate(estate = loadEstate()) {
  const byId = new Map(estate.records.map((item) => [item.capsule.capabilityId, item]));
  const platformRoot = resolvePlatformRoot();
  let declaredDependencies = 0;
  let present = 0;
  let toolRootsDeclared = 0;
  let toolRootsPresent = 0;
  for (const { capsule } of estate.records) {
    for (const dependency of capsule.declaredDependencies ?? []) {
      declaredDependencies++;
      const targetId = capabilityIdFromBindingRef(dependency.bindingRef);
      const target = byId.get(targetId);
      if (target) {
        const runtime = target.capsule.runtimeBindings[0];
        const targetEntries = entryMap(target.capsule);
        const binding = JSON.parse(entryBytes(targetEntries.get(normalizedRef(runtime.bindingEntryRef))).toString("utf8"));
        const plan = JSON.parse(entryBytes(targetEntries.get(normalizedRef(runtime.planEntryRef))).toString("utf8"));
        const authorityDigest = plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
          ? plan.canonicalGraph.authority.authorityDigest
          : plan.source.capabilityAuthorityDigest;
        if (authorityDigest !== dependency.capabilityAuthorityDigest) throw new Error(`DEPENDENCY_AUTHORITY_WRONG_DIGEST: '${capsule.capabilityId}' -> '${targetId}'.`);
        if (canonicalDigest(binding) !== dependency.bindingDigest) throw new Error(`DEPENDENCY_BINDING_WRONG_DIGEST: '${capsule.capabilityId}' -> '${targetId}'.`);
        present++;
        continue;
      }
      const external = externalBindings.find((item) => normalizedRef(item.bindingRef) === normalizedRef(dependency.bindingRef));
      if (!external) throw new Error(`DEPENDENCY_MISSING: '${capsule.capabilityId}' -> '${dependency.bindingRef}'.`);
      const binding = readJson(path.resolve(platformRoot, external.projectedRootRef, "application-binding.node.json"));
      if (canonicalDigest(binding) !== dependency.bindingDigest) throw new Error(`DEPENDENCY_BINDING_WRONG_DIGEST: '${capsule.capabilityId}' -> '${targetId}'.`);
      present++;
    }
    for (const root of capsule.externalToolRoots ?? []) {
      toolRootsDeclared++;
      const url = new URL(root.toolRootRef);
      if (url.protocol !== "file:" || !fs.existsSync(fileURLToPath(url))) throw new Error(`EXTERNAL_TOOL_ROOT_MISSING: '${root.toolRootRef}'.`);
      toolRootsPresent++;
    }
  }
  return { declaredDependencies, present, toolRootsDeclared, toolRootsPresent };
}

function resolvePlatformRoot() {
  const override = process.env.SIDEFX_PLATFORM_ROOT;
  const root = override ? path.resolve(repositoryRoot, override) : path.resolve(installedPackageRoot, "platform");
  if (!override) {
    const relative = path.relative(installedPackageRoot, root);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`SIDEFX_PACKAGE_PLATFORM_ROOT_ESCAPES_PACKAGE: '${root}'.`);
    }
  }
  if (!fs.existsSync(root)) throw new Error(`SIDEFX_PLATFORM_ROOT_MISSING: '${root}'.`);
  return root;
}

function usesInstalledPackagePlatform() {
  return !process.env.SIDEFX_PLATFORM_ROOT;
}

function createExecutionWorkspace(kind) {
  if (!usesInstalledPackagePlatform()) {
    const targetRoot = fs.mkdtempSync(path.join(path.dirname(repositoryRoot), `agentic-harness-${kind}-`));
    return { targetRoot, cleanupRoot: targetRoot, platformRoot: resolvePlatformRoot() };
  }
  const cleanupRoot = fs.mkdtempSync(path.join(os.tmpdir(), `sda-bootstrap-${kind}-`));
  const targetRoot = path.join(cleanupRoot, "agentic-harness");
  const platformRoot = resolvePlatformRoot();
  const portableSiblingRoot = path.join(cleanupRoot, "scenario-driven-architecture");
  fs.mkdirSync(targetRoot, { recursive: true });
  copyTree(platformRoot, portableSiblingRoot);
  return { targetRoot, cleanupRoot, platformRoot };
}

function removeExecutionWorkspace(workspace, markerName) {
  const marker = path.join(workspace.targetRoot, markerName);
  if (!fs.existsSync(marker)) return;
  if (readJson(marker).root !== workspace.targetRoot) {
    throw new Error(`EXECUTION_WORKSPACE_MARKER_DIVERGED: '${marker}'.`);
  }
  fs.rmSync(workspace.cleanupRoot, { recursive: true, force: true });
}

function materializeEntries(estate, targetRoot, predicate) {
  const written = new Map();
  for (const { capsule } of estate.records) {
    for (const entry of capsule.entries) {
      const reference = normalizedRef(entry.entryRef);
      if (reference.startsWith(runtimeEntryRoot) || !predicate(reference)) continue;
      if (!safeEntryRef(reference)) throw new Error(`CAPSULE_ENTRY_REFERENCE_REJECTED: '${reference}'.`);
      const bytes = entryBytes(entry);
      const destination = path.resolve(targetRoot, ...reference.split("/"));
      if (!(destination + path.sep).startsWith(path.resolve(targetRoot) + path.sep)) throw new Error(`CAPSULE_ENTRY_ESCAPES_TARGET: '${reference}'.`);
      const prior = written.get(reference);
      if (prior && prior !== entry.entryDigest) throw new Error(`CAPSULE_ENTRY_COLLISION: '${reference}'.`);
      written.set(reference, entry.entryDigest);
      if (fs.existsSync(destination)) {
        if (sha256(fs.readFileSync(destination)) !== entry.entryDigest) throw new Error(`CAPSULE_ENTRY_EXISTING_BYTES_DIVERGED: '${reference}'.`);
        continue;
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    }
  }
  return written.size;
}

function materializeSharedAuthority(estate, targetRoot) {
  return materializeEntries(estate, targetRoot, (reference) => !reference.startsWith("capabilities/"));
}

function materializeCapsuleEstate(estate, targetRoot) {
  const manifestRef = normalizedRef(capsuleEstateRef);
  if (!safeEntryRef(manifestRef)) throw new Error(`CAPSULE_ESTATE_REFERENCE_REJECTED: '${manifestRef}'.`);
  const targetEstateManifestPath = path.resolve(targetRoot, ...manifestRef.split("/"));
  const targetCapsuleRoot = path.dirname(targetEstateManifestPath);
  fs.mkdirSync(targetCapsuleRoot, { recursive: true });
  fs.writeFileSync(targetEstateManifestPath, fs.readFileSync(estateManifestPath));
  for (const { record, bytes } of estate.records) {
    const capsuleRef = normalizedRef(record.file);
    if (!safeEntryRef(capsuleRef)) throw new Error(`CAPSULE_FILE_REFERENCE_REJECTED: '${capsuleRef}'.`);
    const destination = path.resolve(targetCapsuleRoot, ...capsuleRef.split("/"));
    if (!(destination + path.sep).startsWith(targetCapsuleRoot + path.sep)) {
      throw new Error(`CAPSULE_FILE_ESCAPES_TARGET: '${capsuleRef}'.`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  return estate.records.length;
}

function expandEstate(estate, targetRoot) {
  const entryCount = materializeEntries(estate, targetRoot, () => true);
  const capabilityRoot = path.join(targetRoot, ephemeralCapabilityRoot);
  const capabilities = fs.readdirSync(capabilityRoot).filter((item) => fs.existsSync(path.join(capabilityRoot, item, "capability.authority.json")));
  if (capabilities.length !== estate.manifest.capabilityCount) throw new Error(`EXPANSION_COUNT_DIVERGED: '${capabilities.length}'.`);
  return { capabilityCount: capabilities.length, entryCount };
}

function topologicalCapabilityIds(estate) {
  const ids = new Set(estate.records.map(({ capsule }) => capsule.capabilityId));
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const dependents = new Map([...ids].map((id) => [id, []]));
  for (const { capsule } of estate.records) {
    for (const dependency of capsule.declaredDependencies ?? []) {
      const target = capabilityIdFromBindingRef(dependency.bindingRef);
      if (!ids.has(target)) continue;
      indegree.set(capsule.capabilityId, indegree.get(capsule.capabilityId) + 1);
      dependents.get(target).push(capsule.capabilityId);
    }
  }
  const ready = [...indegree].filter(([, count]) => count === 0).map(([id]) => id).sort();
  const order = [];
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    for (const dependent of dependents.get(id).sort()) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (order.length !== ids.size) throw new Error("CAPSULE_DEPENDENCY_CYCLE");
  return order;
}

async function loadExternalApplication(platformMechanics, platformRoot, external, applications, externalApplications) {
  const projectedRoot = path.resolve(platformRoot, external.projectedRootRef);
  return loadApplicationFiles(platformMechanics, projectedRoot, (reference) =>
    applications.get(capabilityIdFromBindingRef(reference)) || externalApplications.get(normalizedRef(reference))
  );
}

function loadApplicationFiles(platformMechanics, projectedRoot, resolver) {
  const bindingPath = path.join(projectedRoot, "application-binding.node.json");
  const binding = readJson(bindingPath);
  return platformMechanics.admitInMemoryApplication({
    binding,
    plan: readJson(path.resolve(projectedRoot, binding.executionPlan)),
    fixtures: readJson(path.resolve(projectedRoot, binding.fixtures)),
    mechanicalSterility: readJson(path.resolve(projectedRoot, binding.mechanicalSterility)),
    bindingUrl: pathToFileURL(bindingPath).href,
    resolveBinding: resolver
  });
}

function valueAt(value, reference) {
  return String(reference).split(".").filter(Boolean).reduce((current, part) => current?.[part], value);
}

function assertFixture(result, application, fixture) {
  if (result.disposition !== fixture.expected.disposition) throw new Error(result.errorCode ?? `FIXTURE_DISPOSITION_DIVERGED: '${fixture.fixtureId}'.`);
  const observed = result.executions.map((item) => item.scenarioId);
  const expected = fixture.expected.scenarioSequence;
  if (application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3" && expected.length === 1) {
    if (observed[0] !== expected[0]) throw new Error(`FIXTURE_SCENARIO_DIVERGED: '${fixture.fixtureId}'.`);
  } else if (JSON.stringify(observed) !== JSON.stringify(expected)) throw new Error(`FIXTURE_SEQUENCE_DIVERGED: '${fixture.fixtureId}'.`);
  for (const assertion of fixture.expected.outcomeAssertions ?? []) {
    const actual = valueAt(result.outcome, assertion.path);
    if (assertion.operator === "equals" && JSON.stringify(actual) !== JSON.stringify(assertion.value)) throw new Error(`FIXTURE_ASSERTION_DIVERGED: '${fixture.fixtureId}.${assertion.path}'.`);
    if (assertion.operator === "contains" && !actual.includes(assertion.value)) throw new Error(`FIXTURE_ASSERTION_DIVERGED: '${fixture.fixtureId}.${assertion.path}'.`);
    if (assertion.operator === "not-contains" && actual.includes(assertion.value)) throw new Error(`FIXTURE_ASSERTION_DIVERGED: '${fixture.fixtureId}.${assertion.path}'.`);
  }
}

function materializeRuntimeApplication(capsule, targetRoot, runtimeModuleUrl, options = {}) {
  const entries = entryMap(capsule);
  const runtime = capsule.runtimeBindings[0];
  const bytesFor = (reference) => entryBytes(entries.get(normalizedRef(reference)));
  const bindingBytes = bytesFor(runtime.bindingEntryRef);
  const binding = JSON.parse(bindingBytes.toString("utf8"));
  const projectedRoot = path.join(targetRoot, "capabilities", capsule.capabilityId, "projected");
  const destinations = [
    [path.join(projectedRoot, "application-binding.node.json"), bindingBytes],
    [path.resolve(projectedRoot, binding.executionPlan), bytesFor(runtime.planEntryRef)],
    [path.resolve(projectedRoot, binding.fixtures), bytesFor(runtime.fixturesEntryRef)],
    [path.resolve(projectedRoot, binding.mechanicalSterility), bytesFor(runtime.sterilityEntryRef)]
  ];
  for (const [destination, bytes] of destinations) {
    if (!(destination + path.sep).startsWith(projectedRoot + path.sep)) {
      throw new Error(`CAPSULE_RUNTIME_ENTRY_ESCAPES_PROJECTED_ROOT: '${capsule.capabilityId}'.`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  const testRef = options.writeTest === false
    ? null
    : path.join(
      "capabilities",
      capsule.capabilityId,
      "projected",
      "node",
      options.testFileName ?? "capsule-runtime.test.mjs"
    );
  if (testRef) {
    const testPath = path.join(targetRoot, testRef);
    fs.mkdirSync(path.dirname(testPath), { recursive: true });
    fs.writeFileSync(testPath, `import bind from ${JSON.stringify(runtimeModuleUrl)};\nbind.tests(import.meta.url, "../application-binding.node.json");\n`, "utf8");
  }
  const fixtures = JSON.parse(bytesFor(runtime.fixturesEntryRef).toString("utf8"));
  return { capabilityId: capsule.capabilityId, testRef: testRef ? normalizedRef(testRef) : null, fixtureCount: fixtures.fixtures?.length ?? 0 };
}

async function invokeCapability(capabilityId, input, estate = loadEstate()) {
  verifyEstate(estate);
  resolveEstate(estate);
  capsuleRecord(estate, capabilityId);
  const workspace = createExecutionWorkspace("capsule-invoke");
  const { targetRoot, platformRoot } = workspace;
  const runtimeUrl = pathToFileURL(path.resolve(platformRoot, platformRuntimeModuleRef)).href;
  const marker = path.join(targetRoot, ".capsule-invoke-root.json");
  fs.writeFileSync(marker, JSON.stringify({ root: targetRoot }), "utf8");
  try {
    materializeEntries(estate, targetRoot, () => true);
    materializeCapsuleEstate(estate, targetRoot);
    const invokeOverlayRoot = process.env.CAPSULE_INVOKE_OVERLAY_ROOT;
    const replacementIds = new Set((process.env.CAPSULE_INVOKE_REPLACEMENT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean));
    for (const replacementId of replacementIds) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(replacementId)) throw new Error(`CAPSULE_INVOKE_REPLACEMENT_ID_INVALID: '${replacementId}'.`);
      const capabilityTarget = path.join(targetRoot, "capabilities", replacementId);
      const featureTarget = path.join(targetRoot, "features", `${replacementId}.feature`);
      if (fs.existsSync(capabilityTarget)) fs.rmSync(capabilityTarget, { recursive: true, force: true });
      if (fs.existsSync(featureTarget)) fs.rmSync(featureTarget, { force: true });
    }
    if (invokeOverlayRoot) {
      const resolvedOverlayRoot = fs.realpathSync(path.resolve(invokeOverlayRoot));
      if (!fs.statSync(resolvedOverlayRoot).isDirectory()) throw new Error(`CAPSULE_INVOKE_OVERLAY_ROOT_INVALID: '${resolvedOverlayRoot}'.`);
      fs.cpSync(resolvedOverlayRoot, targetRoot, { recursive: true, force: false, errorOnExist: true });
    }
    for (const { capsule } of estate.records) {
      if (!replacementIds.has(capsule.capabilityId)) materializeRuntimeApplication(capsule, targetRoot, runtimeUrl, { writeTest: false });
    }
    const runtime = await import(runtimeUrl);
    const bindingPath = path.join(targetRoot, "capabilities", capabilityId, "projected", "application-binding.node.json");
    const execute = runtime.default(pathToFileURL(bindingPath).href, "./application-binding.node.json");
    return await execute(input);
  } finally {
    removeExecutionWorkspace(workspace, ".capsule-invoke-root.json");
  }
}

async function proveDirectExecution(estate, selectedIds = null) {
  const workspace = createExecutionWorkspace("capsule-runtime");
  const { targetRoot, platformRoot } = workspace;
  const runtimeUrl = pathToFileURL(path.resolve(platformRoot, platformRuntimeModuleRef)).href;
  const marker = path.join(targetRoot, ".capsule-runtime-root.json");
  fs.writeFileSync(marker, JSON.stringify({ root: targetRoot }), "utf8");
  try {
    const reconstructedEntryCount = materializeEntries(estate, targetRoot, () => true);
    const applications = estate.records
      .map(({ capsule }) => materializeRuntimeApplication(capsule, targetRoot, runtimeUrl));
    const selectedApplications = selectedIds
      ? applications.filter((application) => selectedIds.has(application.capabilityId))
      : applications;
    if (selectedIds && selectedApplications.length !== selectedIds.size) {
      throw new Error(`DIRECT_EXECUTION_SELECTION_MISSING: '${[...selectedIds].filter((id) => !selectedApplications.some((application) => application.capabilityId === id)).join(",")}'.`);
    }
    const aggregateRef = "capsule-runtime-estate.test.mjs";
    fs.writeFileSync(
      path.join(targetRoot, aggregateRef),
      selectedApplications.map(({ testRef }) => `import ${JSON.stringify(`./${testRef}`)};`).join("\n") + "\n",
      "utf8"
    );
    const summary = runNodeTests(targetRoot, [aggregateRef], false);
    const fixtureCount = selectedApplications.reduce((sum, application) => sum + application.fixtureCount, 0);
    const expectedTests = fixtureCount + selectedApplications.length;
    if (summary.tests !== expectedTests || summary.failed !== 0) {
      throw new Error(`DIRECT_EXECUTION_COUNT_DIVERGED: expected '${expectedTests}' observed '${JSON.stringify(summary)}'.`);
    }
    return { eligible: selectedApplications.length, reconstructedEntryCount, fixtureCount, ...summary, broken: 0 };
  } finally {
    removeExecutionWorkspace(workspace, ".capsule-runtime-root.json");
  }
}

async function projectEstate(estate, targetRoot) {
  const platformRoot = resolvePlatformRoot();
  const runtimeUrl = pathToFileURL(path.resolve(platformRoot, platformRuntimeModuleRef)).href;
  const projectorUrl = pathToFileURL(path.resolve(platformRoot, platformProjectorModuleRef)).href;
  const { projectConsumerCapability } = await import(projectorUrl);
  const capsulesById = new Map(estate.records.map(({ capsule }) => [capsule.capabilityId, capsule]));
  let projected = 0;
  let reused = 0;
  const failures = [];
  for (const id of topologicalCapabilityIds(estate)) {
    try {
      await projectConsumerCapability(path.join(targetRoot, "capabilities", id), {
        repositoryRoot: platformRoot,
        projectionTargets: ["node"]
      });
      projected++;
      if (projected % 20 === 0 || projected === estate.records.length) process.stderr.write(`PROJECT ${projected}/${estate.records.length}\n`);
    } catch (error) {
      const finding = error instanceof Error ? error.message : String(error);
      const runtimeProjectionIsAuthoritative = finding.startsWith("Canonical consumer graph composition did not close:")
        || finding.startsWith("Missing consumer workspace authority:");
      if (runtimeProjectionIsAuthoritative) {
        materializeRuntimeApplication(capsulesById.get(id), targetRoot, runtimeUrl, {
          testFileName: "capability.projected.test.mjs"
        });
        projected++;
        reused++;
        if (projected % 20 === 0 || projected === estate.records.length) process.stderr.write(`PROJECT ${projected}/${estate.records.length}\n`);
      } else {
        failures.push({ capabilityId: id, finding });
      }
    }
  }
  if (failures.length) throw new Error(`PROJECTION_BROKEN: ${JSON.stringify(failures)}`);
  return { eligible: estate.records.length, projected, reused, broken: failures.length };
}

function parseNodeTestSummary(output) {
  const number = (label) => Number(output.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1] ?? -1);
  return { tests: number("tests"), passed: number("pass"), failed: number("fail"), skipped: number("skipped"), todo: number("todo") };
}

function runNodeTests(targetRoot, references, emit = true) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", ...references], {
    cwd: targetRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: childEnvironment
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (emit) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  const summary = parseNodeTestSummary(output);
  if (result.status !== 0 || summary.tests === -1) {
    const reportPath = path.join(bootstrapRoot, "capsule-runtime-tests.tap");
    fs.writeFileSync(reportPath, output, "utf8");
    const failedTests = output.split(/\r?\n/).filter((line) => /^not ok \d+ - /.test(line)).map((line) => line.replace(/^not ok \d+ - /, ""));
    const diagnostic = output.slice(-4000);
    throw new Error(`AGGREGATE_TEST_FAILED: exit '${result.status}', summary '${JSON.stringify(summary)}', failures '${JSON.stringify(failedTests)}', report '${reportPath}', diagnostic '${diagnostic}'.`);
  }
  return summary;
}

async function aggregateProof(estate) {
  const selection = estate.manifest.proofSelection;
  const pretest = await proveDirectExecution(estate, new Set(selection.pretestCapabilityIds));
  const aggregate = await proveDirectExecution(estate, new Set(selection.aggregateCapabilityIds));
  if (pretest.tests !== selection.expectedPretestCount || pretest.failed !== 0) throw new Error(`PRETEST_COUNT_DIVERGED: '${JSON.stringify(pretest)}'.`);
  if (aggregate.tests !== selection.expectedAggregateCount || aggregate.failed !== 0) throw new Error(`AGGREGATE_COUNT_DIVERGED: '${JSON.stringify(aggregate)}'.`);
  return { pretest, aggregate };
}

function copyTree(source, target) {
  if (!fs.existsSync(source)) throw new Error(`BOOTSTRAP_ROOT_MISSING: '${source}'.`);
  fs.cpSync(source, target, { recursive: true, force: false, errorOnExist: false, filter: (item) => !item.includes(`${path.sep}.git${path.sep}`) });
}

function assertOwnedSterileRoot(root, cleanupRoot) {
  const legacyRoot = cleanupRoot === root && path.basename(root).startsWith("agentic-harness-sterile-");
  const packagedRoot = path.dirname(root) === cleanupRoot
    && path.basename(cleanupRoot).startsWith("sda-bootstrap-sterile-")
    && path.basename(root) === "agentic-harness";
  if (!legacyRoot && !packagedRoot) {
    throw new Error(`STERILE_ROOT_NOT_OWNED: '${root}'.`);
  }
}

async function proveCapsuleFirst() {
  const sterileMarker = path.join(repositoryRoot, ".capsule-first-sterile-root.json");
  if (!fs.existsSync(sterileMarker) || readJson(sterileMarker).root !== repositoryRoot) {
    throw new Error("CAPSULE_PROOF_REQUIRES_OWNED_STERILE_ROOT");
  }
  const estate = loadEstate();
  const verify = verifyEstate(estate);
  const resolve = resolveEstate(estate);
  if (fs.existsSync(path.join(repositoryRoot, "capabilities"))) throw new Error("STERILE_PROOF_REQUIRES_NO_EXPANDED_CAPABILITY_ROOT");
  const sharedAuthorityEntries = materializeSharedAuthority(estate, repositoryRoot);
  const directExecution = await proveDirectExecution(estate);
  const expansion = expandEstate(estate, repositoryRoot);
  const projection = await projectEstate(estate, repositoryRoot);
  const proof = await aggregateProof(estate);
  return {
    proofType: "capsule-first-sterile-checkout-proof.v1",
    capsuleCount: verify.capabilityCount,
    capsuleEntryCount: verify.entryCount,
    dependencies: resolve,
    sharedAuthorityEntries,
    directExecution,
    expansion,
    projection,
    proof,
    broken: 0
  };
}

function migrateLegacyEstate() {
  const legacyRoot = path.join(repositoryRoot, "capabilities", "manage-capability-capsule", "projected", "capsules");
  if (!fs.existsSync(legacyRoot)) throw new Error("LEGACY_CAPSULE_ESTATE_MISSING");
  fs.mkdirSync(capsuleRoot, { recursive: true });
  const packageJson = readJson(path.join(repositoryRoot, "package.json"));
  const capabilityIdsFromScript = (script) => [...script.matchAll(/capabilities\/([^/]+)\/projected\/node\/capability\.projected\.test\.mjs/g)].map((match) => match[1]);
  const repositoryTestRefs = [...packageJson.scripts.test.matchAll(/(?:^|\s)(authority\/[^\s]+\.test\.mjs)/g)].map((match) => match[1]);
  const files = fs.readdirSync(legacyRoot).filter((file) => file.endsWith(".sfxcap") && file !== "capsule-boundary-probe.sfxcap").sort();
  const records = [];
  let adoptedRuntimeClosedCount = 0;
  for (const file of files) {
    const sourcePath = path.join(legacyRoot, file);
    const sourceBytes = fs.readFileSync(sourcePath);
    const capsule = JSON.parse(sourceBytes.toString("utf8"));
    const id = capsule.capabilityId;
    const runtime = capsule.runtimeBindings?.[0];
    const currentEntries = entryMap(capsule);
    const runtimeClosed = runtime?.runtimeBindingType === "capsule-runtime-binding.v1"
      && ["bindingEntryRef", "planEntryRef", "fixturesEntryRef", "sterilityEntryRef"]
        .every((key) => currentEntries.has(normalizedRef(runtime[key])));
    let encoded = sourceBytes;
    if (runtimeClosed) {
      adoptedRuntimeClosedCount++;
    } else {
      const projectedRoot = path.join(repositoryRoot, "capabilities", id, "projected");
      const bindingBytes = fs.readFileSync(path.join(projectedRoot, "application-binding.node.json"));
      const binding = JSON.parse(bindingBytes.toString("utf8"));
      const planBytes = fs.readFileSync(path.resolve(projectedRoot, binding.executionPlan));
      const fixturesBytes = fs.readFileSync(path.resolve(projectedRoot, binding.fixtures));
      const sterilityBytes = fs.readFileSync(path.resolve(projectedRoot, binding.mechanicalSterility));
      const refs = {
        bindingEntryRef: `${runtimeEntryRoot}${id}/application-binding.node.json`,
        planEntryRef: `${runtimeEntryRoot}${id}/execution-plan.node.json`,
        fixturesEntryRef: `${runtimeEntryRoot}${id}/fixtures.json`,
        sterilityEntryRef: `${runtimeEntryRoot}${id}/projection-conformance.json`
      };
      const runtimeEntries = [
        ["runtime.application-binding.node.json", refs.bindingEntryRef, bindingBytes],
        ["runtime.execution-plan.node.json", refs.planEntryRef, planBytes],
        ["runtime.fixtures.json", refs.fixturesEntryRef, fixturesBytes],
        ["runtime.projection-conformance.json", refs.sterilityEntryRef, sterilityBytes]
      ].map(([entryId, entryRef, bytes]) => ({ entryId, entryRef, entryDigest: sha256(bytes), entryBytesBase64: bytes.toString("base64") }));
      capsule.entries = [...capsule.entries.filter((entry) => !normalizedRef(entry.entryRef).startsWith(runtimeEntryRoot)), ...runtimeEntries];
      capsule.runtimeBindings = [{
        runtimeBindingType: "capsule-runtime-binding.v1",
        target: "node",
        ...refs,
        directExecutionEligibility: "fixture-proven"
      }];
      encoded = Buffer.from(`${JSON.stringify(capsule)}\n`, "utf8");
    }
    const destination = path.join(capsuleRoot, file);
    const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, encoded);
    fs.renameSync(temporary, destination);
    const authority = capsule.entries.find((entry) => entry.entryId === "capability.authority.json");
    records.push({ capabilityId: id, file, capsuleDigest: sha256(encoded), capabilityAuthorityDigest: authority.entryDigest });
  }
  const manifest = {
    estateManifestType: "sidefx-capsule-estate-manifest.v1",
    capabilityCount: records.length,
    capsules: records,
    proofSelection: {
      pretestCapabilityIds: capabilityIdsFromScript(packageJson.scripts.pretest),
      expectedPretestCount: 6,
      aggregateCapabilityIds: capabilityIdsFromScript(packageJson.scripts.test),
      repositoryTestRefs,
      expectedAggregateCount: 473,
      repositoryCompatibilityExpectedCount: 481
    }
  };
  fs.writeFileSync(estateManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { capabilityCount: records.length, adoptedRuntimeClosedCount, capsuleRoot, estateManifestPath };
}

function assertCollapsedRepository() {
  const expandedRoot = path.join(repositoryRoot, ephemeralCapabilityRoot);
  if (fs.existsSync(expandedRoot)) throw new Error(`DURABLE_REPOSITORY_CONTAINS_EXPANDED_CAPABILITIES: '${expandedRoot}'.`);
  return { expandedCapabilityRoot: "ABSENT" };
}

async function runSterileProof() {
  assertCollapsedRepository();
  const workspace = createExecutionWorkspace("sterile");
  const sterileRoot = workspace.targetRoot;
  assertOwnedSterileRoot(sterileRoot, workspace.cleanupRoot);
  const marker = path.join(sterileRoot, ".capsule-first-sterile-root.json");
  fs.writeFileSync(marker, JSON.stringify({ proofType: "capsule-first-sterile-root.v1", root: sterileRoot }), "utf8");
  try {
    copyTree(path.join(repositoryRoot, "capsules"), path.join(sterileRoot, "capsules"));
    if (fs.existsSync(path.join(sterileRoot, "bootstrap"))) throw new Error("STERILE_STAGE_CONTAINS_BOOTSTRAP_DIRECTORY");
    if (fs.existsSync(path.join(sterileRoot, "capabilities"))) throw new Error("STERILE_STAGE_CONTAINS_EXPANDED_CAPABILITIES");
    const child = spawnSync(process.execPath, [bootstrapEntryPath, "proof"], {
      cwd: sterileRoot,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      env: {
        ...process.env,
        CAPSULE_SOURCE_REPOSITORY_ROOT: sterileRoot,
        SIDEFX_PLATFORM_ROOT: workspace.platformRoot
      }
    });
    process.stdout.write(child.stdout ?? "");
    process.stderr.write(child.stderr ?? "");
    if (child.status !== 0) throw new Error(`STERILE_PROOF_FAILED: exit '${child.status}'.`);
    return { sterileRoot, status: "GREEN" };
  } finally {
    removeExecutionWorkspace(workspace, ".capsule-first-sterile-root.json");
  }
}

async function main() {
  const command = process.argv[2];
  let result;
  if (command === "migrate-legacy") result = migrateLegacyEstate();
  else if (command === "verify") result = { ...verifyEstate(), durableLayout: assertCollapsedRepository() };
  else if (command === "resolve") result = resolveEstate();
  else if (command === "list") result = listCapsules(loadEstate(), process.argv[3]);
  else if (command === "inspect") {
    if (!process.argv[3]) throw new Error("CAPSULE_ID_REQUIRED");
    result = inspectCapsule(process.argv[3]);
  } else if (command === "direct" || command === "test") {
    const estate = loadEstate();
    verifyEstate(estate);
    const selection = process.argv[3]
      ? new Set(process.argv[3].split(",").map((id) => id.trim()).filter(Boolean))
      : null;
    result = await proveDirectExecution(estate, selection);
  } else if (command === "invoke") {
    if (!process.argv[3]) throw new Error("CAPSULE_ID_REQUIRED");
    const encodedInput = process.argv[4] ?? (!process.stdin.isTTY ? fs.readFileSync(0, "utf8").trim() : "");
    if (!encodedInput) throw new Error("CAPABILITY_INPUT_REQUIRED: provide canonical JSON as the second argument or on stdin.");
    result = await invokeCapability(process.argv[3], JSON.parse(encodedInput));
  } else if (command === "provision") {
    if (!process.argv[3]) throw new Error("PROVISIONING_FEATURE_REQUIRED");
    const encodedInput = process.argv[4] ?? (!process.stdin.isTTY ? fs.readFileSync(0, "utf8").trim() : "");
    result = await provisionCapability({
      repositoryRoot,
      platformRoot: resolvePlatformRoot(),
      featurePath: process.argv[3],
      input: encodedInput ? JSON.parse(encodedInput) : null,
    });
  } else if (command === "expand") {
    if (!process.argv[3]) throw new Error("EXPANSION_TARGET_REQUIRED");
    const targetRoot = path.resolve(process.argv[3]);
    if (targetRoot === repositoryRoot) throw new Error("EXPANSION_TARGET_MUST_NOT_BE_DURABLE_REPOSITORY");
    result = expandEstate(loadEstate(), targetRoot);
  } else if (command === "project") {
    if (!process.argv[3]) throw new Error("PROJECTION_TARGET_REQUIRED");
    const targetRoot = path.resolve(process.argv[3]);
    if (targetRoot === repositoryRoot) throw new Error("PROJECTION_TARGET_MUST_NOT_BE_DURABLE_REPOSITORY");
    result = await projectEstate(loadEstate(), targetRoot);
  }
  else if (command === "proof") {
    const marker = path.join(repositoryRoot, ".capsule-first-sterile-root.json");
    result = fs.existsSync(marker) ? await proveCapsuleFirst() : await runSterileProof();
  }
  else if (command === "sterile-proof") result = await runSterileProof();
  else throw new Error("Usage: capsule-manager <migrate-legacy|verify|resolve|list [query]|inspect <id>|test [ids]|direct [ids]|invoke <id> [json]|provision <feature> [json]|expand <root>|project <root>|proof|sterile-proof>");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export {
  assertCollapsedRepository,
  capabilityIdFromBindingRef,
  expandEstate,
  inspectCapsule,
  invokeCapability,
  listCapsules,
  loadEstate,
  projectEstate,
  proveDirectExecution,
  resolveEstate,
  verifyEstate
};

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(bootstrapEntryPath)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
