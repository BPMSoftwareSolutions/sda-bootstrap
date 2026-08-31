@capability:bind-canonical-capability-feature-resolution
@root-scenario:bind-canonical-capability-feature-resolution
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#parseCanonicalCapabilityFeature,resolveCanonicalCapabilityFeature
Feature: Resolve one canonical capability feature from admitted authoring tags

  Reading a feature file is an authoring act, not an execution mechanic. The
  runtime currently performs it anyway: it scans lines, collects the admitted
  authoring tags, and decides which declarations are canonical. That places the
  meaning of the authoring vocabulary inside a Node source file, where it cannot
  be queried, compared across targets, or replaced without editing the kernel.

  This capability owns that meaning instead. It resolves the declared capability
  identity, root scenario, authoring profile, and per-scenario input, event, and
  outcome bindings into one bounded canonical representation, and rejects a
  feature whose required tags are absent rather than inferring them from
  position or prose. It is a stepping stone, not a destination: the admitted
  lossless Gherkin compiler should ultimately supply this resolution, and this
  capability exists so that the line-scanning implementation can be retired
  against the same fixtures rather than quietly trusted.

  @scenario:bind-canonical-capability-feature-resolution
  @input:canonical-capability-feature-resolution-request
  @input-contract:canonical-capability-feature-resolution-request.v1
  @event:canonical-capability-feature-resolution-requested
  @event-authority:bind-canonical-capability-feature-resolution.v1
  @outcome:canonical-capability-feature
  @outcome-contract:canonical-capability-feature.v1
  @outcome-terminal
  Scenario: Resolve declared authoring tags into one canonical feature
    Given admitted feature source bytes and the declared canonical authoring tag vocabulary
    When capability identity, root scenario, and every scenario input, event, and outcome binding are resolved from declared tags only
    Then one canonical capability feature is returned, or the missing required declaration is named and nothing is inferred
