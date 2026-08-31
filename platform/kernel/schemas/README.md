# Scenario Kernel Schemas v1

Language-neutral JSON Schema contract family for Scenario-Driven Architecture.

## Core law

`Scenario = Input + Event + Outcome`

A governed scenario transition must declare semantic progress as either:

- `narrowing`
- `termination`

## Files

The family is organized into three planes.

**Specification plane** — what the kernel is, and the primitives everything else is built from:

- `scenario-kernel.schema.json` — root kernel specification manifest
- `semantic-primitives.schema.json` — shared `$defs` library (`semanticId`, `semanticVersion`, `digest`, `contractReference`, `kernelSpecificationReference`)
- `scenario-kernel-execution-vector.schema.json` — canonical language-neutral runtime flow (admit-input → resolve-event-authority → execute-event-authority → admit-outcome → resolve-disposition); one admitted instance lives at `kernel/contracts/execution/scenario-kernel-execution-vector.json`

**Authority plane** — the durable, governed definition of a capability:

- `scenario-kernel-capability-contract.schema.json` — root capability contract, composes `capability.schema.json`
- `capability.schema.json` — governed capability composition (scenarios, transitions, interfaces)
- `user-story.schema.json` — actor/intent/outcome narrative
- `interface-binding.schema.json` — binds an exposed interface surface to the scenarios it admits entry through
- `scenario.schema.json` — canonical Scenario definition
- `scenario-input.schema.json` — input authority
- `scenario-event.schema.json` — event/execution authority address
- `scenario-outcome.schema.json` — outcome authority
- `gherkin-binding.schema.json` — binds a scenario's Given/When/Then to semantic addresses
- `scenario-transition.schema.json` — governed scenario edge

**Embodiment/testimony plane** — runtime conformance and execution:

- `language-binding.schema.json` — C#/Node/Python/Java binding manifest (declares WHAT a binding claims to implement)
- `scenario-execution.schema.json` — runtime execution testimony envelope
- `scenario-execution-observation.schema.json` — per-step execution testimony emitted by the kernel body itself, one per canonical execution-vector step (see K011-K012)
- `scenario-kernel-execution-closure.schema.json` — verdict that one execution's observation trace fully accounts for the canonical vector, produced by `tools/src/conformance/proof/execution-closure-mechanics.ts` (see K013)
- `scenario-kernel-implementation-conformance.schema.json` — proves HOW a language binding embodies the schema family: per-object type mapping, claimed execution vector, and declared data-authority (no hardcoded values where canonical authority should govern)

These schemas intentionally govern the language-neutral contract surface. Language implementations must prove conformance separately using a shared canonical fixture corpus.

Some rules referenced by these schemas (e.g. `bindingAuthority`, and the data-authority assertions inside `scenario-kernel-implementation-conformance.schema.json`) aren't fully checkable by JSON Schema validation alone — see `kernel/semantic-authority/`.
