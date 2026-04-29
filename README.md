# forge-module-router

A routing library for [Atlassian Forge](https://developer.atlassian.com/platform/forge/) Custom UI apps that solves two fundamental problems:

1. **SPA routing in full-page apps** — `<SpaRouter>` encapsulates all of the complex wiring described in Atlassian's [Add routing to a full-page app](https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/) guide into a single, drop-in component. You get browser-back/forward integration with the Atlassian product shell for free.

2. **One static frontend package, many Forge modules** — `<ContextRoute>` gives you a React Router-like declarative experience for conditionally rendering the right UI based on which Forge module (panel, page, modal, etc.) is currently active. This lets you ship and maintain **a single static frontend resource** across all of your Forge app's modules instead of one bundle per module.

---

## Why this library?

### Problem 1: SPA routing in Forge is non-trivial

Forge full-page apps (e.g. `jira:globalPage`, `confluence:globalPage`) support sub-pages and sidebar navigation via the `pages` manifest field. When a user clicks a tab, Atlassian updates the URL — but **your app is responsible for listening to those URL changes and rendering the correct component**.

Atlassian's [official guide](https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/) walks through how to wire up `view.createHistory()` from `@forge/bridge` into React Router's `<Router>`. It involves async initialisation, action/location state management, listener cleanup, and environment fallbacks for local development. `<SpaRouter>` handles all of that for you.

**Before** (manual wiring, ~40 lines of boilerplate):
```tsx
// Async history init, state management, listener cleanup,
// in-memory fallback for dev/test... all done by hand.
const [historyState, setHistoryState] = useState(null);
const [navigator, setNavigator] = useState(null);
useEffect(() => {
  (async () => {
    try {
      const history = await view.createHistory();
      setNavigator(history);
      setHistoryState({ action: history.action, location: history.location });
      history.listen((location, action) => setHistoryState({ action, location }));
    } catch {
      const history = createMemoryHistory();
      // ...
    }
  })();
}, []);
if (!navigator || !historyState) return fallback;
return <Router navigator={navigator} navigationType={historyState.action} location={historyState.location}>...</Router>;
```

**After** (with `<SpaRouter>`):
```tsx
<SpaRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</SpaRouter>
```

### Problem 2: One frontend package for all your Forge modules

Forge requires each `resource` in your manifest to be a separate static bundle. Without a routing strategy, teams end up maintaining a separate React app per module (one for your panel, one for your global page, one for your admin page, etc.).

`<ContextRoute>` reads the Forge context at runtime to determine which module is active, letting you write declarative, React Router-style JSX that conditionally renders the right component tree — all from a single entry point:

```tsx
<ForgeContextProvider>
  <ContextRoute moduleKey="my-jira-panel">
    <MyPanel />
  </ContextRoute>
  <ContextRoute moduleKey="my-global-page">
    <SpaRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </SpaRouter>
  </ContextRoute>
  <ContextRoute moduleKey="my-admin-page">
    <AdminPage />
  </ContextRoute>
</ForgeContextProvider>
```

All three modules share the same static resource — one bundle to build, test, and deploy.

---

## Installation

```bash
npm install forge-module-router
```

### Peer Dependencies

```bash
npm install @forge/bridge history react react-dom react-router-dom
```

---

## Quick Start

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Route, Routes } from 'react-router-dom';
import {
  ForgeContextProvider,
  ContextRoute,
  SpaRouter,
} from 'forge-module-router';

import { MyPanel } from './MyPanel';
import { MyModal } from './MyModal';
import { Home } from './Home';
import { Settings } from './Settings';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ForgeContextProvider fallback={<div>Loading...</div>}>

      {/* Render a panel module with SPA sub-page routing */}
      <ContextRoute moduleKey="my-jira-panel">
        <ContextRoute noModal>
          <SpaRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </SpaRouter>
        </ContextRoute>
        <ContextRoute modalType="confirm-delete">
          <MyModal />
        </ContextRoute>
      </ContextRoute>

    </ForgeContextProvider>
  </React.StrictMode>
);
```

---

## API Reference

### `<ForgeContextProvider>`

Fetches the Forge context via `view.getContext()` and provides it to the component tree. Renders `fallback` until the context resolves.

```tsx
<ForgeContextProvider
  fallback={<Spinner />}         // Optional: shown while context loads (default: null)
  onError={(err) => report(err)} // Optional: called if view.getContext() rejects
