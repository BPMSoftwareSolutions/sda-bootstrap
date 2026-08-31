@capability:bind-governed-model-connector
@root-scenario:bind-governed-model-connector
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#invokeGenericLlmConnector
Feature: Invoke a declared model provider as testimony, never as authority

  A model response is the least trustworthy thing that enters the estate, so
  the mechanic that obtains one must be the most explicit. This capability
  invokes only a declared provider with a declared model identity, declared
  parameters, and a declared response schema, and classifies everything it
  returns as model testimony that may not mint identity, claim admission, select
  a provider, or weaken proof.

  Failure modes are separated rather than merged. An authentication refusal, a
  timeout, provider unavailability, a malformed response, and a
  schema-incompatible response are each their own disposition, because
  collapsing them would make a provider outage indistinguishable from a model
  that answered badly.

  @scenario:bind-governed-model-connector
  @input:governed-model-connector-request
  @input-contract:governed-model-connector-request.v1
  @event:governed-model-connector-requested
  @event-authority:bind-governed-model-connector.v1
  @outcome:governed-model-connector-testimony
  @outcome-contract:governed-model-connector-testimony.v1
  @outcome-terminal
  Scenario: Return schema-bound model testimony with a typed provider disposition
    Given a declared provider binding, model identity, parameters, and response schema
    When the declared provider is invoked exactly as bound
    Then the response is returned as model testimony against its declared schema, every provider failure mode carries its own disposition, and no result claims identity, admission, or proof
