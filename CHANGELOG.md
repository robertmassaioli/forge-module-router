# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `ContextRoute` now performs a prefix-match on `moduleKey` in non-production
  Forge environments, handling the environment suffix that Atlassian appends to
  module keys (e.g. `-dev`, `-stg`, `-local`, and arbitrary custom environment
  names such as `-alice` or `-my-feature-branch`). Exact-match behaviour in
  production is unchanged. A `console.warn` is emitted whenever the prefix-match
  path is taken, to alert developers to potential ambiguity between manifest
  module keys that share a hyphen-prefix relationship.

### Fixed
- Removed a `process.env.NODE_ENV` guard from `ContextRouter.tsx` that was
  referencing `process.env`, which is not available in the Forge Custom UI
  browser runtime. The guard was also redundant — the `console.warn` is only
  reachable when `environmentType` is explicitly non-`PRODUCTION`.

---

## [1.0.4] — 2026-04-24

### Changed
- README rewritten to more clearly frame the two core value propositions:
  SPA routing for full-page apps and a single frontend bundle for multiple
  Forge modules.

### Fixed
- Test suite scoped correctly to `test/` only in `vitest.config.mts`.
- Resolved `act()` warnings in `SpaRouter` tests.

### Added
- Peer dependency version matrix integration test suite covering React 16–18,
  `react-router-dom` 6.0.0 through latest, and `@forge/bridge` 3.3.0 through
  latest across 8 combinations.
- Forge history tests and extended troubleshooting documentation in README.
- Peer dependency compatibility analysis in `ai-planning/`.

---

## [1.0.3] — 2026-04-21

### Fixed
- Split Forge and in-memory history listener signatures to resolve a type
  mismatch between the `@forge/bridge` history API and the `history` package's
  listener callback shape. This fixes a runtime error when navigating in
  environments where Forge history is available.
- Correct Forge history listener callback signature (previous fix was
  incomplete).

---

## [1.0.2] — 2026-04-20

### Changed
- React peer dependency lower bound lowered from `>=17.0.0` to `>=16.8.0`,
  enabling use in apps still on React 16 (hooks were introduced in 16.8).

### Fixed
- CI publish workflow now correctly sets the npm package version from the
  GitHub release tag before publishing, ensuring the published version always
  matches the git tag.

---

## [1.0.1] — 2026-04-17

### Changed
- License changed from ISC to MIT. `LICENSE` file added to the repository.

### Fixed
- Added `repository` field to `package.json` to enable npm provenance
  attestation during publish.

---

## [1.0.0] — 2026-04-17

Initial public release.

### Added
- `<ForgeContextProvider>` — fetches Forge view context via `view.getContext()`
  and makes it available to the component tree. Renders an optional `fallback`
  until context resolves.
- `useForgeContext()` — hook to read the current `ForgeContext`; throws a
  `ForgeContextError` with a clear message if called outside a provider.
- `<ContextRoute>` — conditionally renders children based on `moduleKey`,
  `modalType`, and/or `noModal` matching the current Forge context. All props
  are optional wildcards.
- `<SpaRouter>` — drop-in React Router `<Router>` wrapper wired to Forge's
  `view.createHistory()` API, with automatic fallback to in-memory history for
  local development and testing. Creates history exactly once on mount.
- `<Link>` — client-side navigation link for use inside `<SpaRouter>`.
- `ForgeContextError` — error class thrown by `useForgeContext()` when used
  outside a provider.
- GitHub Actions CI workflow: type-check, test, and build on every push and PR.
- GitHub Actions publish workflow: build, test, set version from tag, and
  publish to npm with provenance on GitHub release.
- Initial test suite: 38 tests across `errors`, `ViewContext`, `ContextRouter`,
  and `SpaRouter` + `Link`.
- `.npmrc` configured to use the public npm registry.

[Unreleased]: https://github.com/robertmassaioli/forge-module-router/compare/v1.0.4...HEAD
[1.0.4]: https://github.com/robertmassaioli/forge-module-router/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/robertmassaioli/forge-module-router/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/robertmassaioli/forge-module-router/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/robertmassaioli/forge-module-router/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/robertmassaioli/forge-module-router/releases/tag/v1.0.0
