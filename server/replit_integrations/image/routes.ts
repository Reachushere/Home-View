import type { Express, Request, Response } from "express";
import { getApprovedOpenAIConfig } from "../../openai-approval";

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const config = await getApprovedOpenAIConfig("Image Generation", `Generate image: "${prompt.slice(0, 50)}..."`, "~$0.04-0.08");
      if (!config) {
        return res.status(503).json({ error: "OpenAI not available — approval denied or timed out" });
      }

      const OpenAI = (await import("openai")).default;
      const cfgOpts: any = { apiKey: config.apiKey };
      if (config.baseURL) cfgOpts.baseURL = config.baseURL;
      const openai = new OpenAI(cfgOpts);

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: size as "1024x1024" | "512x512" | "256x256",
      });

      const imageData = response.data?.[0];
      res.json({
        url: imageData.url,
        b64_json: imageData.b64_json,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}
