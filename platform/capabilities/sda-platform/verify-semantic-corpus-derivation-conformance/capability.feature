@capability:verify-semantic-corpus-derivation-conformance
@root-scenario:verify-semantic-corpus-derivation-projection
Feature: Verify profile-governed semantic corpus derivation projection conformance

  Deterministic fixtures bind exact authority, receipt, source-byte,
  representation, rule, projected-circuit, and reproduction identities.
  Conformance admission remains separate from operational derivation evidence.

  @scenario:verify-semantic-corpus-derivation-projection
  @input-contract:semantic-corpus-derivation-projection-conformance-request.v1
  @outcome-contract:semantic-corpus-derivation-projection-conformance.v1
  @outcome-terminal
  Scenario: Verify canonical object and relationship derivation
    Given admitted generic ontology, profile, rule, receipt, and representation fixtures
    When the governed projected capability derives canonical and owner-scoped semantic records
    Then exact object, relationship, source pointer, and rule identities are observed

  @scenario:verify-open-semantic-reference-non-invention
  @input-contract:semantic-corpus-derivation-projection-conformance-request.v1
  @outcome-contract:semantic-corpus-derivation-projection-conformance.v1
  @outcome-terminal
  Scenario: Verify open references remain attributable and un-invented
    Given an explicit relationship names an absent endpoint
    When projected conformance is evaluated
    Then an ordered open finding is observed and no replacement endpoint or relationship is invented

  @scenario:verify-prohibited-semantic-bases
  @input-contract:semantic-corpus-derivation-projection-conformance-request.v1
  @outcome-contract:semantic-corpus-derivation-projection-conformance.v1
  @outcome-terminal
  Scenario: Verify every prohibited basis is rejected
    Given directory, prose, lexical, embedding, and model-testimony rule variants
    When projected conformance is evaluated
    Then every variant is rejected without derived records

  @scenario:verify-semantic-lineage-boundaries
  @input-contract:semantic-corpus-derivation-projection-conformance-request.v1
  @outcome-contract:semantic-corpus-derivation-projection-conformance.v1
  @outcome-terminal
  Scenario: Verify mixed lineage and source-class escalation are rejected
    Given stale authority, receipt, source, representation, snapshot, and source-class variants
    When projected conformance is evaluated
    Then exact diagnostic identities are observed and generations are never combined

  @scenario:verify-semantic-derivation-reproduction
  @input-contract:semantic-corpus-derivation-projection-conformance-request.v1
  @outcome-contract:semantic-corpus-derivation-projection-conformance.v1
  @outcome-terminal
  Scenario: Verify ordering and reproduction identity
    Given equivalent inputs arrive in reversed discovery order
    When projected conformance is evaluated through the application-binding seam
    Then ordered records, findings, input identity, and evidence digests are identical
