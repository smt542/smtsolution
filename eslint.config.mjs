import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: ["app/layout.tsx", "hooks/common/useAppToast.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              message: "Use the shared toast boundary from @/hooks/common.",
            },
          ],
        },
      ],
    },
  },
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
    // Supabase Edge Functions run on Deno (npm:/jsr: imports, Deno globals) — not part of the Next build.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
