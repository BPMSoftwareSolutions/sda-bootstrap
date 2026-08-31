@capability:verify-semantic-vector-index-conformance
@root-scenario:verify-semantic-vector-index-conformance
Feature: Verify the deterministic vector recall provider before it is trusted

  A recall provider earns admission by proving the properties that make its
  testimony safe to consume, not by producing plausible results. This
  conformance capability checks that the provider authority recomputes its own
  digest and pins the exact provider and registry sources, that every
  coordinate and score is a non-negative integer, that identical pinned inputs
  reproduce identical index, query, and record digests, that reordered corpus
  discovery changes nothing, that candidates arrive in the single declared
  order, that an unadmitted embedding model and a mismatched authority digest
  are both refused before evaluation, and that the record claims no grounding,
  authority, or admission of its own.

  It also verifies the reason this provider exists at all: that wording which
  exact substring containment cannot see is nonetheless recalled.

  @scenario:verify-semantic-vector-index-conformance
  @input:semantic-vector-index-provider-conformance-request
  @input-contract:semantic-vector-index-provider-conformance-request.v1
  @event:semantic-vector-index-provider-conformance-requested
  @event-authority:verify-semantic-vector-index-conformance.v1
  @outcome:semantic-vector-index-provider-conformance
  @outcome-contract:semantic-vector-index-provider-conformance.v1
  @outcome-terminal
  Scenario: Close every provider conformance partition before admission
    Given the admitted provider authority, its contracts, and its pinned implementation sources
    When determinism, integer coordinates, declared ordering, refusal behavior, boundary claims, and novel-wording recall are each exercised
    Then every partition is satisfied and the provider is admitted as candidate testimony only
