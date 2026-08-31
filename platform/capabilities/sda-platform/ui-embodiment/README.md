# UI embodiment platform capability

This package owns feature-scoped admission for the frozen
`consumer-ui-authority.v1` protocol. It is outside the Scenario Kernel.

The catalog binds every UI embodiment provider to an exact feature profile.
Projection derives required feature IDs from the admitted authority and
resolves every ID as `SUPPORTED`, explicitly `ADAPTED`, or `NOT_SUPPORTED`
before generating target artifacts. An absent feature is never treated as a
fallback or target-wide admission.

This is the Phase 0 containment adapter for the frozen v1 authority. The v2
presentation protocol, normalized IR, compiler, and embodiment plans remain a
separate Phase 1 boundary.
