import type { TestEntry } from "../../types.ts";

const MAX_RICH_TEXT = 2000;
// oxlint-disable-next-line no-control-regex -- intentional ANSI escape matching
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

export function truncate(text: string, max: number = MAX_RICH_TEXT): string {
  const clean = stripAnsi(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 3) + "...";
}

export function statusEmoji(status: string): string {
  switch (status) {
    case "passed":
      return "✅";
    case "failed":
      return "❌";
    case "timedOut":
      return "⏰";
    case "skipped":
      return "⏭️";
    default:
      return "❓";
  }
}

export function buildPageBlocks(
  entries: TestEntry[],
  screenshotIds: Map<string, string>,
): unknown[] {
  const blocks: unknown[] = [];

  for (const entry of entries) {
    const emoji = statusEmoji(entry.status);
    const duration = `${entry.duration}ms`;
    const header = `${emoji} ${entry.titlePath.join(" > ")}`;
    const detail = [entry.status, duration, entry.file].filter(Boolean).join(" · ");

    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: truncate(header) } }],
      },
    });

    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: detail },
            annotations: { code: true, color: "gray" },
          },
        ],
      },
    });

    if (entry.error) {
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: truncate(entry.error) } }],
          language: "typescript",
        },
      });
    }

    const uploadId = entry.screenshotPath ? screenshotIds.get(entry.screenshotPath) : undefined;
    if (uploadId) {
      blocks.push({
        object: "block",
        type: "image",
        image: { type: "file_upload", file_upload: { id: uploadId } },
      });
    }

    blocks.push({ object: "block", type: "divider", divider: {} });
  }

  return blocks;
}
