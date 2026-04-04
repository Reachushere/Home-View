import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function getPersonalOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
    });
    const base64 = response.data?.[0]?.b64_json ?? "";
    return Buffer.from(base64, "base64");
  } catch (err: any) {
    const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Rate limit');
    if (is429) {
      const personal = getPersonalOpenAI();
      if (personal) {
        console.log(`[Image] Replit OpenAI rate limited — falling back to personal OpenAI`);
        const response = await personal.images.generate({
          model: "dall-e-3",
          prompt,
          size: size === "256x256" ? "1024x1024" : size as any,
          response_format: "b64_json",
        });
        const base64 = response.data?.[0]?.b64_json ?? "";
        return Buffer.from(base64, "base64");
      }
    }
    throw err;
  }
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  try {
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
  } catch (err: any) {
    const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('Rate limit');
    if (is429) {
      const personal = getPersonalOpenAI();
      if (personal) {
        console.log(`[Image Edit] Replit OpenAI rate limited — falling back to personal OpenAI`);
        const response = await personal.images.edit({
          model: "dall-e-2",
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
    }
    throw err;
  }
}
