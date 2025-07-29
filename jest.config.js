/** @type {import('jest').Config} */
module.exports = {
    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",

    // An array of regexp pattern strings used to skip coverage collection
    coveragePathIgnorePatterns: [
        "/node_modules/"
    ],

    // Indicates which provider should be used to instrument code for coverage
    coverageProvider: "v8",

    // A list of reporter names that Jest uses when writing coverage reports
    coverageReporters: [
        "json",
        "text",
        "lcov",
        "clover"
    ],

    // The test environment that will be used for testing
    testEnvironment: "node",

    // The glob patterns Jest uses to detect test files
    testMatch: [
        "**/__tests__/**/*.js?(x)",
        "**/?(*.)+(spec|test).js?(x)"
    ],
};
