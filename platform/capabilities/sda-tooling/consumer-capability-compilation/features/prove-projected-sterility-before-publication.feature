@capability:prove-projected-sterility-before-publication
@root-scenario:prove-projected-sterility-before-publication
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/prove-projected-sterility-before-publication/provider.ts
Feature: Prove projected sterility before publication

  A consumer author must never publish a planned executable file that has
  silently acquired hidden mechanics or domain meaning. The capability
  inspects every planned executable file against the admitted sterility
  policy before publication is permitted to proceed.

  Every planned executable file receives an explicit disposition: it is
  mechanical, or it carries a precise violation naming what was found. The
  capability does not publish, plan, or resolve anything itself — it only
  proves whether the plan already constructed is safe to publish.

  @scenario:prove-projected-sterility-before-publication
  @input:consumer-plan-and-sterility-policy
  @input-contract:prove-projected-sterility-before-publication-input.v1
  @event:prepublication-sterility-proof-requested
  @event-authority:consumer-prepublication-sterility-proof.v1
  @outcome:planned-projection-sterility-known
  @outcome-contract:prepublication-sterility-evidence.v1
  @outcome-terminal
  Scenario: Prove every planned executable file is mechanically sterile before publication
    Given one consumer projection plan and the admitted sterility policy
    When every planned executable file is inspected for hidden mechanics before publication
    Then every planned executable file is mechanical or carries a precise violation, and no file is published or admitted as a side effect of the inspection
