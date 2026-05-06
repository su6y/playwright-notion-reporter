export const RATE_LIMIT_MS: number = 350;
export const NOTION_BLOCK_BATCH_SIZE: number = 100;
export const MAX_RICH_TEXT: number = 2000;
export const IMAGE_CONTENT_TYPE: string = "image/png";

export const STATUS = {
  PASSED: "passed",
  FAILED: "failed",
  TIMED_OUT: "timedOut",
  SKIPPED: "skipped",
} as const;

export const PROPERTY_NAMES = {
  STATUS: "Status",
  DURATION: "Duration (s)",
  PASSED: "Passed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  FLAKY: "Flaky",
  PRODUCT: "Product",
  TEST_TYPE: "Test Type",
} as const;

export const COLUMN_WIDTH: number = 112;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
