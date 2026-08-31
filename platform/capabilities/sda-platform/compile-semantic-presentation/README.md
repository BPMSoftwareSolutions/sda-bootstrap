# Compile semantic presentation

This platform capability is the sole production author of
`sda-ui-presentation-ir.v3`. It lowers one digest-valid
`sda-ui-semantic-presentation.v1` into canonical, target-neutral mechanics and
returns digest-bound compilation evidence.

The compiler preserves declared semantic relationships, accessibility
obligations, event references, adaptation invariants, and presentation-profile
indirection. It does not load a provider registry, select a framework, infer a
control, or invent mechanics for unsupported intent. Ambiguity is a stable
`REJECTED` result with no IR digest.

## Owned artifacts

- `capability.feature`: canonical compilation scenario;
- `compile-semantic-presentation.authority.json`: digest-bound lowering rules;
- `contracts/compile-semantic-presentation.authority.schema.json`: closed compiler authority contract;
- `contracts/semantic-presentation-compilation-evidence.v1.schema.json`: success and rejection evidence contract; and
- `fixtures/`: canonical evidence paired with compiler-produced v3 fixtures.

The pure reference compiler lives at
`tools/src/ui-presentation/application/semantic-presentation-compiler.ts`.
Conformance and mutation coverage lives at
`tools/tests/conformance/semantic-presentation-compiler.test.js`.
