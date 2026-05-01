import * as core from "@actions/core";
import { readFile } from "node:fs/promises";
import { parseReport } from "./parser/playwright.ts";
import { sendToNotion } from "./reporter/notion/client.ts";
import type { PlaywrightJsonReport } from "./types.ts";

async function run(): Promise<void> {
  try {
    const notionToken = core.getInput("notion-token", { required: true });
    const databaseId = core.getInput("database-id", { required: true });
    const reportPath = core.getInput("report-path", { required: true });
    const product = core.getInput("product") || undefined;
    const testType = core.getInput("test-type") || undefined;

    core.info(`Reading report from ${reportPath}`);
    const raw = await readFile(reportPath, "utf-8");
    const report: PlaywrightJsonReport = JSON.parse(raw);

    const entries = parseReport(report);
    core.info(`Found ${entries.length} test result(s)`);

    if (entries.length === 0) {
      core.info("No test results to send");
      return;
    }

    await sendToNotion(notionToken, databaseId, report.stats, entries, { product, testType });
    core.info(`Sent test run to Notion (${entries.length} tests)`);

    core.setOutput("entries-created", entries.length);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : "Unknown error occurred");
  }
}

run();
