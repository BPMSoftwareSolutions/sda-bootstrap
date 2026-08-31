# Semantic Authority

Language-neutral semantic laws that govern the kernel schema family but are not fully expressible as portable JSON Schema structural constraints — typically because enforcing them requires comparing values across sibling properties or resolving identity across documents, and standard JSON Schema (draft 2020-12) has no cross-property equality keyword.

## Structure

- **primitives/** - semantic laws about core primitives (semanticId, digest, versioning)
- **operations/** - semantic laws about kernel operations
- **execution/** - semantic laws about runtime execution/testimony
- **transitions/** - semantic laws about scenario transitions

Each law names the schema/property it governs, states the rule, and records why it can't (yet) be enforced structurally. A kernel conformance validator is expected to check these laws at the semantic layer — the JSON Schema family alone is not sufficient to admit or reject an instance against them.

## Files

- `transitions/binding-authority.semantic-authority.json` — a scenario-transition's `bindingAuthorityId` is optional for a direct contract-to-contract pass-through, and mandatory whenever the transition projects or transforms data across distinct contracts. Referenced from `scenario-kernel.schema.json`'s `executionLaws.bindingAuthority` and `scenario-transition.schema.json`'s `bindingAuthorityId`.
