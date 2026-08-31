@capability:semantic-corpus-derivation
@root-scenario:derive-semantic-corpus-records
Feature: Derive semantic corpus records

  Versioned derivation rules consume one pinned corpus snapshot, admitted
  compiler IR, and schema-admitted JSON representations. They produce ordered
  canonical object and relationship candidates with exact source pointers,
  rule identities, and open-reference findings. The derivation capability does
  not choose corpus membership, ground query results, or publish artifacts.

  @scenario:derive-semantic-corpus-records
  @input:admitted-semantic-corpus-derivation-request
  @input-contract:semantic-corpus-derivation-request.v1
  @event:semantic-corpus-derivation-requested
  @event-authority:semantic-corpus-derivation.v1
  @outcome:semantic-corpus-derivation-evidence
  @outcome-contract:semantic-corpus-derivation-evidence.v1
  @outcome-terminal
  Scenario: Apply admitted rules without inventing semantic authority
    Given one snapshot, admitted ingestion receipts, ontology, and deterministic object and relationship derivation rules
    When rules select exact compiler or JSON pointers and derive owner-scoped identities and edges
    Then ordered records and attributable findings are returned with zero path, prose, similarity, or model-derived authority inventions
