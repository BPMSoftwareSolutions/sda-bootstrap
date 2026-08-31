@capability:bind-governed-artifact-materialization
@root-scenario:bind-governed-artifact-materialization
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#storeArtifact
Feature: Materialize an artifact to a declared destination and observe the result

  Writing a file is the moment a derived value becomes a fact on disk, so the
  write must be bounded and the result must be observed rather than assumed.
  This capability materializes an artifact only to a declared destination
  beneath an admitted root, and then reports the exact bytes and digest that
  actually landed instead of echoing what it intended to write.

  It deliberately does not claim the stronger guarantees. Exclusive
  create-or-match and atomic pointer compare-and-swap are separate effects with
  their own admission, and a serial materialization must not be mistaken for
  either.

  @scenario:bind-governed-artifact-materialization
  @input:governed-artifact-materialization-request
  @input-contract:governed-artifact-materialization-request.v1
  @event:governed-artifact-materialization-requested
  @event-authority:bind-governed-artifact-materialization.v1
  @outcome:governed-artifact-materialization-observation
  @outcome-contract:governed-artifact-materialization-observation.v1
  @outcome-terminal
  Scenario: Write within the admitted root and report what actually landed
    Given a declared destination beneath an admitted root and the artifact bytes to materialize
    When the artifact is materialized and the destination is observed after the write
    Then the observed bytes and digest are reported, a destination outside the admitted root is refused, and neither exclusive create nor atomic pointer movement is claimed
