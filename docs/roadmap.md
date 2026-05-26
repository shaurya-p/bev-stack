# Roadmap

1. **Schema + contracts** *(this milestone)* — canonical SceneFrame, Python package, TypeScript mirror, schema contract tests
2. **nuScenes mini adapter/exporter** — load nuScenes mini, convert samples to SceneFrame JSON, validate against contract tests
3. **First static web BEV render** — React + Vite app, Canvas/WebGL top-down BEV view of objects and ego position
4. **Camera panels + timeline** — image viewer, multi-camera layout, frame scrubbing
5. **Model-output providers** — plug in detector/tracker/BEV fusion model outputs alongside GT for side-by-side comparison
6. **Tracking, maps, and diagnostics** — trajectory trails, HD map overlays, diagnostics panel
