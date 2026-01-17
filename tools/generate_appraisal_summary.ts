
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry, AppraisalSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const APPRAISAL_OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    period: { 
      type: Type.STRING,
      description: "The time frame covered by the memory entries."
    },
    topStrengths: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Core themes or skills that appear frequently with high impact."
    },
    keyAchievements: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Manager-ready narratives describing specific high-impact achievements."
    },
    growthAreas: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Specific areas for improvement identified from challenges or learnings."
    },
    executiveSummary: { 
      type: Type.STRING,
      description: "A 2-3 sentence overview of overall performance and trajectory."
    },
    recommendedFocus: { 
      type: Type.STRING,
      description: "Actionable advice for the next performance period."
    },
    gapAnalysis: {
      type: Type.STRING,
      description: "Identification of skills or metrics that are underrepresented in the current memory."
    }
  },
  required: ["period", "topStrengths", "keyAchievements", "growthAreas", "executiveSummary", "recommendedFocus", "gapAnalysis"],
};

export const generateAppraisalSummaryTool = async (entries: CareerEntry[]): Promise<AppraisalSummary> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `
      SYSTEM: You are CareerTrack, a long-running autonomous career memory agent.
      Your purpose is to capture, structure, refine, and summarize a user's work activities over time for performance appraisals.
      
      CORE PRINCIPLES:
      - Use multi-step reasoning when generating summaries.
      - Never fabricate achievements or evidence.
      - Maintain long-term continuity and factual integrity.
      
      REASONING & SAFETY GUARDRAILS:
      1. ACKNOWLEDGE UNCERTAINTY: If information is missing, acknowledge the gap instead of filling it with generic text.
      2. NEVER EXAGGERATE: Maintain absolute factual integrity. Do not use puffery or overstate impact.
      3. NO ASSUMPTIONS: Never assume promotions, salary outcomes, or specific recognitions.
      4. FACTUAL OVER PERSUASIVE: The report must be a factual summary of performance, not a persuasive sales pitch.

      TASK: generate_appraisal_summary
      Produce a formal, manager-ready appraisal summary based strictly on the provided career memory. Map every claim directly to stored entries.
      
      Career Memory: ${JSON.stringify(entries)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: APPRAISAL_OUTPUT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  return JSON.parse(text);
};
