@capability:import-legacy-ui-presentation
@root-scenario:import-legacy-ui-with-proven-origin
Feature: Import frozen legacy UI without inferring semantic meaning

  @scenario:import-legacy-ui-with-proven-origin
  @input:legacy-ui-source
  @input-contract:consumer-ui-authority.v1-or-sda-ui-presentation-ir.v2
  @input:legacy-semantic-origin-manifest
  @input-contract:legacy-ui-semantic-origin-manifest.v1
  @event:import-legacy-ui-presentation
  @outcome:legacy-ui-compatibility-evidence
  @outcome-contract:legacy-ui-compatibility-evidence.v1
  @outcome:legacy-ui-repair-workbench
  @outcome-contract:legacy-ui-repair-workbench.v1
  @outcome-terminal
  Scenario: Route provable facts toward the successor center
    Given one frozen legacy source and optional digest-bound semantic-origin repair
    When every semantic candidate and physical presentation fact is classified
    Then provable semantics enter the declared successor circuit and unresolved meaning becomes an editable repair workbench

  @scenario:never-infer-semantics-from-physical-structure
  Scenario: Preserve physical facts without semantic promotion
    Given legacy controls, layout, coordinates, colors, tokens, or recipes
    When compatibility is evaluated
    Then those facts remain lineage-bound legacy presentation facts and cannot select semantic roles, relationships, or experience meaning
