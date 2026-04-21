# Proposal: Version Matrix Integration Testing Suite

## Background

Recommendation 5 from `peer-dependency-compatibility.md`:

> Consider an integration test suite that runs against multiple versions of the peer
> dependencies (e.g., React 16 + react-router-dom 6.0.0, React 18 +
> react-router-dom 6.latest) using something like `npm pack` + separate test apps, to
> catch version-matrix issues before they reach consumers.

During ep-tool integration, two bugs were discovered that the existing test suite
(which only runs against React 18 + react-router-dom 6.latest) did not catch:

1. The Forge history listener was using the wrong callback signature.
2. The React peer dep lower bound was set to `>=17.0.0` despite the code being
   compatible with React 16.8.0.

A version matrix test suite would catch both categories of issue automatically.

---

## Goals

1. Verify that the published package works correctly across the declared peer dependency
   range — not just the latest versions used in dev.
2. Catch regressions when peer dependencies release new versions.
3. Run on CI (GitHub Actions) on every PR and on a weekly schedule (to catch upstream
   breakages).
4. Be lightweight enough to not significantly slow down the development workflow.

---

## Proposed matrix

The axes that matter most, based on the compatibility analysis:

| Axis | Versions to test | Rationale |
|------|-----------------|-----------|
| `react` + `react-dom` | 16.14.0, 17.0.2, 18.x (latest) | Lower bound, mid-range, latest |
| `react-router-dom` | 6.0.0, 6.latest | Lower bound + latest (v5 explicitly excluded) |
| `@forge/bridge` | 3.x (oldest), 5.x (latest) | Lower bound + latest |
| `history` | 5.0.0, 5.latest | Lower bound + latest |

Full cross-product would be 3 × 2 × 2 × 2 = 24 combinations. In practice, some are
redundant (e.g., React 16 + react-router-dom 6.latest is the most interesting case;
React 18 + react-router-dom 6.0.0 is less likely to reveal issues). A reduced practical
matrix of ~8 key combinations is proposed below.

### Reduced practical matrix

| ID | react | react-router-dom | @forge/bridge | Notes |
|----|-------|-----------------|---------------|-------|
| M1 | 16.14.0 | 6.0.0 | latest | Oldest supported combination |
| M2 | 16.14.0 | 6.latest | latest | React 16 + modern router (ep-tool scenario) |
| M3 | 17.0.2 | 6.0.0 | latest | React 17 + oldest router |
| M4 | 17.0.2 | 6.latest | latest | React 17 + modern router |
| M5 | 18.latest | 6.0.0 | latest | React 18 + oldest router |
| M6 | 18.latest | 6.latest | latest | Current dev environment (already tested) |
| M7 | 16.14.0 | 6.latest | 3.x | Oldest bridge |
| M8 | 18.latest | 6.latest | 3.x | Latest React + oldest bridge |

---

## Implementation approach

### Step 1: Pack the package

Rather than testing the source directly (which would mask bundling issues), use
`npm pack` to produce a `.tgz` tarball of the built package, then install it into each
test fixture. This ensures the test exercises what consumers actually receive.

```bash
npm run build
npm pack  # produces forge-module-router-x.y.z.tgz
```

### Step 2: Test fixture apps

Create minimal fixture apps under `test-matrix/fixtures/`. Each fixture is a tiny
React app that exercises the full public API:

```
test-matrix/
  fixtures/
    basic/
      src/
        App.tsx        # Uses ForgeContextProvider, ContextRoute, SpaRouter, Link
      package.json     # No version pins — versions injected by the matrix runner
      tsconfig.json
  runner/
    run-matrix.ts      # Orchestrates installs and test runs
  results/
    .gitkeep
```

The fixture `package.json` uses placeholder version strings that the runner replaces:

```json
{
  "dependencies": {
    "forge-module-router": "file:../../forge-module-router-VERSION.tgz",
    "react": "REACT_VERSION",
    "react-dom": "REACT_VERSION",
    "react-router-dom": "REACT_ROUTER_VERSION",
    "@forge/bridge": "BRIDGE_VERSION"
  }
}
```

