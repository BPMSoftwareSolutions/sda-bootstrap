# Scenario Kernel Specification

`scenario-kernel.specification.json` is the one admitted instance of the kernel specification — it must validate against `kernel/schemas/scenario-kernel.schema.json`. That schema is the canonical machine authority; this document is the human rationale behind it. JSON is executable authority, this Markdown is explanation — the two should never compete for the same fact.

- **specificationId**: `scenario-kernel.v1`
- **released**: 2025-02-20

## Architectural law

```
Scenario = Input + Event + Outcome
```

with scenario meaning:

```
DATA → ACTION → EXPERIENCE
```

Execution still transforms admitted state into admitted state. The resulting
data is observable state that represents and proves the outcome; it is not the
human or system value of the outcome itself. A scenario closes only when its
promised experience becomes observably true.

## Core elements

The specification instance's `objects` array is the single source of truth for which canonical object kinds exist and what schema admits each one — see `kernel/schemas/scenario-kernel.schema.json`. As of this writing that's `capability`, `scenario`, `scenario-input`, `scenario-event`, `scenario-outcome`, `scenario-transition`, `scenario-execution`, and `language-binding`, each with its own `kernel/schemas/*.schema.json` file. This list is intentionally not repeated here in prose — the schema family README (`kernel/schemas/README.md`) documents each one's role so this document doesn't drift out of sync with it.

## Invariants

1. Kernel specification cannot be mutated by language implementations
2. All language bindings must implement the same scenario semantics
3. Generated code originates only from canonical schemas
4. Conformance fixtures are language-independent
