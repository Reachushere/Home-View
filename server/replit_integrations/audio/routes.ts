import express, { type Express, type Request, type Response } from "express";
import { chatStorage } from "../chat/storage";
import { ensureCompatibleFormat } from "./client";
import { getApprovedOpenAIConfig } from "../../openai-approval";

const audioBodyParser = express.json({ limit: "50mb" });

export function registerAudioRoutes(app: Express): void {
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id));
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", audioBodyParser, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(String(req.params.id));
      const { audio, voice = "alloy" } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      const config = await getApprovedOpenAIConfig("Voice Chat", "Process voice message with AI", "~$0.05-0.15");
      if (!config) {
        return res.status(503).json({ error: "OpenAI not available — approval denied or timed out" });
      }

      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer: audioBuffer, format: inputFormat } = await ensureCompatibleFormat(rawBuffer);

      const OpenAI = (await import("openai")).default;
      const { toFile } = await import("openai");
      const cfgOpts: any = { apiKey: config.apiKey };
      if (config.baseURL) cfgOpts.baseURL = config.baseURL;
      const openai = new OpenAI(cfgOpts);

      const file = await toFile(audioBuffer, `audio.${inputFormat}`);
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
      });
      const userTranscript = transcription.text;

      await chatStorage.createMessage(conversationId, "user", userTranscript);

      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const chatHistory = existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

      const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: chatHistory,
          stream: true,
        });

      let assistantTranscript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.content) {
          assistantTranscript += delta.content;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.content })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", assistantTranscript);

      res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error processing voice message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process voice message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process voice message" });
      }
    }
  });
}
