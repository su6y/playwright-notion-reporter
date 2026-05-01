import type { PlaywrightJsonReport, PlaywrightSuite, TestEntry } from "../types.ts";

export function parseReport(report: PlaywrightJsonReport): TestEntry[] {
  const entries: TestEntry[] = [];
  for (const suite of report.suites) {
    collectEntries(suite, [], entries);
  }
  return entries;
}

function collectEntries(suite: PlaywrightSuite, parentPath: string[], entries: TestEntry[]): void {
  const path = suite.title ? [...parentPath, suite.title] : parentPath;

  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const lastResult = test.results[test.results.length - 1];
        if (!lastResult) continue;

        const rawError = lastResult.error;
        const errorMessage =
          lastResult.errors?.[0]?.message ?? rawError?.stack ?? rawError?.message ?? "";

        const screenshot = lastResult.attachments?.find(
          (a) => a.contentType.startsWith("image/") && a.path,
        );

        entries.push({
          title: spec.title,
          titlePath: [...path, spec.title],
          status: lastResult.status,
          duration: lastResult.duration,
          file: spec.file,
          project: test.projectName,
          error: errorMessage,
          retry: lastResult.retry,
          tags: spec.tags ?? [],
          startedAt: lastResult.startTime,
          screenshotPath: screenshot?.path,
        });
      }
    }
  }

  if (suite.suites) {
    for (const child of suite.suites) {
      collectEntries(child, path, entries);
    }
  }
}