>
  {children}
</ForgeContextProvider>
```

---

### `useForgeContext()`

Returns the current `ForgeContext` object. Must be called within a `<ForgeContextProvider>` — throws a `ForgeContextError` otherwise.

```tsx
import { useForgeContext } from 'forge-module-router';

function MyComponent() {
  const context = useForgeContext();
  return <div>Module: {context.moduleKey}</div>;
}
```

---

### `<ContextRoute>`

Conditionally renders children based on the current Forge context. All specified props must match simultaneously. Unspecified props act as wildcards.

This is the primary building block for serving multiple Forge modules from a single static frontend package. Think of it as a React Router `<Route>`, but matching on Forge module context instead of URL path.

| Prop        | Type      | Description                                                        |
|-------------|-----------|--------------------------------------------------------------------|
| `moduleKey` | `string`  | Only render if `context.moduleKey` matches this value (see below). |
| `modalType` | `string`  | Only render if `context.extension.modal.type` equals this value.   |
| `noModal`   | `boolean` | Only render if there is **no** modal present in the context.       |

```tsx
// Only for a specific module, with no modal
<ContextRoute moduleKey="my-module" noModal>
  <MainView />
</ContextRoute>

// Only when a modal of a specific type is open
<ContextRoute moduleKey="my-module" modalType="add-item">
  <AddItemModal />
</ContextRoute>
```

#### `moduleKey` matching across environments

> **Affected module types only.** Not all Forge modules have an environment
> suffix appended to their `moduleKey`. This behaviour is most commonly observed
> in **Confluence macros** (`confluence:macro`) and other module types that are
> installed per-environment rather than globally. If your app only uses module
> types where you have not observed a suffix, the prefix-match path is never
> reached and there is no behavioural difference from a plain exact match.

In non-production Forge environments, Atlassian appends the environment name as
a suffix to `context.moduleKey` for affected module types. A module declared as
`my-macro` in the manifest will appear as:

| Environment | `context.moduleKey` |
|---|---|
| Production | `my-macro` |
| Staging | `my-macro-stg` |
| Development (default) | `my-macro-dev` |
| Local (`forge tunnel`) | `my-macro-local` |
| Custom env named `alice` | `my-macro-alice` |
| Custom env named `team-backend` | `my-macro-team-backend` |

`<ContextRoute moduleKey="my-macro">` handles this automatically — it always
tries an exact match first (covering production), then in non-production
environments it also accepts any `context.moduleKey` of the form
`my-macro-<anything>`. **No call-site changes are needed to make your routes
work across all environments.**

> **Note:** A `console.warn` is emitted whenever the prefix-match path is taken.
> This is intentional — it alerts you if two of your manifest module keys share
> a hyphen-prefix relationship (e.g. `my-macro` and `my-macro-v2`), which would
> cause both `<ContextRoute>`s to render simultaneously in non-production
> environments. If you see this warning, rename one of the conflicting module
> keys so that neither is a prefix of the other.

---

### `<SpaRouter>`

Wraps React Router's `<Router>` and wires it to Forge's [`view.createHistory()`](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/#createhistory) from `@forge/bridge`. This is the drop-in solution for everything described in Atlassian's [Add routing to a full-page app](https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/) guide.

Falls back to an in-memory history in non-Forge environments (e.g. local dev or tests) so your app works seamlessly outside of `forge tunnel`.

History is created **once on mount** — it is never recreated on context re-renders.

```tsx
<SpaRouter fallback={<Spinner />}> {/* fallback shown while history initialises */}
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</SpaRouter>
```

#### When to use `<SpaRouter>`

`<SpaRouter>` is required whenever your Forge module uses the `pages` or `sections` manifest field to register sub-pages. Atlassian's sidebar/tab navigation updates the URL, but **your app is responsible for handling those URL changes** — that is exactly what `view.createHistory()` (and therefore `<SpaRouter>`) does.

The following Forge modules support sub-pages and require `<SpaRouter>` for in-app navigation:

| Module | Manifest key | Subpage doc |
|--------|-------------|-------------|
| **Jira Global Page** | `jira:globalPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-global-page/) |
| **Jira Project Page** | `jira:projectPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-project-page/) |
| **Jira Admin Page** | `jira:adminPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-admin-page/) |
| **Jira Project Settings Page** | `jira:projectSettingsPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-project-settings-page/) |
| **Jira Personal Settings Page** *(Preview)* | `jira:personalSettingsPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-personal-settings-page/) |
| **Jira Full Page** *(Preview)* | `jira:fullPage` | [Routing →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-full-page/) |
| **Confluence Global Page** | `confluence:globalPage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/confluence-global-page/) |
| **Confluence Space Page** | `confluence:spacePage` | [Subpages →](https://developer.atlassian.com/platform/forge/manifest-reference/modules/confluence-space-page/) |

> **Note:** The `pages`/`sections` manifest configuration only changes the URL — Atlassian does not render different components for you. You must map URLs to components yourself using `<SpaRouter>` + React Router `<Routes>`.

**Example manifest** (`jira:globalPage` with sub-pages):

```yaml
modules:
  jira:globalPage:
    - key: my-global-page
      resource: main
      render: native
      title: My App
      pages:
        - key: home
          title: Home
          path: /
        - key: settings
          title: Settings
          path: /settings
