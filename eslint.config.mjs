import { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next still ships its "core-web-vitals"/"typescript" presets
// in the legacy eslintrc `extends`-string format (see
// node_modules/eslint-config-next/{core-web-vitals,typescript}.js) — they
// can't be imported directly into a flat config's array, that mis-resolves
// their nested "plugin:..." extends into a "Plugin \"\" not found" crash.
// FlatCompat is the officially documented shim for exactly this case.
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // This codebase deliberately uses `any` at a handful of untyped
      // boundaries (Mongoose middleware hooks, NextAuth JWT augmentation,
      // mail template payloads) rather than fighting library types that
      // don't model those shapes well — see the comments at each call
      // site. Linting was silently disabled before this config was fixed
      // (see git history on this file), so those pre-existing call sites
      // never had to satisfy this rule; downgrading to a warning keeps it
      // visible without turning fixing all of them into a build-blocking
      // prerequisite for unrelated changes.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
