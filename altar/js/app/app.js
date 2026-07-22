/* =========================================================
   ALTAR APP
   Central bootstrap and subsystem registry.

   This file intentionally wraps the existing altar rather than replacing
   legacy behavior. Each subsystem can migrate behind this API gradually.
   ========================================================= */

(() => {
  const modules = new Map();
  const initializedModules = new Set();

  const state = {
    status: "created",
    startedAt: null,
    readyAt: null
  };

  function register(name, moduleDefinition = {}) {
    if (!name || typeof name !== "string") {
      throw new TypeError("AltarApp.register requires a module name.");
    }

    if (modules.has(name)) {
      console.warn(`[AltarApp] Replacing registered module: ${name}`);
    }

    modules.set(name, moduleDefinition);

    if (state.status === "ready") {
      initializeModule(name, moduleDefinition);
    }

    return moduleDefinition;
  }

  function initializeModule(name, moduleDefinition) {
    if (initializedModules.has(name)) return;

    try {
      if (typeof moduleDefinition.init === "function") {
        moduleDefinition.init(AltarApp);
      }

      initializedModules.add(name);
      window.AltarEventBus?.emit("altar.module.ready", { name });
    } catch (error) {
      console.error(`[AltarApp] Failed to initialize module: ${name}`, error);
      window.AltarEventBus?.emit("altar.module.error", { name, error });
    }
  }

  function getModule(name) {
    return modules.get(name) || null;
  }

  function hasModule(name) {
    return modules.has(name);
  }

  function listModules() {
    return Array.from(modules.keys());
  }

  function bootstrap() {
    if (state.status === "booting" || state.status === "ready") return;

    state.status = "booting";
    state.startedAt = Date.now();

    window.AltarEventBus?.emit("altar.app.booting", {
      modules: listModules()
    });

    modules.forEach((moduleDefinition, name) => {
      initializeModule(name, moduleDefinition);
    });

    state.status = "ready";
    state.readyAt = Date.now();

    document.documentElement.classList.add("altar-app-ready");

    window.AltarEventBus?.emit("altar.app.ready", {
      modules: listModules(),
      bootDuration: state.readyAt - state.startedAt
    });
  }

  const AltarApp = {
    state,
    register,
    getModule,
    hasModule,
    listModules,
    bootstrap,
    events: window.AltarEventBus || null,
    workspace: window.AltarWorkspace || null
  };

  window.AltarApp = Object.freeze(AltarApp);

  register("legacy", {
    init() {
      window.AltarEventBus?.emit("altar.legacy.ready", {
        message: "Existing altar scripts remain active during migration."
      });
    }
  });

  register("workspace", {
    init(app) {
      app.workspace = window.AltarWorkspace || null;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
