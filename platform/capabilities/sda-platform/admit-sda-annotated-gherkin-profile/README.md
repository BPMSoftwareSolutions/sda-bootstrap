# Admit the annotated SDA Gherkin profile

This admitted capability owns profile interpretation of losslessly parsed
Gherkin. Its scenarios cover admission, held grammar constructs, annotation
errors, owner-scoped identity, and forbidden semantic content. The versioned
profile and its schema are capability-local authority.

The target-neutral provider is implemented at
`tools/src/gherkin/application/canonical-gherkin-compiler.ts`; its admission
is bound to the pinned official grammar and the complete conformance receipt
owned by `verify-gherkin-compiler-conformance`.
