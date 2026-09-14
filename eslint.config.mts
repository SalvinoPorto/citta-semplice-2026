import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], languageOptions: { globals: globals.node } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  // Runtime JSX automatico ("jsx": "react-jsx"): React non serve in scope.
  pluginReact.configs.flat["jsx-runtime"],
  // Evita l'avviso "React version not specified" a ogni esecuzione.
  { settings: { react: { version: "detect" } } },
]);

