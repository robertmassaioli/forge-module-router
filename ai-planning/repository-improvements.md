# Repository Improvement Opportunities

A prioritised list of improvements spanning functional, security, documentation,
testing, tooling, and developer-experience areas. Each item includes the motivation,
the affected files, and a rough effort estimate.

---

## 1. Type `environmentType` properly instead of casting to `any`

**Area:** Type safety / correctness  
**Priority:** High

`context.environmentType` is returned by Forge at runtime but is absent from
`@forge/bridge`'s `FullContext` TypeScript interface. The current workaround is:

```ts
const ctx = context as unknown as Record<string, unknown>;
const environmentType = ctx['environmentType'] as string | undefined;
```

This suppresses type errors but loses all safety. The proper fix has two parts:

1. **Extend the local `ForgeContext` type** in `src/types.ts` to augment
   `FullContext` with the missing field:
   ```ts
   export type ForgeContext = FullContext & {
     environmentType?: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
   };
   ```
2. **File an upstream issue** against `@forge/bridge` to add `environmentType`
   to `FullContext`, and remove the local augmentation once merged.

**Files:** `src/types.ts`, `src/ContextRouter.tsx`  
**Effort:** Small

---

## 2. Add a `CHANGELOG.md`

**Area:** Documentation / release management  
**Priority:** High

The project has no changelog. Consumers upgrading between patch/minor/major
versions have no way to understand what changed without reading raw git diffs.
A `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/)
conventions should be added and kept up-to-date with each release. The
`publish.yml` GitHub Actions workflow is a natural place to enforce this — the
release job could fail if the changelog has not been updated for the new version.

Backfill entries for `v1.0.0` through `v1.1.0` from git log.

**Files:** `CHANGELOG.md` (new), optionally `.github/workflows/publish.yml`  
**Effort:** Small (backfill) + ongoing discipline

---

## 3. Expose `onError` feedback when `view.getContext()` fails permanently

**Area:** Functional / error handling  
**Priority:** High

When `view.getContext()` rejects, `ForgeContextProvider` calls `onError` and
logs to console, but the component remains permanently stuck rendering
`fallback`. The consumer has no way to distinguish "still loading" from
"failed to load" — they see the same fallback UI indefinitely.

Introduce a second optional prop `errorFallback` (or a second argument to
`onError` that sets an error state) so the provider can render a distinct
error UI:

```tsx
<ForgeContextProvider
  fallback={<Spinner />}
  errorFallback={<p>Failed to load app context. Please refresh.</p>}