```

**Matching app code:**

```tsx
<ForgeContextProvider>
  <ContextRoute moduleKey="my-global-page">
    <SpaRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </SpaRouter>
  </ContextRoute>
</ForgeContextProvider>
```

---

### `<Link>`

A client-side navigation link for use within a `<SpaRouter>`. Prevents full-page navigation and delegates to React Router's `navigate()`.

```tsx
import { Link } from 'forge-module-router';

<Link to="/settings">Go to Settings</Link>
<Link to="/settings" className="nav-link">Go to Settings</Link>
```

---

### `ForgeContextError`

Thrown by `useForgeContext()` when called outside a `<ForgeContextProvider>`.

```tsx
import { ForgeContextError } from 'forge-module-router';

try {
  // ...
} catch (err) {
  if (err instanceof ForgeContextError) {
    console.error('Missing ForgeContextProvider in tree');
  }
}
```

---

## Types

All Forge context types are exported for use in your own components:

```ts
import type {
  ForgeContext,
  ForgeExtension,
  ForgeModalContext,
  ForgeLicenseDetails,
  ForgeContextProviderProps,
  ContextRouteProps,
  SpaRouterProps,
  LinkProps,
} from 'forge-module-router';
```

### `ForgeContext`

```ts
interface ForgeContext {
  accountId?: string;
  cloudId?: string;
  extension: ForgeExtension;
  license?: ForgeLicenseDetails;
  localId: string;
  locale: string;
  moduleKey: string;
  siteUrl: string;
  timezone: string;
}
```

---

## Troubleshooting

### "Invalid hook call" / "Cannot read properties of null (reading 'useState')"

This means there are **two copies of React** in your app. React enforces a singleton — if
`forge-module-router` resolves a different copy of React than your app, hooks will crash.

This most commonly happens when using `npm link` for local development. Fix it by
pointing `forge-module-router`'s React at your app's copy:

```bash
# From the forge-module-router directory:
rm -rf node_modules/react node_modules/react-dom node_modules/react-router-dom
ln -s /path/to/your-app/node_modules/react node_modules/react
ln -s /path/to/your-app/node_modules/react-dom node_modules/react-dom
ln -s /path/to/your-app/node_modules/react-router-dom node_modules/react-router-dom
```

In a monorepo or bundler setup, ensure all packages resolve React to the same instance
(e.g. via webpack's `resolve.alias` or pnpm's `dedupe`).

---

### "useRoutes() may be used only in the context of a \<Router\>"

This means there are **two copies of `react-router-dom`** — the `<Router>` context was
set by one instance but `<Routes>` is reading from another. The fix is the same as
above: symlink your app's `react-router-dom` into `forge-module-router/node_modules/`
during local development.

---

### App is blank / stuck on fallback after navigation

If you are using `<SpaRouter>` and the app renders correctly on first load but goes blank
or gets stuck after navigating, check that `view.createHistory()` is available in your
environment. In `forge tunnel`, it should resolve. In a plain browser (outside Forge),
it will reject and fall back to in-memory history.

Also ensure you are not accidentally re-mounting `<SpaRouter>` on context changes — the
history object is created once on mount and must not be recreated on re-renders.

---

## Building

```bash
npm run build   # Outputs CJS + ESM + type declarations to dist/
npm run lint    # Type-check with tsc
npm test        # Run tests with vitest
```
