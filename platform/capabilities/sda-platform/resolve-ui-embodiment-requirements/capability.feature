@capability:resolve-ui-embodiment-requirements
@root-scenario:derive-exact-ui-capability-vector
Feature: Resolve exact UI embodiment requirements

  @scenario:derive-exact-ui-capability-vector
  @input:canonical-presentation-ir
  @input-contract:sda-ui-presentation-ir.v3
  @event:resolve-ui-embodiment-requirements
  @outcome:ui-capability-vector
  @outcome-contract:ui-capability-vector.v1
  @outcome-terminal
  Scenario: Derive requirements without selecting a provider
    Given one canonical digest-valid v3 presentation IR
    When its normalized mechanics and proof obligations are resolved
    Then one exact canonical capability vector is returned without loading a provider catalog
