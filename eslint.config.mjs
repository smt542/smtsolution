import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Runtime tool artifacts (gstack headless-browser cache) — not source, and
    // can be permission-locked (ESLint scandir EPERM). Never lint.
    ".gstack/**",
    // Reference-only prototype exports are not application source.
    "docs/prototype/**",
  ]),
]);

export default eslintConfig;
