import type { Client } from "@notionhq/client";
import { RATE_LIMIT_MS, sleep } from "./constants.ts";

export interface ResolveOptions {
  product?: string;
  testType?: string;
}

export async function resolveDataSource(
  client: Client,
  databaseId: string,
  options: ResolveOptions = {},
): Promise<{ dataSourceId: string; titleProperty: string }> {
  const db = await client.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources[0]) {
    throw new Error("No data sources found for database " + databaseId);
  }
  const dataSourceId = db.data_sources[0].id;

  const ds = await client.dataSources.retrieve({
    data_source_id: dataSourceId,
  });
  const existing = ds.properties as Record<
    string,
    { type: string; select?: { options: Array<{ name: string }> } }
  >;

  let titleProperty = "Name";
  for (const [name, prop] of Object.entries(existing)) {
    if (prop.type === "title") {
      titleProperty = name;
      break;
    }
  }

  // Build properties to create or update
  const toUpdate: Record<string, Record<string, unknown>> = {};
  const existingNames = new Set(Object.keys(existing));

  // Fixed properties — only add if missing
  const fixed: Record<string, Record<string, unknown>> = {
    Status: {
      select: {
        options: [
          { name: "passed", color: "green" },
          { name: "failed", color: "red" },
        ],
      },
    },
    "Duration (s)": { number: {} },
    Passed: { number: {} },
    Failed: { number: {} },
    Skipped: { number: {} },
    Flaky: { number: {} },
  };
  for (const [name, schema] of Object.entries(fixed)) {
    if (!existingNames.has(name)) toUpdate[name] = schema;
  }

  // Optional select properties — create if missing, or add new option value
  const optionalSelects: Record<string, string | undefined> = {
    Product: options.product,
    "Test Type": options.testType,
  };
  for (const [propName, value] of Object.entries(optionalSelects)) {
    if (!value) continue;
    if (!existingNames.has(propName)) {
      // Property doesn't exist → create empty select (Notion auto-assigns colors on page creation)
      toUpdate[propName] = { select: {} };
    }
  }

  if (Object.keys(toUpdate).length > 0) {
    await client.dataSources.update({
      data_source_id: dataSourceId,
      properties: toUpdate as Parameters<typeof client.dataSources.update>[0]["properties"],
    });
    await sleep(RATE_LIMIT_MS);
  }

  // Reorder view columns
  const latest = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const props = latest.properties as Record<string, { id: string; type: string }>;
  const desiredOrder = [titleProperty, "Status"];
  if (props.Product) desiredOrder.push("Product");
  if (props["Test Type"]) desiredOrder.push("Test Type");
  desiredOrder.push("Duration (s)", "Passed", "Failed", "Skipped", "Flaky");

  const widths: Record<string, number> = {
    Status: 112,
    "Duration (s)": 112,
    Product: 112,
    "Test Type": 112,
    Passed: 112,
    Failed: 112,
    Skipped: 112,
    Flaky: 112,
  };
  const ordered = desiredOrder
    .map((name) =>
      props[name] ? { property_id: props[name].id, visible: true, width: widths[name] } : null,
    )
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const views = await client.views.list({ database_id: databaseId });
  if (views.results[0]) {
    await client.views.update({
      view_id: views.results[0].id,
      configuration: { type: "table", properties: ordered },
    });
    await sleep(RATE_LIMIT_MS);
  }

  return { dataSourceId, titleProperty };
}
