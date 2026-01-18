
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
      
      CRITICAL CONTEXT:
      The following entry was flagged with LOW confidence because it is vague or lacks evidence. 
      Your goal is to extract one specific piece of information that would most improve its impact summary for a performance review.
      
      Entry Data:
      - Category: ${entry.category}
      - Inferred Impact: ${entry.impact_summary}
      - User's Raw Input: "${entry.raw_input}"
      
      GOAL: Generate exactly ONE question to improve the credibility of this entry.
      
      RULES:
      - Ask only ONE question.
      - Focus on extracting missing metrics, specific outcomes, or evidence (e.g., "What was the specific percentage improvement?", "Which service specifically did this affect?").
      - The question must be answerable in one sentence.
      - Be polite, professional, and concise.
      - Max 15 words.
      - Do not block memory storage (the entry is already stored, you are just refining it).
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
