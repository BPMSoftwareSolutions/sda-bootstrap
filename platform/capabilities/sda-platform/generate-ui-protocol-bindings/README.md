# Generate UI protocol bindings

One digest-bound model generates native v3 protocol and plan types for all
eight repository language ecosystems: TypeScript, C#, Java, Kotlin, Swift,
C++, Python, and Go. Generated sources include protocol identity constants,
closed capability/evidence enums, immutable contract shapes, and canonical
UTF-8 digest helpers.

Deterministic source equivalence and mirror-sterility checks are executable in
`tools/tests/conformance/ui-protocol-bindings-v3.test.js`. TypeScript, C#,
Java, Python, and Go compile locally on the current Windows toolchain. Kotlin,
Swift, and C++ compilation remains assigned to their configured platform CI
toolchains.
