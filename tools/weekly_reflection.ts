
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry, EntryType, ConfidenceLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const REFLECTION_OUTPUT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    refined_entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          entry_id: { type: Type.STRING },
          thought_signature: { type: Type.STRING },
          timestamp: { type: Type.STRING },
          raw_input: { type: Type.STRING },
          category: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          impact_summary: { type: Type.STRING },
          confidence_score: { type: Type.STRING },
          evidence_links: { type: Type.ARRAY, items: { type: Type.STRING } },
          refinement_state: { type: Type.STRING },
          clarification_question: { type: Type.STRING },
        },
        required: [
          "entry_id", 
          "thought_signature", 
          "timestamp", 
          "raw_input", 
          "category", 
          "skills", 
          "impact_summary", 
          "confidence_score", 
          "refinement_state"
        ],
      },
    },
    reflection_summary: {
      type: Type.STRING,
      description: "Internal summary of what was refined or merged (not usually user-visible)."
    }
  },
  required: ["refined_entries"],
};

export const weeklyReflectionTool = async (entries: CareerEntry[]): Promise<{ refined_entries: CareerEntry[], reflection_summary?: string }> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentEntries = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
  const olderEntries = entries.filter(e => new Date(e.timestamp) < sevenDaysAgo);

  if (recentEntries.length === 0) {
    return { refined_entries: entries };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent
      Task: weekly_reflection
      
      Review the following career memory entries from the last 7 days.
      
      REASONING & SAFETY GUARDRAILS:
      - If information is missing, acknowledge uncertainty.
      - Never exaggerate impact.
      - Never assume promotions, outcomes, or recognition.
      - Prefer factual summaries over persuasive language.
      
      Steps:
      1. Detect duplicates or overlapping work.
      2. Merge related entries using Thought Signatures as logic bridges. 
      3. Improve impact summaries ONLY where collective evidence across multiple entries exists.
      4. Promote refinement_state to 'refined'.
      5. Identify patterns in skills and ownership.
      
      Memory to analyze: ${JSON.stringify(recentEntries)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: REFLECTION_OUTPUT_SCHEMA,
    },
  });

  const result = JSON.parse(response.text || "{}");
  
  return {
    refined_entries: [...result.refined_entries, ...olderEntries].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    reflection_summary: result.reflection_summary
  };
};
