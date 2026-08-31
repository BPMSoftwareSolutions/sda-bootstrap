# A preserved comment before the feature documents byte-level source retention.
@capability:fixture-advanced-official-gherkin
@root-scenario:compile-advanced-constructs
Feature: Advanced official Gherkin constructs

  This narrative must remain distinct from executable steps and annotations.

  Background:
    Given a feature-wide precondition

  Rule: Preserve nested grammar constructs

    Background:
      Given a rule-wide precondition

    # This comment is attached to the outline rather than a tag.
    @scenario:compile-advanced-constructs
    @input:advanced-source
    @input-contract:canonical-gherkin-source.v1
    @event:advanced-source-received
    @event-authority:compile-advanced-constructs.v1
    @outcome:advanced-source-compilation
    @outcome-contract:gherkin-compilation-result.v1
    @outcome-terminal
    Scenario Outline: Compile values without flattening arguments
      Given a source named <name>
      When its structured argument is retained
        """json
        {"name":"<name>","enabled":true}
        """
      Then its rows are preserved
        | field | value  |
        | name  | <name> |
        | mode  | strict |

      Examples: supported names
        | name  |
        | alpha |
        | beta  |
