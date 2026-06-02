# Third-party assets

This directory holds 3D mesh assets (GLB / GLTF) consumed by the viewer's
visual registry. No assets are committed yet — this file establishes the
license-tracking convention used by future tickets.

## License conventions

- **CC0 1.0** — public-domain dedication, no attribution required. Safe to
  commit and redistribute. Preferred source.
- **CC-BY 4.0** — attribution required. The attribution string must be
  surfaced in the viewer's credits UI when these assets are bundled.
- Anything else (CC-BY-SA, commercial-only, no-license) requires explicit
  reviewer approval before being added to the repo.

## Asset registry

| File | Source URL | Author | License | SHA-256 |
| ---- | ---------- | ------ | ------- | ------- |
| _(none yet)_ | | | | |

## Recommended sources

- **Kenney** (https://kenney.nl) — Car Kit, City Kit, Mini Characters, Traffic
  Kit. CC0. Low-poly GLB; first-choice source.
- **Quaternius** (https://quaternius.com) — Ultimate Modular Cars, Ultimate
  Modular Characters. CC0.
- **Poly Pizza** (https://poly.pizza) — aggregator; filter by CC0.

## Adding an asset

1. Verify the license is CC0 or CC-BY 4.0.
2. Drop the GLB under the appropriate subdirectory
   (`ego/`, `vehicles/`, `actors/`, `props/`).
3. Compute the SHA-256 and add a row to the registry table above.
4. Add an `asset` field to the matching entry in
   `frontend/src/rendering/visuals/registry.ts`, specifying `nativeLengthM`
   and `nativeForwardAxis` so the loader can normalize scale and orientation.
