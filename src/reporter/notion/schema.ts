import type { Client } from "@notionhq/client";
import { COLUMN_WIDTH, PROPERTY_NAMES, RATE_LIMIT_MS, STATUS, sleep } from "./constants.ts";

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

  const ds = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const existing = ds.properties as Record<
    string,
    { type: string; select?: { options: Array<{ name: string }> } }
  >;

  const titleProperty = detectTitleProperty(existing);
  await ensureSchemaProperties(client, dataSourceId, existing, options);
  await reorderViewColumns(client, databaseId, dataSourceId, titleProperty);

  return { dataSourceId, titleProperty };
}

export function detectTitleProperty(properties: Record<string, { type: string }>): string {
  for (const [name, prop] of Object.entries(properties)) {
    if (prop.type === "title") return name;
  }
  return "Name";
}

export async function ensureSchemaProperties(
  client: Client,
  dataSourceId: string,
  existing: Record<string, { type: string }>,
  options: ResolveOptions,
): Promise<void> {
  const toUpdate: Record<string, Record<string, unknown>> = {};
  const existingNames = new Set(Object.keys(existing));

  const fixed: Record<string, Record<string, unknown>> = {
    [PROPERTY_NAMES.STATUS]: {
      select: {
        options: [
          { name: STATUS.PASSED, color: "green" },
          { name: STATUS.FAILED, color: "red" },
        ],
      },
    },
    [PROPERTY_NAMES.DURATION]: { number: {} },
    [PROPERTY_NAMES.PASSED]: { number: {} },
    [PROPERTY_NAMES.FAILED]: { number: {} },
    [PROPERTY_NAMES.SKIPPED]: { number: {} },
    [PROPERTY_NAMES.FLAKY]: { number: {} },
  };
  for (const [name, schema] of Object.entries(fixed)) {
    if (!existingNames.has(name)) toUpdate[name] = schema;
  }

  const optionalSelects: Record<string, string | undefined> = {
    [PROPERTY_NAMES.PRODUCT]: options.product,
    [PROPERTY_NAMES.TEST_TYPE]: options.testType,
  };
  for (const [propName, value] of Object.entries(optionalSelects)) {
    if (!value) continue;
    if (!existingNames.has(propName)) {
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
}

export async function reorderViewColumns(
  client: Client,
  databaseId: string,
  dataSourceId: string,
  titleProperty: string,
): Promise<void> {
  const latest = await client.dataSources.retrieve({ data_source_id: dataSourceId });
  const props = latest.properties as Record<string, { id: string; type: string }>;

  const desiredOrder = [titleProperty, PROPERTY_NAMES.STATUS];
  if (props[PROPERTY_NAMES.PRODUCT]) desiredOrder.push(PROPERTY_NAMES.PRODUCT);
  if (props[PROPERTY_NAMES.TEST_TYPE]) desiredOrder.push(PROPERTY_NAMES.TEST_TYPE);
  desiredOrder.push(
    PROPERTY_NAMES.DURATION,
    PROPERTY_NAMES.PASSED,
    PROPERTY_NAMES.FAILED,
    PROPERTY_NAMES.SKIPPED,
    PROPERTY_NAMES.FLAKY,
  );

  const ordered = desiredOrder
    .map((name) =>
      props[name]
        ? {
            property_id: props[name].id,
            visible: true,
            width: name === titleProperty ? undefined : COLUMN_WIDTH,
          }
        : null,
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
}
