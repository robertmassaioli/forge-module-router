# Peer Dependency Compatibility Analysis

## Background

`forge-module-router` declares the following peer dependencies:

```json
"@forge/bridge": ">=3.0.0",
"history": ">=5.0.0",
"react": ">=16.8.0",
"react-dom": ">=16.8.0",
"react-router-dom": ">=6.0.0"
```

During integration with `ep-tool` (which uses React 16 and Atlaskit components), several
compatibility issues were discovered that were not caught by the package's own test suite
(which runs against React 18 and react-router-dom v6). This document analyses each peer
dependency axis and identifies where the current implementation may break across different
versions.

---

## 1. `react` — `>=16.8.0`

### What the code uses

| API | Introduced | Notes |
|-----|-----------|-------|
| `useState` | 16.8.0 | Used in `ForgeContextProvider`, `SpaRouter` |
| `useEffect` | 16.8.0 | Used in `ForgeContextProvider`, `SpaRouter` |
| `useContext` | 16.8.0 | Used in `useForgeContext` |
| `useRef` | 16.8.0 | Used in `SpaRouter` |
| `createContext` | 16.3.0 | Used in `ViewContext.tsx` |
| `<>…</>` fragments | 16.2.0 | Used throughout |
| `React.ReactNode` | All versions | Type only |

### Verdict: ✅ Safe across React 16.8.0+

No React 17 or 18 specific APIs are used in the runtime code. The dev/test environment
uses React 18 (`@testing-library/react ^14` requires it), but nothing in `dist/` depends
on React 18 features.

### Known risk: duplicate React instances

When using `npm link` for local development, if `forge-module-router` and the consumer
app each resolve their own copy of React, hooks will crash with "Invalid hook call". This
is not a version compatibility issue per se, but it is a common pitfall when the package
is linked locally. The standard fix is to symlink the consumer's React into
`forge-module-router/node_modules/react` during local development.

### React 17 note

React 17 introduced the new JSX transform (no need to `import React`). The package
currently imports React explicitly in all files, which is compatible with both the old
and new JSX transform. No change needed, but the explicit imports could be removed if
the minimum is ever raised to 17+.

---

## 2. `react-dom` — `>=16.8.0`

### What the code uses

`react-dom` is declared as a peer dependency but is **not directly imported** anywhere
in the package source. It is only required transitively (React DOM must be present for
React to render). The peer dep declaration exists to ensure the consumer provides a
compatible version alongside `react`.

### Verdict: ✅ No compatibility risk

No `react-dom` APIs are called directly. The declaration is correct and can safely
remain at `>=16.8.0`.

---

## 3. `react-router-dom` — `>=6.0.0`

This is the highest-risk dependency axis.

### What the code uses

#### `SpaRouter.tsx`
```tsx
import { Router, useNavigate } from 'react-router-dom';
```

- **`<Router navigator navigationType location>`** — This is the **internal low-level
  Router API** introduced in react-router-dom v6. It does not exist in v5 at all (v5
  uses `<Router history={…}>`). Consumers on v5 will get a crash immediately.

- **`useNavigate()`** — v6 only. The v5 equivalent is `useHistory()`.

#### `ContextRouter.tsx` and `ViewContext.tsx`
No react-router-dom imports. ✅

### Compatibility matrix

| react-router-dom version | `<Router navigator …>` | `useNavigate` | Status |
|--------------------------|------------------------|---------------|--------|
| v5.x | ❌ Does not exist | ❌ Does not exist | **Broken** |
| v6.0–v6.3 | ✅ Available | ✅ Available | ✅ Works |
| v6.4+ (Data Router era) | ✅ Available | ✅ Available | ✅ Works |
| v7.x (if released) | ⚠️ Unknown | ⚠️ Unknown | Needs testing |

### Verdict: ⚠️ v6.0.0 minimum is correct but must be enforced

The declared minimum of `>=6.0.0` is accurate — v5 will not work. However, the package
was also discovered to cause a `useRoutes() may only be used in the context of a <Router>`
crash when `react-router-dom` was duplicated (i.e., the package and the consumer resolved
different instances). This is the same duplicate-singleton problem as React — both the
`<Router>` context provider and the `<Routes>` consumer must come from the **same
react-router-dom instance**.

### react-router-dom v6 internal API stability risk

`<Router navigator navigationType location>` is intentionally not part of the public API
surface of react-router-dom. It is used by higher-level routers like `<BrowserRouter>`
internally. There is a risk that a future v6 minor or v7 breaking change could alter or
remove these props.

**Recommendation:** Monitor react-router-dom changelog for changes to the internal
`<Router>` component. Consider adding an integration test that exercises full navigation
so a breakage would be caught immediately on dependency upgrade.

---

## 4. `history` — `>=5.0.0`

### What the code uses

```ts
import { createMemoryHistory } from 'history';
import type { Action, Location } from 'history';
```

