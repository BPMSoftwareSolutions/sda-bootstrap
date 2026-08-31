@capability:resolve-platform-responsibilities
@root-scenario:resolve-platform-responsibilities
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/resolve-platform-responsibilities/provider.ts
Feature: Resolve platform responsibilities

  A consumer author needs to know, before any file is planned, whether every
  mechanic the canonical scenario graph requires can actually be bound to an
  admitted provider on each requested target. The capability binds every
  required mechanic to admitted target providers and reports the exact
  resolution or a precise missing-capability finding for each one.

  Every requested target receives a complete mechanic resolution: either
  every requirement is bound to one admitted provider, or the gap is named
  precisely. The capability does not construct a file plan, inspect
  sterility, or publish anything — it only determines whether each target is
  hostable.

  @scenario:resolve-platform-responsibilities
  @input:consumer-graph-profile-and-target-facts
  @input-contract:resolve-platform-responsibilities-input.v1
  @event:platform-responsibility-resolution-requested
  @event-authority:consumer-platform-responsibility-resolution.v1
  @outcome:platform-responsibility-resolutions-known
  @outcome-contract:platform-responsibility-resolution-evidence.v1
  @outcome-terminal
  Scenario: Resolve every required mechanic to an admitted provider or a precise gap
    Given one canonical scenario graph, its consumer profile, and the requested projection targets
    When every required mechanic is bound to admitted providers for each requested target
    Then every requested target has a complete mechanic resolution naming its admitted provider or a precise missing-capability finding, without constructing a file plan or publishing anything
