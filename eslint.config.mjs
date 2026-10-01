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
    // Local patch-script backups (see .gitignore) — untouched copies of
    // pre-patch file content, not source. Without this, npm run lint
    // reports findings from whatever bug a backup snapshot happened to
    // have at patch time, which is noise, not a real finding.
    ".amado-patch-backups/**",
  ]),
]);

export default eslintConfig;