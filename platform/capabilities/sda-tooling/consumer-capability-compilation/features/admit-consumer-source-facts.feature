@capability:admit-consumer-source-facts
@root-scenario:admit-consumer-source-facts
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/admit-consumer-source-facts/provider.ts
Feature: Admit consumer source facts

  A consumer author needs every declared consumer authority document loaded,
  validated, digested, and related exactly once before compilation proceeds.
  The capability admits the declared workspace source facts and establishes
  their provenance so downstream compilation never operates on unverified or
  undated input.

  Every required source is admitted with an exact content digest and source
  reference, or is explicitly rejected. The capability does not compose the
  scenario graph, resolve platform responsibilities, or make any compilation
  decision beyond admitting the declared sources.

  @scenario:admit-consumer-source-facts
  @input:consumer-workspace-source-facts
  @input-contract:admit-consumer-source-facts-input.v1
  @event:consumer-source-admission-requested
  @event-authority:consumer-source-admission.v1
  @outcome:consumer-source-admission-known
  @outcome-contract:consumer-source-admission-evidence.v1
  @outcome-terminal
  Scenario: Admit every declared consumer source with exact provenance
    Given one declared consumer workspace and its set of source facts
    When every declared consumer authority document is loaded, validated, digested, and related
    Then every required source is admitted with its exact source reference and content digest, or is explicitly rejected, without composing the scenario graph or resolving platform responsibilities
