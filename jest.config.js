module.exports = {
  clearMocks: true,
  moduleFileExtensions: ["js", "ts"],
  testMatch: ["**/__tests__/*.spec.ts"],
  transform: {
    "^.+\\.ts$": ["@swc/jest"],
  },
  verbose: true,
}
