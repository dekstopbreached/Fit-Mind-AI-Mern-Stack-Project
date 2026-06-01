import express from "express";
import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import authMiddleware from "../middleware/auth.js";
import Message from "../models/Message.js";
import Habit from "../models/Habit.js";

const router = express.Router();
const configuredProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const geminiApiKey = process.env.GEMINI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const provider =
  configuredProvider === "openai" && openaiApiKey
    ? "openai"
    : geminiApiKey
      ? "gemini"
      : configuredProvider === "openai"
        ? "openai"
        : "gemini";

const client =
  provider === "openai"
    ? new OpenAI({ apiKey: openaiApiKey })
    : new GoogleGenAI({ apiKey: geminiApiKey });

if (provider === "openai" && !openaiApiKey) {
  console.error("AI provider is set to OpenAI, but OPENAI_API_KEY is missing.");
}

if (provider === "gemini" && !geminiApiKey) {
  console.error("AI provider is set to Gemini, but GEMINI_API_KEY is missing.");
}

const buildPrompt = (content, user) => `You are FitMind AI, a supportive performance coach and routine advisor.\nUser: ${user?.name || "User"} (${user?.email || "unknown"})\n${content}\nAnswer clearly with practical suggestions and reference consistency, recovery, and progress where helpful.`;

const parseOpenAIResponse = (response) => {
  if (!response?.output) return "";
  return response.output
    .flatMap((item) => item.content || [])
    .map((piece) => piece.text || "")
    .join("");
};

const parseGeminiResponse = (response) => {
  if (!response) return "";
  return (
    response.text ||
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("") ||
    ""
  );
};

const generateText = async (prompt) => {
  if (provider === "openai") {
    const response = await client.responses.create({
      model: openaiModel,
      input: prompt,
    });
    return parseOpenAIResponse(response);
  }

  const response = await client.models.generateContent({
    model: geminiModel,
    contents: prompt,
  });
  return parseGeminiResponse(response);
};

router.use(authMiddleware);
router.post("/chat", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ message: "Question is required" });

  try {
    // persist user message
    await Message.create({ userId: req.user._id, role: "user", content: question, provider });

    // include recent conversation as context
    const recent = await Message.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    const history = recent
      .reverse()
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `${history}\nQuestion: ${question}`;
    const content = await generateText(buildPrompt(prompt, req.user));

    // persist assistant reply
    const assistant = await Message.create({ userId: req.user._id, role: "assistant", content, provider });

    res.json({ content: content || "FitMind AI could not generate a response.", messageId: assistant._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI request failed" });
  }
});

// Return recent conversation history for the authenticated user
router.get("/history", async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load history" });
  }
});

router.post("/weekly-report", async (req, res) => {
  try {
    const content = await generateText(
      buildPrompt(
        "Generate a concise, friendly weekly review for the user describing progress, streaks, and recommendations for the next week.",
        req.user
      )
    );
    res.json({ content: content || "FitMind AI could not generate a report." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI request failed" });
  }
});

router.post("/suggest-habits", async (req, res) => {
  const { goals, productiveTime, struggles } = req.body;
  if (!goals || !productiveTime || !struggles)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const prompt = `Create exactly 3 suggested routines for the user based on their goals, productive time, and struggles. Respond in valid JSON with a root object containing a field named suggestions. Each suggestion should include: name, icon, category, frequency, description, and reason.`;
    const userRequest = `Goals: ${goals}\nProductive time: ${productiveTime}\nStruggles: ${struggles}`;

    // persist request
    await Message.create({ userId: req.user._id, role: "user", content: `suggest-habits: ${userRequest}`, provider });

    const raw = await generateText(buildPrompt(`${prompt}\n${userRequest}`, req.user));
    let suggestions = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
    } catch {
      suggestions = [
        {
          name: "Focus burst",
          icon: "⚡",
          category: "Productivity",
          frequency: "daily",
          description: "Do one focused 25-minute work session during your most productive time.",
          reason: "Helps build a consistent routine around your natural energy window.",
        },
      ];
    }
    // persist assistant suggestions
    await Message.create({ userId: req.user._id, role: "assistant", content: JSON.stringify({ suggestions }), provider });
    res.json({ suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI request failed" });
  }
});

// Save a single suggestion as a Habit for the user
router.post("/save-suggestion", async (req, res) => {
  const { suggestion } = req.body;
  if (!suggestion || !suggestion.name) return res.status(400).json({ message: "Suggestion with a name is required" });

  try {
    const habit = await Habit.create({
      userId: req.user._id,
      name: suggestion.name,
      description: suggestion.description || "",
      category: suggestion.category || "General",
      frequency: suggestion.frequency || "daily",
      icon: suggestion.icon || "🎯",
    });
    res.json({ habit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not save suggestion" });
  }
});

router.post("/recovery-plan", async (req, res) => {
  const { habitId } = req.body;
  try {
    const content = await generateText(
      buildPrompt(
        `A user has a broken streak for habit id ${habitId}. Provide a supportive 3-step recovery plan to help them restart with confidence.`,
        req.user
      )
    );
    res.json({ content: content || "FitMind AI could not generate a recovery plan." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI request failed" });
  }
});

router.get("/morning", async (req, res) => {
  try {
    const content = await generateText(
      buildPrompt(
        "Create a brief motivational message for the user to start their day with confidence.",
        req.user
      )
    );
    res.json({ content: content || "Good morning! Let's build a stronger day." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "AI request failed" });
  }
});

export default router;
