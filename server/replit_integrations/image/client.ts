import fs from "node:fs";
import { Buffer } from "node:buffer";
import { getApprovedOpenAIConfig } from "../../openai-approval";

async function getApprovedOpenAIClient() {
  const config = await getApprovedOpenAIConfig("Image Generation", "Generate or edit an image", "~$0.04-0.08");
  if (!config) throw new Error("OpenAI not available — approval denied or timed out");
  const OpenAI = (await import("openai")).default;
  const opts: any = { apiKey: config.apiKey };
  if (config.baseURL) opts.baseURL = config.baseURL;
  return new OpenAI(opts);
}

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const openai = await getApprovedOpenAIClient();
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const openai = await getApprovedOpenAIClient();
  const { toFile } = await import("openai");
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
