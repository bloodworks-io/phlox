import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "build/**",
            "dist/**",
            "node_modules/**",
            "src-tauri/**",
            "server/**",
            "src/components/ui/**",
            "build-dir/**",
            ".flatpak-builder/**",
            "packaging/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["*.config.js"],
        languageOptions: {
            globals: { ...globals.node },
        },
    },
    {
        files: ["src/**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "unused-imports": unusedImports,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            globals: { ...globals.browser },
        },
        rules: {
            "no-undef": "off",
            "no-control-regex": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "no-unused-vars": "off",
            "no-empty": ["error", { allowEmptyCatch: true }],
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            ...reactHooks.configs.recommended.rules,
            "react-hooks/set-state-in-effect": "off",
        },
    },
);
