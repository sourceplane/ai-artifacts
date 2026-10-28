import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The template was linted against `next/core-web-vitals` alone (its
    // .eslintrc.json), with eslint-config-next 14. These rules arrived later —
    // the TypeScript config and the React Compiler rules of
    // eslint-config-next 16 — and flag the template's code as written, which
    // is kept:
    rules: {
      // `error: any` in lib/api-errors.ts, lib/morph.ts and the two chat
      // routes' catch blocks.
      "@typescript-eslint/no-explicit-any": "off",
      // The shadcn `InputProps` / `TextareaProps extends …HTMLAttributes {}`.
      "@typescript-eslint/no-empty-object-type": "off",
      // `getTemplateId(result?.template!)` in components/preview.tsx.
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      // The page mirrors the streamed object into its messages from an
      // effect, and the deploy dialog resets its link when the URL changes.
      "react-hooks/set-state-in-effect": "off",
      // The page's handlers are declared below the effects that call them.
      "react-hooks/immutability": "off",
    },
  },
  {
    // tailwind.config.ts loads its plugin with require(), as the template does.
    files: ["tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([".next/**", ".open-next/**", ".wrangler/**", "next-env.d.ts", "cloudflare-env.d.ts"]),
]);
