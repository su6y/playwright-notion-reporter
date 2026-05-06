import * as core from "@actions/core";
import { Client } from "@notionhq/client";
import type { PlaywrightStats } from "../../parser/types.ts";
import type { TestEntry } from "../types.ts";
import { buildPageBlocks, statusEmoji } from "./blocks.ts";
import {
  NOTION_BLOCK_BATCH_SIZE,
  PROPERTY_NAMES,
  RATE_LIMIT_MS,
  STATUS,
  sleep,
} from "./constants.ts";
import type { ResolveOptions } from "./schema.ts";
import { resolveDataSource } from "./schema.ts";
import { uploadScreenshot } from "./upload.ts";

function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

export async function uploadAllScreenshots(
  client: Client,
  entries: TestEntry[],
): Promise<Map<string, string>> {
  const screenshotIds = new Map<string, string>();
  for (const entry of entries) {
    if (entry.screenshotPath && !screenshotIds.has(entry.screenshotPath)) {
      try {
        const id = await uploadScreenshot(client, entry.screenshotPath);
        screenshotIds.set(entry.screenshotPath, id);
        await sleep(RATE_LIMIT_MS);
      } catch (error) {
        core.warning(`Screenshot upload failed for ${entry.screenshotPath}: ${formatError(error)}`);
      }
    }
  }
  return screenshotIds;
}

export function buildPageProperties(
  stats: PlaywrightStats,
  titleProperty: string,
  options: ResolveOptions = {},
): { properties: Record<string, unknown>; overallStatus: string } {
  const overallStatus = stats.unexpected === 0 ? STATUS.PASSED : STATUS.FAILED;
  const durationSec = Math.round((stats.duration / 1000) * 10) / 10;

  const properties: Record<string, unknown> = {
    [titleProperty]: {
      title: [{ type: "mention", mention: { type: "date", date: { start: stats.startTime } } }],
    },
    [PROPERTY_NAMES.STATUS]: { select: { name: overallStatus } },
    [PROPERTY_NAMES.DURATION]: { number: durationSec },
    [PROPERTY_NAMES.PASSED]: { number: stats.expected },
    [PROPERTY_NAMES.FAILED]: { number: stats.unexpected },
    [PROPERTY_NAMES.SKIPPED]: { number: stats.skipped },
    [PROPERTY_NAMES.FLAKY]: { number: stats.flaky },
  };
  if (options.product) properties[PROPERTY_NAMES.PRODUCT] = { select: { name: options.product } };
  if (options.testType)
    properties[PROPERTY_NAMES.TEST_TYPE] = { select: { name: options.testType } };

  return { properties, overallStatus };
}

export async function sendToNotion(
  token: string,
  databaseId: string,
  stats: PlaywrightStats,
  entries: TestEntry[],
  options: ResolveOptions = {},
  client: Client = new Client({ auth: token }),
): Promise<void> {
  const { dataSourceId, titleProperty } = await resolveDataSource(client, databaseId, options);

  const screenshotIds = await uploadAllScreenshots(client, entries);
  const { properties, overallStatus } = buildPageProperties(stats, titleProperty, options);
  const children = buildPageBlocks(entries, screenshotIds);

  const firstBatch = children.slice(0, NOTION_BLOCK_BATCH_SIZE);
  const rest = children.slice(NOTION_BLOCK_BATCH_SIZE);

  const page = await client.pages.create({
    parent: { data_source_id: dataSourceId },
    icon: { type: "emoji", emoji: statusEmoji(overallStatus) } as Parameters<
      typeof client.pages.create
    >[0]["icon"],
    properties: properties as Parameters<typeof client.pages.create>[0]["properties"],
    children: firstBatch as Parameters<typeof client.pages.create>[0]["children"],
  });

  for (let i = 0; i < rest.length; i += NOTION_BLOCK_BATCH_SIZE) {
    await sleep(RATE_LIMIT_MS);
    try {
      await client.blocks.children.append({
        block_id: page.id,
        children: rest.slice(i, i + NOTION_BLOCK_BATCH_SIZE) as Parameters<
          typeof client.blocks.children.append
        >[0]["children"],
      });
    } catch (error) {
      core.warning(
        `Failed to append blocks (batch ${i / NOTION_BLOCK_BATCH_SIZE + 2}): ${formatError(error)}`,
      );
    }
  }
}
