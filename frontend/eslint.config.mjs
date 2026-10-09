import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // URL state synchronization and local persistence hydrate after mount.
      "react-hooks/set-state-in-effect": "off",
    },
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default config;
