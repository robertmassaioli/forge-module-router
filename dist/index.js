"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ContextRoute: () => ContextRoute,
  ForgeContextError: () => ForgeContextError,
  ForgeContextProvider: () => ForgeContextProvider,
  Link: () => Link,
  SpaRouter: () => SpaRouter,
  useEffectAsync: () => useEffectAsync,
  useForgeContext: () => useForgeContext
});
module.exports = __toCommonJS(index_exports);

// src/ViewContext.tsx
var import_react = require("react");
var import_bridge = require("@forge/bridge");

// src/errors.ts
var ForgeContextError = class _ForgeContextError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForgeContextError";
    Object.setPrototypeOf(this, _ForgeContextError.prototype);
  }
};

// src/ViewContext.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var ForgeContextInternal = (0, import_react.createContext)(void 0);
function useForgeContext() {
  const ctx = (0, import_react.useContext)(ForgeContextInternal);
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
  const [context, setContext] = (0, import_react.useState)(void 0);
  (0, import_react.useEffect)(() => {
    import_bridge.view.getContext().then((ctx) => setContext(ctx)).catch((err) => {
      onError == null ? void 0 : onError(err);
      console.error("[forge-module-router] Failed to fetch Forge context:", err);
    });
  }, []);
  if (context === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: fallback });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ForgeContextInternal.Provider, { value: context, children });
}

// src/ContextRouter.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children });
}

// src/SpaRouter.tsx
var import_react2 = require("react");
var import_bridge2 = require("@forge/bridge");
var import_react_router_dom = require("react-router-dom");
var import_history = require("history");
var import_jsx_runtime3 = require("react/jsx-runtime");
function SpaRouter({ children, fallback = null }) {
  const [historyState, setHistoryState] = (0, import_react2.useState)(null);
  const [navigator, setNavigator] = (0, import_react2.useState)(null);
  const cleanupRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    const onUpdate = ({ location, action }) => {
      if (!cancelled) {
        setHistoryState({ location, action });
      }
    };
    (async () => {
      try {
        const history = await import_bridge2.view.createHistory();
        if (cancelled) return;
        setNavigator(history);
        setHistoryState({ action: history.action, location: history.location });
        cleanupRef.current = history.listen(onUpdate);
      } catch (e) {
        const history = (0, import_history.createMemoryHistory)();
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
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: fallback });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_react_router_dom.Router,
    {
      navigator,
      navigationType: historyState.action,
      location: historyState.location,
      children
    }
  );
}
function Link({ to, children, className }) {
  const navigate = (0, import_react_router_dom.useNavigate)();
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
var import_react3 = require("react");
function useEffectAsync(callback, deps) {
  const callbackRef = (0, import_react3.useRef)(callback);
  callbackRef.current = callback;
  (0, import_react3.useEffect)(() => {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ContextRoute,
  ForgeContextError,
  ForgeContextProvider,
  Link,
  SpaRouter,
  useEffectAsync,
  useForgeContext
});
