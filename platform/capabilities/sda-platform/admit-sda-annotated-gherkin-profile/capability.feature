@capability:admit-sda-annotated-gherkin-profile
@root-scenario:admit-sda-annotated-gherkin-profile
Feature: Admit the annotated SDA Gherkin profile

  Lossless grammar output is evaluated against one versioned SDA annotation
  profile. Required feature and scenario connectors, owner-scoped identity,
  root-scenario closure, permitted constructs, and forbidden semantic content
  are decided by profile authority. Unsupported syntax remains preserved and
  produces a typed held result rather than being discarded.

  @scenario:admit-sda-annotated-gherkin-profile
  @input:parsed-and-compiled-gherkin-with-profile
  @input-contract:sda-annotated-gherkin-profile-admission-request.v1
  @event:sda-annotated-gherkin-profile-admission-requested
  @event-authority:admit-sda-annotated-gherkin-profile.v1
  @outcome:sda-annotated-gherkin-profile-admission-evidence
  @outcome-contract:sda-annotated-gherkin-profile-admission-evidence.v1
  @outcome-terminal
  Scenario: Evaluate annotated Gherkin without losing unsupported syntax
    Given one lossless parse, its compiled cases, and one digest-valid SDA profile
    When annotation cardinality, identity scope, connector closure, construct policy, and forbidden content are evaluated
    Then the document is profile-admitted, held, or rejected with source-located findings while every parsed construct remains unchanged

  @scenario:hold-profile-unsupported-gherkin-constructs
  @input:parsed-and-compiled-gherkin-with-profile
  @input-contract:sda-annotated-gherkin-profile-admission-request.v1
  @event:profile-unsupported-gherkin-received
  @event-authority:hold-profile-unsupported-gherkin-constructs.v1
  @outcome:held-sda-profile-admission-evidence
  @outcome-contract:sda-annotated-gherkin-profile-admission-evidence.v1
  @outcome-terminal
  Scenario: Hold grammar-valid constructs not admitted by profile v1
    Given a lossless parse containing a rule, background, outline, examples, table, doc string, or localized dialect that profile v1 does not interpret semantically
    When profile applicability is evaluated
    Then every construct remains in the compilation and PROFILE_HELD identifies its exact rule and span without silent omission or invented SDA meaning

  @scenario:reject-incomplete-sda-annotations
  @input:parsed-and-compiled-gherkin-with-profile
  @input-contract:sda-annotated-gherkin-profile-admission-request.v1
  @event:incomplete-sda-annotations-received
  @event-authority:reject-incomplete-sda-annotations.v1
  @outcome:rejected-sda-profile-admission-evidence
  @outcome-contract:sda-annotated-gherkin-profile-admission-evidence.v1
  @outcome-terminal
  Scenario: Reject missing, repeated, or ambiguous connector annotations
    Given a feature or scenario with a missing required tag, repeated singleton tag, dangling root scenario, or ambiguous inherited annotation
    When profile connector closure is evaluated
    Then the document is rejected with every exact occurrence and no last-value-wins, title-derived, or proximity-derived identity

  @scenario:preserve-owner-scoped-semantic-identities
  @input:parsed-and-compiled-gherkin-with-profile
  @input-contract:sda-annotated-gherkin-profile-admission-request.v1
  @event:owner-scoped-semantic-identities-received
  @event-authority:preserve-owner-scoped-semantic-identities.v1
  @outcome:owner-scoped-sda-profile-admission-evidence
  @outcome-contract:sda-annotated-gherkin-profile-admission-evidence.v1
  @outcome-terminal
  Scenario: Distinguish shared local IDs by semantic owner
    Given different scenarios that deliberately reuse a local input, event, outcome, or contract identifier within their own ownership scope
    When canonical identities are admitted
    Then owned identities remain distinct by scenario owner while duplicate top-level capability or scenario identities are rejected

  @scenario:reject-forbidden-semantic-gherkin-content
  @input:parsed-and-compiled-gherkin-with-profile
  @input-contract:sda-annotated-gherkin-profile-admission-request.v1
  @event:forbidden-semantic-gherkin-content-received
  @event-authority:reject-forbidden-semantic-gherkin-content.v1
  @outcome:rejected-forbidden-sda-profile-evidence
  @outcome-contract:sda-annotated-gherkin-profile-admission-evidence.v1
  @outcome-terminal
  Scenario: Reject provider, framework, endpoint, or executable authority in semantic tags
    Given grammar-valid tags that attempt to declare provider selection, target framework, server address, endpoint, or executable code as semantic authority
    When forbidden content policy is evaluated
    Then the document is rejected at the exact tags without inspecting implementation proximity or moving mechanics into Gherkin
