@capability:bind-deterministic-semantic-vector-index
@root-scenario:bind-deterministic-semantic-vector-index
Feature: Bind a deterministic reference vector recall mechanic

  Vector recall is the one retrieval channel that cannot be expressed beneath
  the semantic contracts, because embedding requires decomposition mechanics the
  admitted transformation vocabulary does not declare. This platform capability
  admits a reference provider for it under two disciplines that keep the result
  governable. First, every coordinate is an integer: the reference embedding
  counts character n-grams over the exact admitted search representation, and
  similarity is the summed minimum of shared coordinates, so no floating point
  value ever enters a receipt and two providers can be compared for exact
  identity rather than by tolerance. Second, the provider owns ordering and
  returns ranked testimony, so a consumer never re-ranks and never needs a
  comparator of its own.

  The provider proposes candidates. It grounds nothing, admits nothing, and
  carries no authority over meaning.

  @scenario:bind-deterministic-semantic-vector-index
  @input:semantic-vector-index-input
  @input-contract:semantic-vector-index-input.v1
  @event:semantic-vector-index-requested
  @event-authority:bind-deterministic-semantic-vector-index.v1
  @outcome:semantic-vector-index-record
  @outcome-contract:semantic-vector-index-record.v1
  @outcome-terminal
  Scenario: Recall ordered candidates from an integer reference vector space
    Given a pinned corpus of admitted search representations, declared embedding parameters, and declared query terms
    When the reference model embeds every member and the query into integer n-gram coordinates and scores their overlap
    Then ordered candidate testimony is returned with its index, query vector, and record digests and no floating point coordinate
