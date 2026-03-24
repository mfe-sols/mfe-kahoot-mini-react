const fs = require("fs");
const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");
const webpack = require("webpack");

// Load shared workspace .env first, then app-local .env (if any) to override.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  override: true,
});

module.exports = (webpackConfigEnv, argv) => {
  const findInstalledPackageDir = (packageName, startDir) => {
    let currentDir = startDir;
    while (true) {
      const candidate = path.join(currentDir, "node_modules", ...packageName.split("/"));
      if (fs.existsSync(candidate)) return candidate;
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) return null;
      currentDir = parentDir;
    }
  };

  const defaultConfig = singleSpaDefaults({
    orgName: "org",
    projectName: "mfe-kahoot-mini-react",
    webpackConfigEnv,
    argv,
    outputSystemJS: true,
    disableHtmlGeneration: true,
  });

  defaultConfig.resolve = defaultConfig.resolve || {};

  /* ── Prioritise .ts/.tsx so Webpack picks ESM sources in libs/ ── */
  defaultConfig.resolve.extensions = [
    ".ts", ".tsx", ".mjs", ".js", ".jsx", ".wasm", ".json",
  ];

  const localUiKitIndex = path.resolve(__dirname, "../../libs/ui-kit/design-system/src/index.ts");
  const localI18nIndex = path.resolve(__dirname, "../../libs/i18n/src/index.ts");
  const hasLocalUiKitFallback = fs.existsSync(localUiKitIndex);
  const hasLocalI18nFallback = fs.existsSync(localI18nIndex);
  const hasLiveUiKit = Boolean(findInstalledPackageDir("@mfe-sols/ui-kit", __dirname));
  const hasLiveI18n = Boolean(findInstalledPackageDir("@mfe-sols/i18n", __dirname));
  const isStrictLiveMode =
    process.env.VERCEL === "1" ||
    process.env.CI === "true" ||
    process.env.MFE_REQUIRE_LIVE_PACKAGES === "1";
  const apiProxyTarget = process.env.API_BASE_URL || process.env.AUTH_BASE_URL || "";

  if ((!hasLiveUiKit || !hasLiveI18n) && isStrictLiveMode) {
    const missing = [
      !hasLiveUiKit ? "@mfe-sols/ui-kit" : null,
      !hasLiveI18n ? "@mfe-sols/i18n" : null,
    ].filter(Boolean);
    throw new Error(
      [
        `Missing live package dependency: ${missing.join(", ")}`,
        "This build is running in strict live-package mode (CI/Vercel).",
        "Configure GitHub Packages auth and install @mfe-sols dependencies before build.",
      ].join("\n")
    );
  }

  const aliasLiveUiKitToLocal = !hasLiveUiKit && hasLocalUiKitFallback;
  const aliasLiveI18nToLocal = !hasLiveI18n && hasLocalI18nFallback;

  if (aliasLiveUiKitToLocal || aliasLiveI18nToLocal) {
    const fallbackTargets = [
      aliasLiveUiKitToLocal ? "@mfe-sols/ui-kit -> ../../libs/ui-kit" : null,
      aliasLiveI18nToLocal ? "@mfe-sols/i18n -> ../../libs/i18n" : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.warn(`[mfe-kahoot-mini-react] Using local library fallback: ${fallbackTargets}`);
  }

  defaultConfig.resolve.alias = {
    ...(defaultConfig.resolve.alias || {}),
    ...(aliasLiveUiKitToLocal ? { "@mfe-sols/ui-kit$": localUiKitIndex } : {}),
    ...(aliasLiveI18nToLocal ? { "@mfe-sols/i18n$": localI18nIndex } : {}),
  };

  const baseExternals = defaultConfig.externals;
  const allowBundle = new Set([
    "@mfe-sols/ui-kit",
    "@mfe-sols/i18n",
    "react",
    "react-dom",
    "react-dom/client",
  ]);
  const customExternals = ({ context, request }, callback) => {
    if (allowBundle.has(request)) {
      return callback();
    }
    if (typeof baseExternals === "function") {
      if (baseExternals.length <= 2) {
        return baseExternals({ context, request }, callback);
      }
      return baseExternals(context, request, callback);
    }
    if (Array.isArray(baseExternals)) {
      for (const ext of baseExternals) {
        if (typeof ext === "function") {
          let handled = false;
          const onResult = (err, result) => {
            if (err) return callback(err);
            if (result !== undefined) {
              handled = true;
              return callback(null, result);
            }
          };
          if (ext.length <= 2) {
            ext({ context, request }, onResult);
          } else {
            ext(context, request, onResult);
          }
          if (handled) return;
        } else if (typeof ext === "object" && ext[request]) {
          return callback(null, ext[request]);
        }
      }
      return callback();
    }
    return callback();
  };

  /* ── Remove auto-generated standalone HTML ── */
  defaultConfig.plugins = (defaultConfig.plugins || []).filter(
    (p) => p && p.constructor &&
      p.constructor.name !== "StandaloneSingleSpaPlugin" &&
      p.constructor.name !== "ForkTsCheckerWebpackPlugin"
  );

  return merge(defaultConfig, {
    cache: { type: "filesystem" },
    performance: { hints: false },
    externals: customExternals,
    plugins: [
      new webpack.DefinePlugin({
        "process.env.API_BASE_URL": JSON.stringify(process.env.API_BASE_URL || ""),
        "process.env.AUTH_BASE_URL": JSON.stringify(process.env.AUTH_BASE_URL || ""),
      }),
      new CopyPlugin({
        patterns: [
          {
            from: "public",
            to: ".",
            globOptions: { ignore: ["**/.DS_Store"] },
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devServer: {
      ...(defaultConfig.devServer || {}),
      allowedHosts: "all",
      static: [
        { directory: path.resolve(__dirname, "public"), publicPath: "/" },
      ],
      headers: {
        ...((defaultConfig.devServer && defaultConfig.devServer.headers) || {}),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      ...((apiProxyTarget
        ? {
            proxy: {
              "/api/kahoot-mini": {
                target: apiProxyTarget,
                changeOrigin: true,
                secure: false,
              },
            },
          }
        : {})),
    },
  });
};