>
```

Alternatively, expose the error state via `useForgeContext()` or a separate
`useForgeContextStatus()` hook.

**Files:** `src/ViewContext.tsx`, `src/types.ts`  
**Effort:** Medium

---

## 4. Add an `engines` field to `package.json`

**Area:** Security / correctness  
**Priority:** Medium

`package.json` has no `engines` field. The library targets ES2017 and uses
Node 20 in CI (`ci.yml`), but consumers running older Node versions will get
no warning before installing. Add:

```json
"engines": {
  "node": ">=18.0.0"
}
```

This aligns with Node 18 LTS (the oldest version still receiving security
updates as of 2026) and prevents accidental use on EOL runtimes. The CI
workflow already pins Node 20; this documents the minimum for consumers.

**Files:** `package.json`  
**Effort:** Trivial

---

## 5. Add code coverage enforcement to CI

**Area:** Testing / CI  
**Priority:** Medium

The project has `@vitest/coverage-v8` installed as a devDependency but no
coverage script or CI enforcement. There is no minimum threshold, so test
coverage can silently regress. Add:

- A `test:coverage` npm script: `vitest run --coverage`
- A coverage configuration in `vitest.config.mts` with per-file thresholds:
  ```ts
  coverage: {
    provider: 'v8',
    thresholds: { lines: 90, functions: 90, branches: 85 },
    include: ['src/**'],
  }
  ```
- Run `test:coverage` in `ci.yml` and upload the report as a CI artefact.

**Files:** `vitest.config.mts`, `package.json`, `.github/workflows/ci.yml`  
**Effort:** Small

---

## 6. Run the peer-dependency matrix in CI (not just weekly)

**Area:** Testing / CI  
**Priority:** Medium

`matrix.yml` runs peer-dependency compatibility tests only on a weekly
schedule (and on manual dispatch). This means a breaking peer-dependency
incompatibility introduced by a PR won't be caught until the next Monday.
Run at least the "quick" matrix subset (`test:matrix:quick` — combinations
M1, M2, M6) as part of the standard CI pipeline on every PR that touches
`src/` or `package.json`.

**Files:** `.github/workflows/ci.yml`, `.github/workflows/matrix.yml`  
**Effort:** Small

---

## 7. Guard `SpaRouter` against usage outside full-page Forge modules

**Area:** Functional / developer experience  
**Priority:** Medium

`SpaRouter` calls `view.createHistory()` which is only available in specific
Forge modules (`jira:globalPage`, `confluence:globalPage`, etc.). If used in
an unsupported module (e.g. a panel or macro), it falls back to in-memory
history silently — which means the browser URL bar doesn't update and
back/forward buttons don't work, with no explanation to the developer.

Add a `console.warn` (or optionally a thrown `ForgeRouterError`) when
`createHistory()` fails with an error indicating the module type is
unsupported, distinct from the existing generic catch-and-fallback path:

```ts
.catch((err) => {
  if (isUnsupportedModuleError(err)) {
    console.warn('[forge-module-router] SpaRouter: view.createHistory() is not ' +
      'available in this module type. Falling back to in-memory history. ' +
      'SpaRouter is only supported in full-page modules (e.g. jira:globalPage).');
  }
  setNavigator(createMemoryHistory());
});
```

**Files:** `src/SpaRouter.tsx`  
**Effort:** Small

---

## 8. Add a `renovate.json` (or `dependabot.yml`) for automated dependency updates

**Area:** Security / maintenance  
**Priority:** Medium

The repository has no automated dependency update configuration. Security
vulnerabilities in devDependencies (e.g. `vitest`, `tsup`, `@forge/bridge`)
will not generate PRs automatically. Add a `renovate.json` at the repo root
to enable Renovate Bot with a sensible schedule and grouping strategy:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "schedule": ["before 9am on Monday"],
  "packageRules": [
    { "matchDepTypes": ["devDependencies"], "automerge": true },
    { "matchDepTypes": ["peerDependencies"], "enabled": false }
  ]
}
```

Peer dependencies are intentionally excluded from auto-update since their
ranges are the contract with consumers. Dev dependency patches can be
safely auto-merged once CI is green.

**Files:** `renovate.json` (new)  
**Effort:** Trivial

---

## 9. Expand the test-matrix fixture coverage

**Area:** Testing  
**Priority:** Medium

The test-matrix currently has a single `basic/` fixture that covers only a
minimal happy-path scenario (context resolution and basic rendering). It does
not exercise:

- `ContextRoute` with `modalType` or `noModal` filtering
- `SpaRouter` navigation (back/forward)
- Multiple `ContextRoute` instances in the same tree
- The `onError` fallback path

Add additional fixture scenarios (`modal-routing/`, `spa-navigation/`,
`multi-module/`) each with their own `package.json` so they can be included
in the matrix runner. This ensures that the full public API works correctly
across all supported peer dependency combinations, not just basic rendering.

**Files:** `test-matrix/fixtures/` (new fixture directories)  
**Effort:** Medium

---

## 10. Add npm provenance and publish verification to the release workflow

**Area:** Security / supply chain  
**Priority:** Medium

`publish.yml` already passes `--provenance` to `npm publish`, which is good.
However, the workflow does not verify the published package after publication.
Add a post-publish verification step that installs the newly published version
in a clean environment and runs a smoke-test import to confirm the package is
installable and its main exports resolve:

```yaml
- name: Verify published package
  run: |
    mkdir /tmp/smoke && cd /tmp/smoke
    npm init -y
    npm install forge-module-router@${{ env.VERSION }}
    node -e "require('forge-module-router')"
```

