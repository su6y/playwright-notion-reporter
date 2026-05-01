import * as core from "@actions/core";
import { Client } from "@notionhq/client";
import type { PlaywrightStats, TestEntry } from "../../types.ts";
import { buildPageBlocks, statusEmoji } from "./blocks.ts";
import { RATE_LIMIT_MS, sleep } from "./constants.ts";
import type { ResolveOptions } from "./schema.ts";
import { resolveDataSource } from "./schema.ts";
import { uploadScreenshot } from "./upload.ts";

export async function sendToNotion(
  token: string,
  databaseId: string,
  stats: PlaywrightStats,
  entries: TestEntry[],
  options: ResolveOptions = {},
): Promise<void> {
  const client = new Client({ auth: token });
  const { dataSourceId, titleProperty } = await resolveDataSource(client, databaseId, options);

  // Upload screenshots
  const screenshotIds = new Map<string, string>();
  for (const entry of entries) {
    if (entry.screenshotPath && !screenshotIds.has(entry.screenshotPath)) {
      try {
        const id = await uploadScreenshot(client, entry.screenshotPath);
        screenshotIds.set(entry.screenshotPath, id);
        await sleep(RATE_LIMIT_MS);
      } catch (error) {
        core.warning(
          `Screenshot upload failed for ${entry.screenshotPath}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  const overallStatus = stats.unexpected === 0 ? "passed" : "failed";
  const durationSec = Math.round((stats.duration / 1000) * 10) / 10;

  const properties: Record<string, unknown> = {
    [titleProperty]: {
      title: [{ type: "mention", mention: { type: "date", date: { start: stats.startTime } } }],
    },
    Status: { select: { name: overallStatus } },
    "Duration (s)": { number: durationSec },
    Passed: { number: stats.expected },
    Failed: { number: stats.unexpected },
    Skipped: { number: stats.skipped },
    Flaky: { number: stats.flaky },
  };
  if (options.product) properties.Product = { select: { name: options.product } };
  if (options.testType) properties["Test Type"] = { select: { name: options.testType } };

  const children = buildPageBlocks(entries, screenshotIds);

  const firstBatch = children.slice(0, 100);
  const rest = children.slice(100);

  const page = await client.pages.create({
    parent: { data_source_id: dataSourceId },
    icon: { type: "emoji", emoji: statusEmoji(overallStatus) } as Parameters<
      typeof client.pages.create
    >[0]["icon"],
    properties: properties as Parameters<typeof client.pages.create>[0]["properties"],
    children: firstBatch as Parameters<typeof client.pages.create>[0]["children"],
  });

  for (let i = 0; i < rest.length; i += 100) {
    await sleep(RATE_LIMIT_MS);
    try {
      await client.blocks.children.append({
        block_id: page.id,
        children: rest.slice(i, i + 100) as Parameters<
          typeof client.blocks.children.append
        >[0]["children"],
      });
    } catch (error) {
      core.warning(
        `Failed to append blocks (batch ${i / 100 + 2}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
