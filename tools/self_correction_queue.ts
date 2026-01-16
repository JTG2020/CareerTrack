
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SELF_CORRECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "A single, one-sentence question to improve the entry's impact or credibility.",
    }
  },
  required: ["question"],
};

export const selfCorrectionQueueTool = async (entry: CareerEntry) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent
      Task: self_correction_queue
      
      You have captured a career memory entry with LOW confidence. 
      Generate a single, concise clarification question that would most improve the appraisal quality of this entry.
      
      Entry Category: ${entry.category}
      Impact Summary: ${entry.impact_summary}
      Raw Input: "${entry.raw_input}"
      
      Rules:
      - Ask only ONE question.
      - The question must be answerable in one sentence.
      - Focus on missing evidence, metrics, or specific outcomes.
      - Be polite but direct.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: SELF_CORRECTION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  return JSON.parse(text);
};
