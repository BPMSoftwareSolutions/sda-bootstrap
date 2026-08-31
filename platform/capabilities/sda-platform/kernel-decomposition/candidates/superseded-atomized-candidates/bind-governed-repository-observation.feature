@capability:bind-governed-repository-observation
@root-scenario:bind-governed-repository-observation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#observeGovernedRepository
Feature: Observe declared repository resources within an admitted boundary

  Observation means "this was seen", never "this is true". This capability
  observes only the resources a request declares, beneath an admitted root it
  may not escape, and returns presence, exact bytes, and digest for each one in
  a stable declared order rather than in whatever order a directory walk
  happened to produce. A resource outside the admitted root, or one the request
  did not declare, is refused and reported as a rejection with its reason
  instead of being silently skipped or silently included.

  The bounded responsibility already exists in the runtime. What it lacks is an
  authority of its own, so nothing can currently query what the observation was
  permitted to see or compare that permission across targets.

  @scenario:bind-governed-repository-observation
  @input:governed-repository-observation-request
  @input-contract:governed-repository-observation-request.v1
  @event:governed-repository-observation-requested
  @event-authority:bind-governed-repository-observation.v1
  @outcome:governed-repository-observation
  @outcome-contract:governed-repository-observation.v1
  @outcome-terminal
  Scenario: Return bounded observation testimony for declared resources only
    Given an admitted root, a declared resource set, and the requested fact forms
    When each declared resource is observed in stable identity order within the admitted boundary
    Then presence, bytes, digests, rejections, and lineage are returned as testimony that claims no truth about meaning
