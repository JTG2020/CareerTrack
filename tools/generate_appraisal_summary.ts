
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry, AppraisalSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const APPRAISAL_OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { 
      type: Type.STRING,
      description: "A high-level 2-3 sentence overview of overall performance and career trajectory. Ready for HR systems."
    },
    keyAchievements: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Manager-ready narratives describing specific high-impact achievements. Every claim MUST map to stored entries. Focus on business impact and ownership signals."
    },
    skillsAndGrowth: {
      type: Type.STRING,
      description: "A narrative highlighting leadership patterns, technical growth, and skill clusters identified from the memory."
    },
    areasForDevelopment: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Specific areas for improvement or growth based on challenges or learnings recorded."
    },
    gapAnalysis: {
      type: Type.STRING,
      description: "Detection of underrepresented areas or missing metrics/evidence that would strengthen the profile."
    }
  },
  required: [
    "executiveSummary", 
    "keyAchievements", 
    "skillsAndGrowth", 
    "areasForDevelopment", 
    "gapAnalysis"
  ],
};

export const generateAppraisalSummaryTool = async (entries: CareerEntry[]): Promise<AppraisalSummary> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `
      Role: CareerTrack Autonomous Agent (Senior Performance Analyst)
      Task: generate_appraisal_summary
      
      Generate an appraisal-ready summary using ONLY the stored memory provided below.
      
      Career Memory: ${JSON.stringify(entries)}
      
      MULTI-STEP REASONING FLOW:
      1. Cluster entries by themes and skills: Group related activities to identify core competencies.
      2. Identify business impact and ownership signals: Look for outcomes, metrics, and instances where the user took the lead.
      3. Highlight leadership and growth patterns: Trace the evolution of responsibilities and technical depth.
      4. Detect gaps or underrepresented areas: Identify what's missing (e.g., lack of quantitative results for certain projects).
      5. Produce a concise, manager-ready narrative: Format the output for direct use in HR systems.
      
      CONSTRAINTS:
      - DO NOT invent achievements or exaggerate impact.
      - Every claim must map directly to one or more stored entries.
      - Use professional, punchy, and factual language.
      - If an entry has a 'user_clarification_response', prioritize that specific detail.
      - If an entry has 'user_clarification_response' as 'skipped', do not treat it as verified high-impact; instead, note the potential gap.
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
