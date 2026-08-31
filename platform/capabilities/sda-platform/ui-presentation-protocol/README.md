# SDA UI presentation protocol

This platform package owns the target-neutral presentation seam between
consumer UI authority and UI embodiment providers. It is outside the Scenario
Kernel.

`sda-ui-presentation-ir.v2` is compiled deterministically from an admitted
consumer semantic UI source. The IR contains normalized application,
interaction, presentation, semantic-event, state-patch, feature-requirement,
and source-lineage data. Renderers and providers may not read consumer
authority directly or derive consumer-domain meaning.

The v1 compatibility adapter is one-way and digest-bound. It may normalize the
frozen `consumer-ui-authority.v1` source into v2, but v2 providers do not depend
on the source schema or consumer identity. Unsupported fields and missing
features fail before materialization.

## Owned artifacts

- `contracts/sda-ui-presentation-ir.v2.schema.json`: closed IR contract;
- `contracts/ui-embodiment-provider-registry.v1.schema.json`: provider discovery contract;
- `compatibility-policy.json`: admitted source and evolution rules;
- `protocol.identity.json`: canonical protocol and policy digests;
- `provider-registry.json`: discovered provider profiles; and
- `generated-models/`: language bindings generated from the protocol identity.

## Reference migration status

React is the Phase 1 reference provider. It is discovered through
`provider-registry.json`, consumes `sda-ui-presentation-ir.v2`, and emits
digest-bound compilation and feature-admission evidence before materializing
its sterile application seam. Semantic actions and input commits enter the
runtime as protocol events and resolve through versioned state patches.

WPF, JavaFX, and the legacy HTML claimant remain on clearly identified legacy
materialization paths. Their migration or retirement is post-Phase 1 work and
does not weaken the rule that ordinary consumer changes must remain authority
or semantic-read-model data changes.

Executable acceptance lives in
`tools/tests/consumer-projection/ui-presentation-protocol.test.js`. It includes
closed-schema rejection, deterministic compilation, common-digest language
models, registry discovery, and authority-only pressure mutations with a
byte-identical React provider seam.

## Successor compiler

ADR-0009 continues the normalized-mechanics responsibility as
`sda-ui-presentation-ir.v3`. `successor.identity.json` digest-binds the
contract and the `compile-semantic-presentation.v1` compiler authority. The
compiler deterministically preserves semantic relationship, accessibility,
adaptation, event, and presentation-profile references while lowering only
authority-approved mechanics. Unsupported or ambiguous intent produces stable
rejection evidence.

The vectors under `fixtures/v3-compiled/` are canonical compiler outputs with
verified semantic, compiler-authority, and IR digests. This closes Phase E
compiler admission.

Phase F adds exact `ui-capability-vector.v1` derivation, digest-bound provider
registry v2 resolution, immutable `ui-embodiment-plan.v1`, and generated
protocol sources for all eight language roots. Its checked-in provider is
explicitly `PLANNING_ONLY`; target embodiment and native proof remain unclaimed.

Phase G adds directional, repair-gated import for frozen
`consumer-ui-authority.v1` and `sda-ui-presentation-ir.v2`. Conversion requires
per-fact semantic-origin mappings to an admitted declared authority. Physical
and visual legacy facts remain separately digest-bound and cannot be promoted
to successor semantics by the importer.

Phase H admits TypeScript React and browser DOM reference providers against
the successor protocol. A shared interpreter applies only the closed,
digest-bound `ui-embodiment-plan.v1`; target adapters select native semantic
roles and emit structural testimony for composition, events, accessibility,
and adaptation. Both providers are `PROVIDER_ADMITTED` with `STRUCTURAL`
observation. Browser-native execution remains an explicit future proof gate.
