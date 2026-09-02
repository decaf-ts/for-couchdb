// import { Config } from "@jest/types";
const conf = require("../../jest.config.cjs");

const config = {
  ...conf,
  collectCoverage: true,
  coverageDirectory: "./workdocs/reports/coverage",
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "./workdocs/reports/junit",
        outputName: "junit-report.xml",
      },
    ],
    [
      "jest-html-reporters",
      {
        publicPath: "./workdocs/reports/html",
        filename: "test-report.html",
        openReport: true,
        expand: true,
        pageTitle: "for-couchdb Test Report",
        stripSkippedTest: true,
        darkTheme: true,
        enableMergeData: true,
        dataMergeLevel: 2,
      },
    ],
  ],
  coverageThreshold: {
    global: {
      branches: 22,
      functions: 28,
      lines: 32,
      statements: 30,
    },
  },
};

module.exports = config;