`createMemoryHistory` is used only as a **fallback** when `view.createHistory()` is
unavailable (local dev / test environments).

### Key finding: Forge uses history v4 listener signature

During integration testing, it was discovered that `view.createHistory()` from
`@forge/bridge` returns a history object whose **listener uses the history v4 signature**:

```js
// history v4 / Forge's view.createHistory():
history.listen((location, action) => { … })  // two positional args
```

Whereas `history` v5 stable uses:

```js
// history v5:
history.listen(({ location, action }) => { … })  // single object arg
```

The package now correctly handles both with separate typed callbacks (`onForgeUpdate` for
Forge's history, `onMemoryUpdate` for the v5 `createMemoryHistory` fallback). However,
this dual-signature situation should be clearly documented and tested.

### Compatibility matrix

| history version | `createMemoryHistory` listener signature | Used in |
|----------------|------------------------------------------|---------|
| v4.x | `(location, action)` | Forge's `view.createHistory()` returns this style |
| v5.x | `({ location, action })` | The `createMemoryHistory()` fallback |

### Verdict: ⚠️ Works, but fragile

The `>=5.0.0` peer dep is correct for the `createMemoryHistory` fallback. However,
if Forge ever updates `view.createHistory()` to emit v5-style listener callbacks, the
`onForgeUpdate` handler would silently break (it would receive `undefined` for `action`).

**Recommendation:** Add a comment in the source and a note in the README clearly stating
that Forge's history API uses v4-style callbacks. Add a test that mocks
`view.createHistory()` with the correct two-argument listener signature to prevent
regression.

---

## 5. `@forge/bridge` — `>=3.0.0`

### What the code uses

```ts
import { view } from '@forge/bridge';
// view.getContext()
// view.createHistory()
```

### Known API surface

- `view.getContext()` — stable across all modern versions of `@forge/bridge`. Returns a
  `FullContext` object. The package re-exports `FullContext` as `ForgeContext` via types,
  so type changes in `@forge/bridge` will automatically flow through.

- `view.createHistory()` — available since `@forge/bridge` v3.x. Returns a history-like
  object with the v4 listener signature (see section 4 above).

### Verdict: ✅ Low risk

The package only uses two stable, long-lived APIs. The main risk is if Atlassian changes
the `view.createHistory()` listener signature in a future version (see section 4).

---

## 6. Cross-cutting concern: singleton dependencies

A recurring theme throughout integration was the **duplicate singleton problem**. React,
React DOM, and react-router-dom all rely on module-level singletons (context, hooks
dispatcher, router context). If a consumer's bundler resolves two separate copies of any
of these — which can happen with `npm link`, monorepos with hoisting issues, or bundlers
that don't deduplicate — the app will crash in ways that are hard to diagnose.

This is not unique to `forge-module-router` but is worth documenting as a known pitfall,
especially since Forge apps often involve complex build setups.

**Recommendation:** Add a "Troubleshooting" section to the README covering:
1. The duplicate React / react-router-dom problem and how to diagnose it
2. The `npm link` workaround (symlinking the consumer's copies)
3. A note that all peer dependencies must resolve to a single instance

---

## Summary table

| Peer dep | Declared minimum | Actual minimum | Risk level | Notes |
|----------|-----------------|----------------|------------|-------|
| `react` | `>=16.8.0` | `>=16.8.0` | 🟢 Low | All APIs introduced in 16.8.0 |
| `react-dom` | `>=16.8.0` | `>=16.8.0` | 🟢 Low | Not directly imported |
| `react-router-dom` | `>=6.0.0` | `>=6.0.0` | 🟡 Medium | Uses internal `<Router>` API; v5 will break; v7 unknown |
| `history` | `>=5.0.0` | `>=5.0.0` | 🟡 Medium | Forge uses v4 listener signature; both handled separately |
| `@forge/bridge` | `>=3.0.0` | `>=3.0.0` | 🟢 Low | Only `view.getContext()` and `view.createHistory()` used |

---

## Recommended actions

1. **Add tests that mock `view.createHistory()`** with the two-argument listener
   signature to prevent regression if the internal Forge signature handling is ever
   changed.

2. **Add a troubleshooting section to the README** covering the duplicate singleton
   problem.

3. **Monitor react-router-dom v7** — if/when it releases, verify that the internal
   `<Router navigator navigationType location>` API is still available or adapt
   `SpaRouter` to use a different approach.

4. **Consider adding a `peerDependenciesMeta` section** to `package.json` to mark any
   optional peer deps as optional, and potentially add `react-router-dom` version range
   comments explaining why v5 is excluded.

5. **Consider an integration test suite** that runs against multiple versions of the
   peer dependencies (e.g., React 16 + react-router-dom 6.0.0, React 18 +
   react-router-dom 6.latest) using something like `npm pack` + separate test apps, to
   catch version-matrix issues before they reach consumers.
