# Proposal: `allowedModuleKeys` on `ForgeContextProvider`

## Background

The current `ContextRoute` prefix-match implementation (introduced in v1.1.0)
solves the non-production environment suffix problem, but has two outstanding
issues:

1. **Unsuppressable `console.warn` noise.** The warn fires on every render of
   a matching `ContextRoute` in any non-production environment, even when
   everything is working correctly. There is no way to opt out of it.

2. **Conflict detection is best-effort.** The warn message _mentions_ the
   possibility of two module keys sharing a hyphen-prefix relationship, but it
   cannot actually detect whether a real conflict exists — it just fires
   unconditionally. A real conflict (e.g. both `my-macro` and `my-macro-v2`
   declared in the manifest) would silently render both routes with no
   additional signal beyond the same warn that appears in the non-conflict case.

Both problems stem from the same root cause: **`ContextRoute` has no knowledge
of the full set of module keys the app uses**. It can only see the single
`moduleKey` prop it was given, not the other routes in the tree.

## Proposed Solution

Add an optional `allowedModuleKeys` prop to `ForgeContextProvider`. When
provided, it declares the complete set of manifest module keys used by the app.
This enables two things:

1. **Upfront conflict validation** — on mount, the provider checks the declared
   keys for prefix ambiguities and throws a `ForgeModuleKeyConflictError` if
   any are found. This is eager, startup-time validation with a clear error
   message, before any routing occurs.

2. **Strict `ContextRoute` validation** — any `<ContextRoute moduleKey="...">` 
   whose key is not in the declared set throws a `ForgeContextError`, making
   typos and stale module keys immediately visible.

3. **Suppression of the `console.warn`** — because the provider has already
   validated that no prefix conflicts exist, the per-render warn in
   `moduleKeyMatches` becomes redundant and can be omitted when
   `allowedModuleKeys` is provided.

---

## API Design

### `ForgeContextProvider` — new prop

```ts
// src/types.ts
export interface ForgeContextProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: unknown) => void;
  /**
   * The complete list of manifest module keys used by this app.
   *
   * When provided:
   * - The provider validates on mount that no two keys share a hyphen-prefix
   *   relationship (which would cause ambiguous routing in non-production
   *   environments). A `ForgeModuleKeyConflictError` is thrown if a conflict
   *   is found.
   * - `<ContextRoute>` instances whose `moduleKey` is not in this list throw
   *   a `ForgeContextError` at render time, catching typos early.
   * - The per-render `console.warn` emitted by prefix-match is suppressed,
   *   since conflicts have already been ruled out at startup.
   *
   * @example
   * <ForgeContextProvider allowedModuleKeys={['paste-code-macro', 'my-panel']}>
   */
  allowedModuleKeys?: readonly string[];
}
```

### Usage

```tsx
import { ForgeContextProvider, ContextRoute } from 'forge-module-router';

function App() {
  return (
    <ForgeContextProvider
      fallback={<Spinner />}
      allowedModuleKeys={['paste-code-macro', 'gist-code-macro', 'my-panel']}
    >
      <ContextRoute moduleKey="paste-code-macro">
        <PasteCodeMacro />
      </ContextRoute>
      <ContextRoute moduleKey="gist-code-macro">
        <GistCodeMacro />
      </ContextRoute>
      <ContextRoute moduleKey="my-panel">
        <MyPanel />
      </ContextRoute>
    </ForgeContextProvider>
  );
}
```

---

## Behaviour

### On mount — conflict validation

When `allowedModuleKeys` is provided, `ForgeContextProvider` runs a startup
check before rendering children:

```ts
function validateAllowedModuleKeys(keys: readonly string[]): void {
  for (let i = 0; i < keys.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      if (i !== j && keys[j].startsWith(keys[i] + '-')) {
        throw new ForgeModuleKeyConflictError(keys[i], keys[j]);
      }
    }
  }
}
```

