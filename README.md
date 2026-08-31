# sda-bootstrap

The single portable Node.js bootstrap for operating and delivering a SideFX
capability capsule estate.

## Usage

Run commands from the root of the consuming Harness repository:

```bash
sda-bootstrap verify
sda-bootstrap resolve
sda-bootstrap expand <disposable-target>
sda-bootstrap direct <capability-id>
sda-bootstrap invoke <capability-id>
sda-bootstrap sterile-proof
sidefx-capsules-mcp
sidefx-api
```

The consuming repository provides only `capsules/capsule-estate.manifest.json`
and the `.sfxcap` files named by that manifest. The package derives estate
identity and size from those durable authorities; no consuming `bootstrap/`
directory or expanded capability tree is required.

`sidefx-capsules-mcp` obtains its server identity, protocol version, tool
catalog, schemas, annotations, and result representation by invoking the
capsule-carried `deliver-capsule-estate-mcp` capability. `sidefx-api` obtains
its loopback host, port, and route catalog by invoking the capsule-carried
`deliver-realization-api` capability. Both adapters own transport mechanics
only and route operations through the shared capsule manager.

Expansion requires an explicit disposable target and rejects the consuming
repository itself as the destination. The package includes its pinned SDA Node
runtime and projector platform, so no sibling repository or machine-local
platform folder is required.
