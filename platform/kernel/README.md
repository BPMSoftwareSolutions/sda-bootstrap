# Scenario Kernel

The canonical authority for scenario-driven execution semantics.

This directory defines **what Scenario Kernel means**, independent of runtime or language implementation.

## Structure

- **specification/** - Kernel specification and architectural documentation
- **schemas/** - JSON Schema definitions for all core types (Scenario, Input, Event, Outcome, Transition)
- **contracts/** - Contract definitions and boundaries
- **semantic-authority/** - Semantic definitions for operations, execution, transitions, and primitives
- **fixtures/** - Test fixtures (valid, invalid, and execution cases)

## Core Principle

The kernel law stays extraordinarily small:

```
Scenario = Input + Event + Outcome
```

with execution conceptually:

```
DATA → EVENT → DATA
```

## Protection

This directory is protected from normal application development mutations. Changes to kernel semantics require explicit architectural review and kernel version evolution (see K010 in governance rules).

## Schemas

All schema definitions are language-neutral JSON Schema 2020-12. These schemas are projected into language-specific implementations through binding processes.

## Invariants

1. No runtime-language source code lives in kernel/
2. Kernel semantics cannot be redefined by language implementations
3. All language bindings must implement identical scenario semantics
4. Kernel evolution requires version bumping