This runs **synchronously during render**, before any children mount, so the
error is caught immediately — not discovered the first time a particular
environment suffix happens to trigger the conflict.

**Example:** `allowedModuleKeys={['my-macro', 'my-macro-v2']}` throws:

```
ForgeModuleKeyConflictError: [forge-module-router] Conflicting manifest module
keys detected: "my-macro" is a hyphen-prefix of "my-macro-v2". In non-production
environments, <ContextRoute moduleKey="my-macro"> would also match when the
active module is "my-macro-v2". Rename one key so neither is a prefix of the
other (e.g. "my-macro-legacy" and "my-macro-next").
```

### At render time — strict `ContextRoute` validation

When the provider has an `allowedModuleKeys` list, any `<ContextRoute>` with a
`moduleKey` not in that list throws immediately:

```
ForgeContextError: [forge-module-router] <ContextRoute moduleKey="paste-cde-macro">
uses a moduleKey that is not in the allowedModuleKeys list declared on
<ForgeContextProvider>. Allowed keys: paste-code-macro, gist-code-macro, my-panel.
Did you make a typo?
```

This is surfaced via a React error boundary in development and surfaces as a
build-time-equivalent check that catches stale or mistyped keys.

### `console.warn` suppression

When `allowedModuleKeys` is provided and the startup conflict check passes,
the per-render `console.warn` in `moduleKeyMatches` is suppressed. The
`moduleKeyMatches` function receives a flag (or reads from context) indicating
that conflicts have been pre-validated:

```ts
function moduleKeyMatches(
  contextKey: string,
  context: Record<string, any>,
  propKey: string,
  conflictsValidated: boolean, // true when allowedModuleKeys was provided
): boolean {
  if (contextKey === propKey) return true;

  const environmentType = context['environmentType'] as string | undefined;

  if (
    environmentType !== undefined &&
    environmentType !== 'PRODUCTION' &&
    contextKey.startsWith(propKey + '-')
  ) {
    if (!conflictsValidated) {
      console.warn(/* existing message */);
    }
    return true;
  }

  return false;
}
```

When `allowedModuleKeys` is _not_ provided, the existing warn behaviour is
preserved exactly — no breaking change.

---

## Implementation Plan

### Internal context for passing validated keys downstream

`ForgeContextProvider` passes `allowedModuleKeys` down to `ContextRoute`
via a dedicated internal React context — separate from `ForgeContextInternal`
(which holds the Forge runtime context object and must remain unchanged):

```ts
// Internal — never exported publicly
const AllowedModuleKeysContext = createContext<ReadonlySet<string> | null>(null);
// null = no allowedModuleKeys declared (warn mode)
// Set  = allowedModuleKeys declared and conflict-validated (strict + no-warn mode)
```

`ForgeContextProvider` populates this after the startup validation passes:

```tsx
const allowedSet = allowedModuleKeys ? new Set(allowedModuleKeys) : null;
// validateAllowedModuleKeys throws before we get here if there's a conflict
return (
  <ForgeContextInternal.Provider value={context}>
    <AllowedModuleKeysContext.Provider value={allowedSet}>
      {children}
    </AllowedModuleKeysContext.Provider>
  </ForgeContextInternal.Provider>
);
```

`ContextRoute` reads this context in its render body. The presence of a
non-null `Set` tells it two things simultaneously:
1. Conflicts have already been validated — suppress the `console.warn`.
2. The declared key set is available — validate `moduleKey` prop membership.

### `ContextRoute` — order of checks when `allowedModuleKeys` is provided

When `AllowedModuleKeysContext` is non-null, `ContextRoute` performs checks
in this order:

