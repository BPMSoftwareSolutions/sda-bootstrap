@capability:plan-ui-embodiment
@root-scenario:produce-immutable-ui-embodiment-plan
Feature: Plan an immutable UI embodiment

  @scenario:produce-immutable-ui-embodiment-plan
  @input:canonical-presentation-ir
  @input-contract:sda-ui-presentation-ir.v3
  @input:ui-capability-vector
  @input-contract:ui-capability-vector.v1
  @input:provider-resolution
  @input-contract:provider-resolution.v1
  @event:plan-ui-embodiment
  @outcome:ui-embodiment-plan
  @outcome-contract:ui-embodiment-plan.v1
  @outcome-terminal
  Scenario: Pin every admitted feature to one provider mechanic
    Given one selected provider and its digest-bound inputs
    When every exact requirement is bound to an admitted mechanic
    Then one immutable canonical plan is returned without loading target implementation code