### Step 3: Test content

Each fixture test does three things:

1. **Render test** — Renders `<ForgeContextProvider>` with a mocked `view.getContext()`
   and asserts children appear.
2. **ContextRoute test** — Verifies `<ContextRoute moduleKey>` correctly shows/hides
   content based on the mocked context.
3. **SpaRouter navigation test** — Renders `<SpaRouter>` with two routes, fires a
   navigation event via the mocked Forge history (using the v4 two-arg signature), and
   asserts the correct route is shown.

These are the same scenarios as the existing unit tests, but run against the installed
package rather than the source — and against specific peer dep versions.

### Step 4: Matrix runner script

A Node.js/TypeScript script (`test-matrix/runner/run-matrix.ts`) that:

1. Builds and packs the package.
2. For each matrix combination:
   a. Copies the fixture to a temp directory.
   b. Substitutes version strings into `package.json`.
   c. Runs `npm install --legacy-peer-deps`.
   d. Runs the fixture tests (via vitest or a minimal jsdom script).
   e. Records pass/fail.
3. Prints a summary table and exits non-zero if any combination failed.

```
[M1] react@16.14.0 + react-router-dom@6.0.0 + bridge@latest  ✅ PASS
[M2] react@16.14.0 + react-router-dom@6.latest + bridge@latest ✅ PASS
[M3] react@17.0.2  + react-router-dom@6.0.0 + bridge@latest  ✅ PASS
...
[M8] react@18.x    + react-router-dom@6.latest + bridge@3.x  ✅ PASS

8/8 matrix combinations passed.
```

### Step 5: GitHub Actions workflow

A new workflow file `.github/workflows/matrix.yml`:

```yaml
name: Version Matrix

on:
  pull_request:
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday morning

jobs:
  matrix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
      - run: npx tsx test-matrix/runner/run-matrix.ts
```

Running on a schedule (weekly) is important because upstream peer dependency releases
can break the package without any code change on our part.

---

## What this would have caught

Had this suite existed:

| Issue | Would have been caught by |
|-------|--------------------------|
| `>=17.0.0` peer dep too high | M1, M2 (React 16 combinations would fail) |
| Forge history listener wrong signature | M1–M8 (SpaRouter navigation test would fail on all) |
| react-router-dom singleton issue | Would manifest in M1–M6 if fixture bundling is naive — though this is a dev/link issue, not a version issue |

---

## Effort estimate

| Task | Estimate |
|------|----------|
| Create fixture app | 2–3 hours |
| Write matrix runner script | 2–3 hours |
| Write GitHub Actions workflow | 30 minutes |
| Initial matrix run + fixes | 1–2 hours |
| **Total** | **~6–8 hours** |

---

## Alternatives considered

### Alternative A: `jest-environment-jsdom` with `peerDependencies` swapping

Use `npm install --save-exact react@16.14.0` inside the existing package and re-run
tests. Simpler, but tests the source rather than the built package — misses bundling
issues. Also requires careful cleanup between runs.

**Verdict:** Useful as a quick check but insufficient as a full solution.

### Alternative B: Separate published fixture packages

Publish tiny test fixture packages to npm and test against specific combinations in CI.
More realistic (tests against a real npm install) but significantly more infrastructure
overhead.

**Verdict:** Overkill for a package of this size.

### Alternative C: `verdaccio` local registry

Run a local npm registry in CI and publish the package to it, then install from it in
fixture apps. More realistic than `npm pack` but adds significant CI complexity.

**Verdict:** Consider in the future if the matrix suite grows in complexity.

---

## Recommendation

Implement the `npm pack` + fixture approach (Steps 1–5 above). It strikes the right
balance between realism and simplicity. The weekly scheduled run provides an early
warning system for upstream breakages, and the PR check prevents regressions from being
merged.

Start with matrix combinations M1, M2, and M6 (the most divergent: oldest, ep-tool
scenario, and current dev environment) to get coverage quickly, then expand to the full
8-combination matrix.
