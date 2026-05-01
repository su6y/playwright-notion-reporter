import { describe, it, expect } from "vitest";
import { parseReport } from "../../src/parser/playwright.ts";
import type { PlaywrightJsonReport } from "../../src/types.ts";

const REPORT: PlaywrightJsonReport = {
  suites: [
    {
      title: "auth.spec.ts",
      specs: [
        {
          title: "should login",
          file: "tests/auth.spec.ts",
          tags: ["@smoke"],
          tests: [
            {
              projectName: "chromium",
              results: [
                {
                  status: "passed",
                  duration: 1234,
                  startTime: "2026-01-01T00:00:00.000Z",
                  retry: 0,
                },
              ],
            },
          ],
        },
        {
          title: "should fail",
          file: "tests/auth.spec.ts",
          tests: [
            {
              projectName: "chromium",
              results: [
                {
                  status: "failed",
                  duration: 500,
                  startTime: "2026-01-01T00:00:01.000Z",
                  retry: 0,
                  error: {
                    message: "Expected true",
                    stack: "Error: Expected true\n  at test.ts:5",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  stats: {
    startTime: "2026-01-01T00:00:00.000Z",
    duration: 5000,
    expected: 1,
    unexpected: 1,
    skipped: 0,
    flaky: 0,
  },
};

describe("parseReport", () => {
  it("extracts test entries from suites", () => {
    const entries = parseReport(REPORT);
    expect(entries).toHaveLength(2);
  });

  it("parses passed test correctly", () => {
    const entries = parseReport(REPORT);
    const passed = entries[0]!;
    expect(passed.title).toBe("should login");
    expect(passed.titlePath).toEqual(["auth.spec.ts", "should login"]);
    expect(passed.status).toBe("passed");
    expect(passed.duration).toBe(1234);
    expect(passed.file).toBe("tests/auth.spec.ts");
    expect(passed.project).toBe("chromium");
    expect(passed.tags).toEqual(["@smoke"]);
    expect(passed.error).toBe("");
  });

  it("parses failed test with error", () => {
    const entries = parseReport(REPORT);
    const failed = entries[1]!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Expected true");
  });

  it("handles nested suites", () => {
    const nested: PlaywrightJsonReport = {
      suites: [
        {
          title: "file.spec.ts",
          suites: [
            {
              title: "describe block",
              specs: [
                {
                  title: "nested test",
                  file: "tests/file.spec.ts",
                  tests: [
                    {
                      projectName: "firefox",
                      results: [
                        {
                          status: "passed",
                          duration: 100,
                          startTime: "2026-01-01T00:00:00.000Z",
                          retry: 0,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        startTime: "2026-01-01T00:00:00.000Z",
        duration: 1000,
        expected: 1,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
      },
    };
    const entries = parseReport(nested);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.titlePath).toEqual(["file.spec.ts", "describe block", "nested test"]);
  });

  it("uses last result for retried tests", () => {
    const retried: PlaywrightJsonReport = {
      suites: [
        {
          title: "retry.spec.ts",
          specs: [
            {
              title: "flaky test",
              file: "tests/retry.spec.ts",
              tests: [
                {
                  projectName: "chromium",
                  results: [
                    {
                      status: "failed",
                      duration: 100,
                      startTime: "2026-01-01T00:00:00.000Z",
                      retry: 0,
                      error: { message: "fail" },
                    },
                    {
                      status: "passed",
                      duration: 200,
                      startTime: "2026-01-01T00:00:01.000Z",
                      retry: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      stats: {
        startTime: "2026-01-01T00:00:00.000Z",
        duration: 1000,
        expected: 1,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
      },
    };
    const entries = parseReport(retried);
    expect(entries[0]!.status).toBe("passed");
    expect(entries[0]!.retry).toBe(1);
  });

  it("returns empty array for empty report", () => {
    const empty: PlaywrightJsonReport = {
      suites: [],
      stats: {
        startTime: "2026-01-01T00:00:00.000Z",
        duration: 0,
        expected: 0,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
      },
    };
    expect(parseReport(empty)).toEqual([]);
  });
});
