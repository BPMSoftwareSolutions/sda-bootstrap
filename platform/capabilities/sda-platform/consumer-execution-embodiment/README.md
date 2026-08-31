# Consumer execution embodiment

`consumer-execution-embodiment-plan.v1` is the admitted immutable boundary
between consumer semantic compilation and a language runtime.

The compiler resolves scenario topology, execution authority, platform
providers, transition projection, and static conformance before a target is
invoked. A language embodiment verifies and applies the plan through its
registered mechanics; it does not load or reinterpret consumer capability or
conformance-query authority.

The first admitted plan applier is the Node consumer platform. The contract is
target-neutral so later language embodiments can apply the same plan shape.

## Composed-scenario candidate

`consumer-execution-embodiment-plan.v2` is a declarative protocol candidate
for `execute-composed-scenario-authority`. It retains typed `invoke-port`
operations and adds typed `invoke-scenario` operations that reference another
plan node. The existing `scenario-invocation` platform mechanic remains the
provider boundary; v2 does not introduce a duplicate event port.

The candidate fixes the composition policy at each plan boundary: the previous
admitted outcome is the next carrier, every intermediate contract is admitted,
root and parent execution lineage is retained, recursive invocation is
rejected, and execution stops at the first non-success. The acceptance fixture
partitions cover success and every governed stop declared by the canonical
feature.

The candidate is held. Node, C#, and Python must each receive a projected v2
plan compiler/runtime embodiment and pass the same deterministic fixtures
before this protocol or capability can be promoted. Gemini supplied only the
hash-bound candidate wording recorded in the capability authority; it supplied
no executable implementation and has no acceptance authority.
