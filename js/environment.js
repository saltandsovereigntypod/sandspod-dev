(function initializeSaltEnvironment(global) {
  "use strict";

  const PROJECTS = Object.freeze({
    development: Object.freeze({
      projectRef: "aiiqyesczxrrujznwoke",
      // Browser-publishable keys are intentionally project-specific. Never put a
      // service-role key, secret key, session, or other privileged value here.
      publishableKey: "sb_publishable_QWf1B9BxGQkeFQsuJ4Mn3w_NvXytwVg",
      moderatorIds: Object.freeze(["a0bd79fd-ad6d-472a-b38b-69526651e76b"])
    }),
    production: Object.freeze({
      projectRef: "outksqvhusvvtjgiveoh",
      // REQUIRED: set this to the production project's browser-safe publishable
      // (or legacy anon) key. It was not present in this repository's history.
      publishableKey: "",
      moderatorIds: Object.freeze([
        "ddc5463e-1551-498b-b5af-79ce52ac591c",
        "5c63e3ac-920c-4980-9aa7-f6f322a67a2e"
      ])
    })
  });

  function normalizeBasePath(value) {
    const path = `/${String(value || "").replace(/^\/+|\/+$/g, "")}/`;
    return path === "//" ? "/" : path;
  }

  function createEnvironment(locationLike) {
    const location = locationLike || {};
    const hostname = String(location.hostname || "").toLowerCase();
    const pathname = String(location.pathname || "/");
    const production = hostname === "saltandsovereignty.com" || hostname === "www.saltandsovereignty.com";
    const developmentDomain = hostname === "dev.saltandsovereignty.com";
    const githubPages = hostname === "saltandsovereigntypod.github.io" && (pathname === "/sandspod-dev" || pathname.startsWith("/sandspod-dev/"));
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const recognized = production || developmentDomain || githubPages || local;
    const name = production ? "production" : recognized ? (local ? "local-development" : "development") : "unrecognized";
    const project = production ? PROJECTS.production : recognized ? PROJECTS.development : null;
    const basePath = githubPages ? "/sandspod-dev/" : "/";
    const origin = String(location.origin || `${location.protocol || "https:"}//${location.host || hostname}`);

    function resolvePath(value) {
      const raw = String(value || "/");
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) return raw;
      const [pathAndQuery, hash = ""] = raw.split("#", 2);
      const [pathOnly, query = ""] = pathAndQuery.split("?", 2);
      const relative = pathOnly.replace(/^\/+/, "");
      const resolved = relative ? `${basePath}${relative}` : basePath;
      return `${resolved}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
    }

    function oauthReturnUrl(path = "/") {
      if (!recognized) throw new Error("OAuth is disabled on an unrecognized deployment host.");
      return new URL(resolvePath(path), `${origin}/`).href;
    }

    const environment = {
      name,
      isProduction: production,
      isDevelopment: recognized && !production,
      isLocal: local,
      isRecognized: recognized,
      hostname,
      basePath: normalizeBasePath(basePath),
      baseUrl: recognized ? new URL(basePath, `${origin}/`).href : null,
      supabaseProjectRef: project?.projectRef || null,
      supabaseUrl: project ? `https://${project.projectRef}.supabase.co` : null,
      supabasePublishableKey: project?.publishableKey || null,
      moderatorIds: project ? [...project.moderatorIds] : [],
      resolvePath,
      oauthReturnUrl,
      getSupabaseConfig() {
        if (!recognized || !project) throw new Error(`Salt & Sovereignty is not configured for host "${hostname || "(empty)"}".`);
        if (!project.publishableKey) throw new Error(`${production ? "Production" : "Development"} Supabase browser publishable key is required.`);
        return { url: `https://${project.projectRef}.supabase.co`, publishableKey: project.publishableKey };
      }
    };

    if (production && environment.supabaseProjectRef !== PROJECTS.production.projectRef) throw new Error("Production is not configured for the production Supabase project.");
    if (environment.isDevelopment && environment.supabaseProjectRef !== PROJECTS.development.projectRef) throw new Error("Development is not configured for the development Supabase project.");
    return Object.freeze(environment);
  }

  const api = { createEnvironment, PROJECTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!global.location) return;

  const environment = createEnvironment(global.location);
  global.SaltEnvironment = environment;
  if (!environment.isRecognized) console.error("Salt & Sovereignty configuration error: unrecognized deployment host; Supabase initialization is disabled.");

  // Root-relative application links are correct on custom domains but need the
  // repository prefix on GitHub Pages. Resolve them centrally at navigation time.
  global.document?.addEventListener("click", (event) => {
    if (environment.basePath === "/" || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.("a[href]");
    const href = anchor?.getAttribute("href") || "";
    if (!href.startsWith("/") || href.startsWith(environment.basePath)) return;
    event.preventDefault();
    global.location.assign(environment.resolvePath(href));
  }, true);

  const params = new URLSearchParams(global.location.search || "");
  if (params.get("debugEnvironment") === "1") {
    global.debugSaltEnvironment = () => ({
      name: environment.name,
      hostname: environment.hostname,
      basePath: environment.basePath,
      supabaseProjectRef: environment.supabaseProjectRef,
      oauthReturnUrl: environment.isRecognized ? environment.oauthReturnUrl("/") : null,
      isRecognized: environment.isRecognized,
      assertionsPassed: environment.isRecognized
    });
    console.info("Safe environment diagnostic enabled. Run debugSaltEnvironment().");
  }
})(typeof window !== "undefined" ? window : globalThis);
