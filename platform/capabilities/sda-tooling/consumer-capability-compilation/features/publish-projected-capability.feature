@capability:publish-projected-capability
@root-scenario:publish-projected-capability
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/publish-projected-capability/provider.ts
Feature: Publish projected capability

  A consumer author needs the proven projection plan committed to disk
  atomically, with its manifest written last, so a partial or failed
  publication can never be mistaken for a complete one. The capability
  publishes only a plan that has already passed sterility proof, and never
  touches a target it was not asked to publish.

  Published bytes match the proven plan exactly, and every untargeted
  artifact remains byte-identical to what existed before publication. The
  capability does not construct, resolve, or re-prove the plan — it only
  commits already-proven bytes atomically.

  @scenario:publish-projected-capability
  @input:proven-consumer-plan-and-destination-facts
  @input-contract:publish-projected-capability-input.v1
  @event:projected-capability-publication-requested
  @event-authority:consumer-capability-publication.v1
  @outcome:projected-capability-published
  @outcome-contract:consumer-capability-publication-evidence.v1
  @outcome-terminal
  Scenario: Atomically publish a proven consumer plan with its manifest written last
    Given one proven consumer projection plan and its publication destination facts
    When the proven plan is atomically published and its manifest is written last
    Then published bytes match the proven plan exactly, every untargeted artifact remains unchanged, and no unproven or unrequested target is touched
