# forge-module-router

Context-aware routing primitives for [Atlassian Forge](https://developer.atlassian.com/platform/forge/) Custom UI apps.

Provides three composable building blocks that let you declaratively render the correct UI based on the Forge module context, and wire up SPA-style navigation using Forge's native history API.

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

      {/* Render based on which Forge module is active */}
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

| Prop        | Type      | Description                                                        |
|-------------|-----------|--------------------------------------------------------------------|
| `moduleKey` | `string`  | Only render if `context.moduleKey` equals this value.              |
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

---

### `<SpaRouter>`

Wraps React Router's `<Router>` and wires it to Forge's [`view.createHistory()`](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/#createhistory) from `@forge/bridge`. Falls back to an in-memory history in non-Forge environments (e.g. local dev).

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

`<SpaRouter>` is required whenever your Forge module uses the `pages` or `sections` manifest field to register subpages. Atlassian's sidebar/tab navigation updates the URL, but **your app is responsible for handling those URL changes** — that is exactly what `view.createHistory()` (and therefore `<SpaRouter>`) does.

The following Forge modules support subpages and require `<SpaRouter>` for in-app navigation:

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

**Example manifest** (`jira:globalPage` with subpages):

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

## Migrating from `ep-tool`

| Before (`ep-tool`)          | After (`forge-module-router`)        |
|-----------------------------|--------------------------------------|
| `<ViewContext>`             | `<ForgeContextProvider>`             |
| `useViewContext()`          | `useForgeContext()`                  |
| `<ContextRoute moduleKey>`  | `<ContextRoute moduleKey>` ✅ same   |
| `<ContextRoute noModal>`    | `<ContextRoute noModal>` ✅ same     |
| `<ContextRoute modalType>`  | `<ContextRoute modalType>` ✅ same   |
| `<SpaRouter>`               | `<SpaRouter>` ✅ same                |
| `useEffectAsync(cb, dep)`   | `useEffectAsync(cb, [dep])` (std deps array) |

---

## Building

```bash
npm run build   # Outputs CJS + ESM + type declarations to dist/
npm run lint    # Type-check with tsc
npm test        # Run tests with vitest
```
