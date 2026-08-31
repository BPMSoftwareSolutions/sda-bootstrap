@capability:bind-governed-http-exchange
@root-scenario:bind-governed-http-exchange
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#observeGovernedHttpExchange
Feature: Perform one governed HTTP exchange under a declared effect scope

  An HTTP call is an external effect with a security model, and that model is
  currently expressed as runtime code rather than as authority. This capability
  owns it explicitly: the endpoint, permitted methods, permitted request and
  response headers, response size ceiling, timeout, redirect policy, and
  cancellation behaviour are all declared before the exchange, and anything
  outside them is refused rather than trimmed to fit.

  The exchange returns transport testimony with its own disposition, so a
  timeout, a refusal, and a genuine response are distinguishable rather than
  collapsed into one failure. Redaction is part of the testimony, not an
  afterthought: whatever the declared policy marks as sensitive never appears in
  a receipt.

  @scenario:bind-governed-http-exchange
  @input:governed-http-exchange-request
  @input-contract:governed-http-exchange-request.v1
  @event:governed-http-exchange-requested
  @event-authority:bind-governed-http-exchange.v1
  @outcome:governed-http-exchange-observation
  @outcome-contract:governed-http-exchange-observation.v1
  @outcome-terminal
  Scenario: Exchange within declared bounds and report a typed transport disposition
    Given a declared endpoint authority, permitted methods and headers, and declared size, timeout, and redirect bounds
    When the exchange is performed within every declared bound
    Then redacted transport testimony carries one typed disposition, and any method, header, size, or redirect outside the declared bounds is refused rather than truncated