This catches accidental publication of a broken build (e.g. missing `dist/`
files, malformed `package.json` `exports` map) before consumers encounter it.

**Files:** `.github/workflows/publish.yml`  
**Effort:** Small

---

## 11. Document the `environmentType` behaviour and custom environment caveats in the README

**Area:** Documentation  
**Priority:** Medium

The README's `ContextRoute` API reference documents the `moduleKey` prop as
performing an exact match, but since v1.1.0 it now performs a prefix-match in
non-production environments. This is a behaviour change that is not yet
reflected in the docs. Add a dedicated subsection explaining:

- Why the prefix-match exists (Forge appends environment suffixes)
- What suffixes are handled (built-in and arbitrary custom environments)
- The `console.warn` that fires on prefix-match and what it means
- The potential ambiguity risk for manifest keys that share a hyphen-prefix
  relationship, and how to avoid it
- A table of example moduleKey values across environments

**Files:** `README.md`  
**Effort:** Small

---

## 12. Add a `tsconfig.test.json` so tests are type-checked in CI

**Area:** Type safety / CI  
**Priority:** Low–Medium

`tsconfig.json` explicitly excludes test files (`**/*.test.ts`,
`**/*.test.tsx`). This means test code is never type-checked by `npm run lint`
(which runs `tsc --noEmit`). Type errors in tests — including incorrect mock
shapes, wrong hook arguments, or outdated context types — are silently ignored.

Add a `tsconfig.test.json` that extends the main config, includes the `test/`
directory, and adds `@testing-library/jest-dom` types:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

Add `tsc --project tsconfig.test.json --noEmit` to the `lint` script or as a
separate `lint:test` script run in CI.

**Files:** `tsconfig.test.json` (new), `package.json`, `.github/workflows/ci.yml`  
**Effort:** Small

---

## 13. Replace the `as never` casts in `SpaRouter` with proper types

**Area:** Type safety  
**Priority:** Low

`SpaRouter.tsx` contains several brittle `as never` and `as unknown` casts
to work around mismatches between the `history` package's type signatures and
the Forge bridge's runtime API:

```ts
history.listen(onForgeUpdate as never)
// and
<Router navigator={navigator as never} ...>
```

These suppress genuine type incompatibilities rather than resolving them.
The correct fix is to:

1. Define a local `ForgeHistory` interface that matches the shape of the
   object returned by `view.createHistory()` at runtime.
2. Cast once at the boundary where Forge's object enters the library, with
   a comment explaining the impedance mismatch.
3. Use proper types internally throughout `SpaRouter`.

This makes future type errors visible (e.g. if `@forge/bridge` changes the
history API shape) rather than silently passing.

**Files:** `src/SpaRouter.tsx`, potentially `src/types.ts`  
**Effort:** Medium

---

## Summary table

| # | Improvement | Area | Effort | Status |
|---|-------------|------|--------|--------|
| 1 | Type `environmentType` properly | Type safety | Small | ⬜ Todo |
| 2 | Add `CHANGELOG.md` | Docs | Small | ✅ Done |
| 3 | Expose error state from `ForgeContextProvider` | Functional | Medium | ⬜ Todo |
| 4 | Add `engines` field to `package.json` | Security | Trivial | ✅ Done |
| 5 | Add coverage enforcement to CI | Testing | Small | ⬜ Todo |
| 6 | Run matrix in CI on every PR | Testing / CI | Small | ⬜ Todo |
| 7 | Warn when `SpaRouter` used in unsupported module | Functional | Small | ⬜ Todo |
| 8 | Add `renovate.json` for automated dep updates | Security | Trivial | ⬜ Todo |
| 9 | Expand test-matrix fixture coverage | Testing | Medium | ⬜ Todo |
| 10 | Add post-publish smoke test to release workflow | Security | Small | ⬜ Todo |
| 11 | Document prefix-match behaviour in README | Docs | Small | ✅ Done |
| 12 | Type-check test files in CI | Type safety | Small | ⬜ Todo |
| 13 | Replace `as never` casts in `SpaRouter` | Type safety | Medium | ⬜ Todo |
