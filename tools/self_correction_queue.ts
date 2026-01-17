
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SELF_CORRECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "A mandatory, concise question to extract missing metrics or specific outcomes.",
    }
  },
  required: ["question"],
};

export const selfCorrectionQueueTool = async (entry: CareerEntry) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent (Appraisal Refiner)
      Task: self_correction_queue
      
      The following entry lacks specific metrics or outcomes needed for a high-quality performance appraisal.
      
      Entry Data:
      - Category: ${entry.category}
      - Impact Summary: ${entry.impact_summary}
      - Raw Input: "${entry.raw_input}"
      
      Goal: Generate exactly ONE question that forces the user to provide missing evidence, metrics, or specific outcomes.
      
      Rules:
      - Ask only ONE question.
      - The question must be answerable in one sentence.
      - Focus strictly on missing evidence, metrics, or specific outcomes (e.g., revenue, user count, latency reduction).
      - Be polite but direct.
      - Max 15 words.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: SELF_CORRECTION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from self-correction agent");
  return JSON.parse(text);
};
