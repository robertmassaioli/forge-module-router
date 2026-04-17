// src/ViewContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { view } from "@forge/bridge";

// src/errors.ts
var ForgeContextError = class _ForgeContextError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForgeContextError";
    Object.setPrototypeOf(this, _ForgeContextError.prototype);
  }
};

// src/ViewContext.tsx
import { Fragment, jsx } from "react/jsx-runtime";
var ForgeContextInternal = createContext(void 0);
function useForgeContext() {
  const ctx = useContext(ForgeContextInternal);
  if (ctx === void 0) {
    throw new ForgeContextError(
      "useForgeContext() must be called within a <ForgeContextProvider>."
    );
  }
  return ctx;
}
function ForgeContextProvider({
  children,
  fallback = null,
  onError
}) {
  const [context, setContext] = useState(void 0);
  useEffect(() => {
    view.getContext().then((ctx) => setContext(ctx)).catch((err) => {
      onError == null ? void 0 : onError(err);
      console.error("[forge-module-router] Failed to fetch Forge context:", err);
    });
  }, []);
  if (context === void 0) {
    return /* @__PURE__ */ jsx(Fragment, { children: fallback });
  }
  return /* @__PURE__ */ jsx(ForgeContextInternal.Provider, { value: context, children });
}

// src/ContextRouter.tsx
import { Fragment as Fragment2, jsx as jsx2 } from "react/jsx-runtime";
function ContextRoute({
  children,
  moduleKey,
  modalType,
  noModal
}) {
  var _a, _b, _c;
  const context = useForgeContext();
  if (moduleKey !== void 0 && moduleKey !== context.moduleKey) {
    return null;
  }
  const contextModalType = (_b = (_a = context.extension) == null ? void 0 : _a.modal) == null ? void 0 : _b.type;
  if (modalType !== void 0) {
    if (contextModalType === void 0 || modalType !== contextModalType) {
      return null;
    }
  }
  if (noModal === true && ((_c = context.extension) == null ? void 0 : _c.modal) !== void 0) {
    return null;
  }
  return /* @__PURE__ */ jsx2(Fragment2, { children });
}

// src/SpaRouter.tsx
import { useEffect as useEffect2, useRef, useState as useState2 } from "react";
import { view as view2 } from "@forge/bridge";
import { Router, useNavigate } from "react-router-dom";
import { createMemoryHistory } from "history";
import { Fragment as Fragment3, jsx as jsx3 } from "react/jsx-runtime";
function SpaRouter({ children, fallback = null }) {
  const [historyState, setHistoryState] = useState2(null);
  const [navigator, setNavigator] = useState2(null);
  const cleanupRef = useRef(null);
  useEffect2(() => {
    let cancelled = false;
    const onUpdate = ({ location, action }) => {
      if (!cancelled) {
        setHistoryState({ location, action });
      }
    };
    (async () => {
      try {
        const history = await view2.createHistory();
        if (cancelled) return;
        setNavigator(history);
        setHistoryState({ action: history.action, location: history.location });
        cleanupRef.current = history.listen(onUpdate);
      } catch (e) {
        const history = createMemoryHistory();
        if (cancelled) return;
        setNavigator(history);
        setHistoryState({ action: history.action, location: history.location });
        cleanupRef.current = history.listen(onUpdate);
      }
    })();
    const handleUnload = () => {
      var _a;
      (_a = cleanupRef.current) == null ? void 0 : _a.call(cleanupRef);
      cleanupRef.current = null;
    };
    window.addEventListener("unload", handleUnload);
    return () => {
      var _a;
      cancelled = true;
      window.removeEventListener("unload", handleUnload);
      (_a = cleanupRef.current) == null ? void 0 : _a.call(cleanupRef);
      cleanupRef.current = null;
    };
  }, []);
  if (navigator === null || historyState === null) {
    return /* @__PURE__ */ jsx3(Fragment3, { children: fallback });
  }
  return /* @__PURE__ */ jsx3(
    Router,
    {
      navigator,
      navigationType: historyState.action,
      location: historyState.location,
      children
    }
  );
}
function Link({ to, children, className }) {
  const navigate = useNavigate();
  return /* @__PURE__ */ jsx3(
    "a",
    {
      href: to,
      className,
      onClick: (event) => {
        event.preventDefault();
        navigate(to);
      },
      children
    }
  );
}

// src/useEffectAsync.ts
import { useEffect as useEffect3, useRef as useRef2 } from "react";
function useEffectAsync(callback, deps) {
  const callbackRef = useRef2(callback);
  callbackRef.current = callback;
  useEffect3(() => {
    let cleanup;
    let cancelled = false;
    callbackRef.current().then((result) => {
      if (!cancelled) {
        cleanup = result;
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error("[forge-module-router] useEffectAsync unhandled error:", err);
      }
    });
    return () => {
      cancelled = true;
      cleanup == null ? void 0 : cleanup();
    };
  }, deps);
}
export {
  ContextRoute,
  ForgeContextError,
  ForgeContextProvider,
  Link,
  SpaRouter,
  useEffectAsync,
  useForgeContext
};
