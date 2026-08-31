@capability:resolve-ui-embodiment-provider
@root-scenario:resolve-one-ui-embodiment-provider
Feature: Resolve one compatible UI embodiment provider

  @scenario:resolve-one-ui-embodiment-provider
  @input:ui-capability-vector
  @input-contract:ui-capability-vector.v1
  @input:ui-target-profile
  @input-contract:ui-target-profile.v1
  @input:provider-registry
  @input-contract:ui-embodiment-provider-registry.v2
  @event:resolve-ui-embodiment-provider
  @outcome:provider-resolution
  @outcome-contract:provider-resolution.v1
  @outcome-terminal
  Scenario: Resolve a digest-bound provider
    Given exact requirements, one target profile, and one digest-valid catalog
    When compatible providers and proof capabilities are resolved
    Then one provider is selected or stable missing, incompatible, or ambiguous findings are returned
