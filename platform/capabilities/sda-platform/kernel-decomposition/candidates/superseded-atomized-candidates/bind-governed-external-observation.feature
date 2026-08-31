@capability:bind-governed-external-observation
@root-scenario:bind-governed-external-observation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#observeExternalRepresentation
Feature: Observe an external representation as testimony only

  Anything fetched from outside the admitted estate is testimony about the
  outside world and nothing more. This capability retrieves a declared external
  reference only when its host is allow-listed, retains the exact observed
  representation and its digest, and classifies the result as external testimony
  that may never be reclassified into authority by its content alone.

  An undeclared reference, or a host outside the allow-list, is refused before
  any request leaves the process.

  @scenario:bind-governed-external-observation
  @input:governed-external-observation-request
  @input-contract:governed-external-observation-request.v1
  @event:governed-external-observation-requested
  @event-authority:bind-governed-external-observation.v1
  @outcome:governed-external-observation
  @outcome-contract:governed-external-observation.v1
  @outcome-terminal
  Scenario: Retain an allow-listed external representation as classified testimony
    Given a declared external reference and the admitted host allow-list
    When the reference is observed within its declared method and bounds
    Then the exact representation, its digest, and its external source class are retained, and a host outside the allow-list is refused before any request is made
