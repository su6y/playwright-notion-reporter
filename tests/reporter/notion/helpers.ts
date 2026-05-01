import type { TestEntry } from "../../../src/types.ts";

export function makeEntry(overrides: Partial<TestEntry> = {}): TestEntry {
  return {
    title: "test",
    titlePath: ["suite", "test"],
    status: "passed",
    duration: 100,
    file: "test.spec.ts",
    project: "chromium",
    error: "",
    retry: 0,
    tags: [],
    startedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
