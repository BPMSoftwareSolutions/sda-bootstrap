@capability:verify-durable-store-mechanic-admission
@root-scenario:verify-durable-store-mechanic-admission
Feature: Verify the durable store mechanic admission

  The durable store transition needs its generic mechanics admitted as
  platform authority before any provider or repository realization can
  claim them. This conformance capability checks that the four mechanics —
  canonical-json-byte-validation and retained-lineage-authorization in the
  pure family, exclusive-create-or-exact-match and
  atomic-current-pointer-compare-and-swap in the effect family — are
  declared with contracts and conformance references, that the node registry
  pins the current mechanic authority digests, and that each mechanic
  composes from already admitted mechanics with deterministic behavior and
  typed refusals.

  The compare-and-swap mechanic receives complete expected-current and
  proposed-next pointer states and never calculates generation identity.
  Exclusive create never overwrites. Conflict reports the observed winner
  without mutation.

  @scenario:verify-durable-store-mechanic-admission
  @input:durable-store-mechanic-admission-verification-request
  @input-contract:durable-store-mechanic-admission-verification-request.v1
  @event:durable-store-mechanic-admission-verification-requested
  @event-authority:verify-durable-store-mechanic-admission.v1
  @outcome:durable-store-mechanic-admission-receipt
  @outcome-contract:durable-store-mechanic-admission.v1
  @outcome-terminal
  Scenario: Verify the four durable store mechanics are admitted as platform authority
    Given the two mechanic family authorities, the node mechanic registry, and the declared store contracts, each pinned by exact bytes
    When declaration, digest pinning, and composition behavior are evaluated in order
    Then exactly one conformance disposition and its ordered partitions are retained, with no claim about any physical store provider
