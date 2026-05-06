export interface TestEntry {
  title: string;
  titlePath: string[];
  status: string;
  duration: number;
  file: string;
  project: string;
  error: string;
  retry: number;
  tags: string[];
  startedAt: string;
  screenshotPath?: string;
}
