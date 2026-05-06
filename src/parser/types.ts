/** Playwright JSON report format (subset we need) */
export interface PlaywrightJsonReport {
  suites: PlaywrightSuite[];
  stats: PlaywrightStats;
}

export interface PlaywrightSuite {
  title: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

export interface PlaywrightSpec {
  title: string;
  file: string;
  tags?: string[];
  tests: PlaywrightTest[];
}

export interface PlaywrightTest {
  projectName: string;
  results: PlaywrightTestResult[];
}

export interface PlaywrightTestResult {
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  startTime: string;
  retry: number;
  errors?: Array<{
    message?: string;
  }>;
  error?: {
    message?: string;
    stack?: string;
  };
  attachments?: Array<{
    name: string;
    contentType: string;
    path?: string;
  }>;
}

export interface PlaywrightStats {
  startTime: string;
  duration: number;
  expected: number;
  unexpected: number;
  skipped: number;
  flaky: number;
}
