import type { Client } from "@notionhq/client";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { IMAGE_CONTENT_TYPE } from "./constants.ts";

export async function uploadScreenshot(client: Client, filePath: string): Promise<string> {
  const upload = await client.fileUploads.create({
    mode: "single_part",
    filename: basename(filePath),
    content_type: IMAGE_CONTENT_TYPE,
  });

  const fileData = await readFile(filePath);
  await client.fileUploads.send({
    file_upload_id: upload.id,
    file: {
      data: new Blob([fileData], { type: IMAGE_CONTENT_TYPE }),
      filename: basename(filePath),
    },
  });

  return upload.id;
}
