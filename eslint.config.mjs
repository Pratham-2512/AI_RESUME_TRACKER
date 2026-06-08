import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "worker/**",
      "scripts/**",
      "next-env.d.ts",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  {
    // Security guard (docs/11): block the service-role admin client from app code.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/supabase/admin"],
              message:
                "Do not import the service-role admin client in app/components. Use lib/supabase/server.ts (RLS-scoped).",
            },
          ],
        },
      ],
    },
  },
];
