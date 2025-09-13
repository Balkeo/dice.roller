module.exports = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  overrides: [
    {
      files: ["*.yaml", "*.yml"],
      options: {
        singleQuote: true,
      },
    },
  ],
  importOrder: [
    // Dependencies and everything that have not match other regexes
    "<THIRD_PARTY_MODULES>",
    // Our own component (everything that start with `~/` and do not contains a dot)
    "^~/([^\\.]+)$",
    // Relative import
    "^[./]",
    "^[../]",
    // All asset imports (import that contains a dot)
    "^(.*)\\.(.*)$",
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
};