```tsx
export function ContextRoute({ children, moduleKey, modalType, noModal }) {
  const context = useForgeContext();
  const allowedKeys = useContext(AllowedModuleKeysContext); // null or Set<string>

  if (moduleKey !== undefined) {
    // Step 1: validate prop membership — BEFORE attempting any match.
    // Catches typos and stale keys immediately, regardless of which module
    // is currently active in the context.
    if (allowedKeys !== null && !allowedKeys.has(moduleKey)) {
      throw new ForgeContextError(
        `[forge-module-router] <ContextRoute moduleKey="${moduleKey}"> uses a ` +
        `moduleKey that was not declared in the allowedModuleKeys list on ` +
        `<ForgeContextProvider>. Declared keys: ${[...allowedKeys].join(', ')}. ` +
        `Did you make a typo, or forget to add this key to allowedModuleKeys?`
      );
    }

    // Step 2: match — suppress warn if conflicts have been pre-validated
    const conflictsValidated = allowedKeys !== null;
    if (!moduleKeyMatches(context.moduleKey, context, moduleKey, conflictsValidated)) {
      return null;
    }
  }

  // ... modalType and noModal checks unchanged
}
```

This ordering is important: the membership check runs first so a typo in
`moduleKey` is caught immediately on every render, not just when that particular
module happens to be active.

### New / changed files

| File | Change |
|---|---|
| `src/types.ts` | Add `allowedModuleKeys` to `ForgeContextProviderProps` |
| `src/errors.ts` | Update `ForgeModuleKeyConflictError` to support the startup validation variant (no `contextKey` field — that only applies to the runtime conflict case) |
| `src/ViewContext.tsx` | Accept `allowedModuleKeys`; run `validateAllowedModuleKeys` synchronously before rendering children; provide `AllowedModuleKeysContext` wrapping children |
| `src/ContextRouter.tsx` | Add `AllowedModuleKeysContext`; read it in `ContextRoute`; validate prop membership before matching; pass `conflictsValidated` flag to `moduleKeyMatches` to suppress warn |
| `src/index.ts` | No changes needed |
| `test/ContextRouter.test.tsx` | Tests for undeclared-key error and suppressed warn |
| `test/ViewContext.test.tsx` | Tests for startup conflict validation |

### Backwards compatibility

- `allowedModuleKeys` is **optional**. When omitted, behaviour is identical to
  v1.1.0: prefix-match works, warn fires unconditionally.
- No existing call sites need to change to get the new `v1.1.0` behaviour.
- Adding `allowedModuleKeys` is a purely opt-in upgrade path.
- This is a **minor version** change (new optional prop, no removals).

---

## Tradeoffs

### Pros

- **Eliminates the false-positive warn** — the most annoying current limitation.
- **Catches conflicts at startup**, not at runtime when a particular environment
  suffix happens to trigger the issue.
- **Catches typos** in `moduleKey` props immediately.
- **Single source of truth** for the module key registry — the app declares it
  once at the provider level rather than scattered across `<ContextRoute>` props.
- **No additional peer dependencies** — pure React context, no extra machinery.

### Cons

- **Duplicated information** — the manifest already lists all module keys. The
  developer must keep `allowedModuleKeys` in sync with the manifest manually.
  A future improvement could auto-generate this list from the manifest at build
  time (e.g. via a Vite/webpack plugin or a code-gen step).
- **Opt-in** — teams who don't add `allowedModuleKeys` continue to see the warn.
  Some guidance (README, a lint rule) may be needed to encourage adoption.

---

## Future extension: auto-generate from manifest

The `allowedModuleKeys` array is a manual duplication of information already
present in `manifest.yml`. A natural follow-up would be a build-time code
generation step (e.g. a small CLI or Vite plugin) that reads `manifest.yml` and
emits a typed constant:

```ts
// generated/moduleKeys.ts (auto-generated — do not edit)
export const MODULE_KEYS = ['paste-code-macro', 'gist-code-macro', 'my-panel'] as const;
```

Which is then passed directly to the provider:

```tsx
import { MODULE_KEYS } from './generated/moduleKeys';

<ForgeContextProvider allowedModuleKeys={MODULE_KEYS}>
```

This eliminates the duplication entirely and makes the list impossible to get
out of sync with the manifest.
