
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
      Role: CareerTrack Autonomous Agent
      Task: generate_appraisal_summary
      
      Perform multi-step reasoning over the following career memory to produce a formal, manager-ready appraisal summary.
      
      Career Memory: ${JSON.stringify(entries)}
      
      REASONING & SAFETY GUARDRAILS:
      - If information is missing, acknowledge uncertainty.
      - Never exaggerate impact.
      - Never assume promotions, outcomes, or recognition.
      - Prefer factual summaries over persuasive language.
      - Every claim MUST map to stored entries.
      
      Reasoning Steps:
      1. Theme Clustering: Identify recurring themes and ownership signals.
      2. Impact Extraction: Isolate specific team impacts.
      3. Leadership & Growth: Detect leadership signals.
      4. Gap Detection: Analyze for missing competencies or evidence.
      5. Narrative Synthesis: Produce concise, copy-ready narratives.
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
