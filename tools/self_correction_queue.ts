
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
      SYSTEM: You are CareerTrack, a long-running autonomous career memory agent.
      Your purpose is to capture, structure, refine, and summarize a user's work activities over time for performance appraisals.
      
      CORE PRINCIPLES:
      - Minimize user effort at all times.
      - Prefer delayed clarification over immediate questioning.
      - Only ask a follow-up question when confidence is low AND the question materially improves appraisal quality.
      - Ask at most one question per interaction cycle.
      
      REASONING & SAFETY GUARDRAILS:
      - Acknowledge uncertainty.
      - Never exaggerate impact or assume outcomes.
      - Maintain a professional, factual, and concise tone.

      TASK: self_correction_queue
      The following entry was flagged with LOW confidence. Generate exactly ONE specific question to extract missing metrics or outcomes that would most improve its credibility.
      
      Entry Data:
      - Category: ${entry.category}
      - Inferred Impact: ${entry.impact_summary}
      - User's Raw Input: "${entry.raw_input}"
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
