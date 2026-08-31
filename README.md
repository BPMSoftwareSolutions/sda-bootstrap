# sda-bootstrap

Portable Node.js bootstrap CLI for operating a SideFX capability capsule estate.

## Usage

Run commands from the root of the consuming Harness repository:

```bash
sda-bootstrap verify
sda-bootstrap resolve
sda-bootstrap expand <disposable-target>
sda-bootstrap direct <capability-id>
sda-bootstrap invoke <capability-id>
sda-bootstrap sterile-proof
```

The consuming repository must provide `bootstrap/bootstrap.manifest.json` and
the capsule estate referenced by that manifest. Expansion requires an explicit
target and rejects the consuming repository itself as the destination. The
package includes its pinned SDA Node runtime and projector platform, so a
consumer can use `package:sda-bootstrap/platform` without a sibling repository
or machine-local folder dependency.
