import { describe, it, expect, vi } from "vitest";
import { resolveDataSource } from "../../../src/reporter/notion/schema.ts";

function makeClient(
  overrides: {
    dbDataSources?: Array<{ id: string }>;
    dsProperties?: Record<string, { type: string }>;
  } = {},
) {
  const { dbDataSources = [{ id: "ds-1" }], dsProperties = { Name: { type: "title" } } } =
    overrides;
  return {
    databases: {
      retrieve: vi.fn().mockResolvedValue({ data_sources: dbDataSources }),
    },
    dataSources: {
      retrieve: vi.fn().mockResolvedValue({ properties: dsProperties }),
      update: vi.fn().mockResolvedValue({}),
    },
    views: {
      list: vi.fn().mockResolvedValue({ results: [{ id: "view-1" }] }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("resolveDataSource", () => {
  it("throws when no data sources found", async () => {
    const client = makeClient({ dbDataSources: [] });
    await expect(resolveDataSource(client as any, "db-id")).rejects.toThrow(
      "No data sources found",
    );
  });

  it("skips update when all properties exist", async () => {
    const client = makeClient({
      dsProperties: {
        Name: { type: "title" },
        Status: { type: "select" },
        "Duration (s)": { type: "number" },
        Passed: { type: "number" },
        Failed: { type: "number" },
        Skipped: { type: "number" },
        Flaky: { type: "number" },
      },
    });
    const result = await resolveDataSource(client as any, "db-id");
    expect(client.dataSources.update).not.toHaveBeenCalled();
    expect(result.titleProperty).toBe("Name");
  });

  it("uses default Name when no title property found", async () => {
    const client = makeClient({ dsProperties: { Status: { type: "select" } } });
    const result = await resolveDataSource(client as any, "db-id");
    expect(result.titleProperty).toBe("Name");
  });

  it("detects custom title property name", async () => {
    const client = makeClient({ dsProperties: { タイトル: { type: "title" } } });
    const result = await resolveDataSource(client as any, "db-id");
    expect(result.titleProperty).toBe("タイトル");
  });
});
