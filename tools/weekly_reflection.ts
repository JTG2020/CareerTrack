
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
          category: { 
            type: Type.STRING,
            description: "Must be 'achievement', 'challenge', or 'learning' in lowercase.",
          },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          impact_summary: { type: Type.STRING },
          confidence_score: { type: Type.STRING },
          evidence_links: { type: Type.ARRAY, items: { type: Type.STRING } },
          refinement_state: { type: Type.STRING },
          clarification_question: { type: Type.STRING },
          user_clarification_response: { type: Type.STRING },
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
      description: "A summary of changes: what was merged, what was refined, and any patterns detected."
    }
  },
  required: ["refined_entries", "reflection_summary"],
};

export const weeklyReflectionTool = async (entries: CareerEntry[], timezone: string): Promise<{ refined_entries: CareerEntry[], reflection_summary: string }> => {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentEntries = entries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
  const olderEntries = entries.filter(e => new Date(e.timestamp) < sevenDaysAgo);

  if (recentEntries.length === 0) {
    return { 
      refined_entries: entries, 
      reflection_summary: "No recent entries found in the last 7 days to analyze." 
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      SYSTEM: You are CareerTrack, a long-running autonomous career memory agent.
      Your purpose is to capture, structure, refine, and summarize a user's work activities over time for performance appraisals.
      
      CORE PRINCIPLES:
      - Maintain long-term continuity using Thought Signatures.
      - Perform self-correction and refinement without frequent user interruption.
      - You are an autonomous agent that reasons over time, revisits past entries, and improves data quality continuously.
      
      REASONING & SAFETY GUARDRAILS:
      - Acknowledge uncertainty.
      - Never exaggerate impact or assume outcomes (promotions, recognition).
      - Prefer factual summaries over persuasive language.

      TASK: weekly_reflection
      Review and refine the career memory entries from the last 7 days. Merge related entries using Thought Signatures.
      
      CONTEXT:
      Current Date: ${now.toISOString()}
      User Timezone: ${timezone}
      Memory to analyze: ${JSON.stringify(recentEntries)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: REFLECTION_OUTPUT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from reflection agent");
  const result = JSON.parse(text);
  
  let refinedRecent = Array.isArray(result.refined_entries) ? result.refined_entries : recentEntries;
  refinedRecent = refinedRecent.map((entry: any) => ({
    ...entry,
    category: (entry.category || 'achievement').toLowerCase().trim(),
    skills: Array.isArray(entry.skills) ? entry.skills : [],
    evidence_links: Array.isArray(entry.evidence_links) ? entry.evidence_links : []
  }));
  
  return {
    refined_entries: [...refinedRecent, ...olderEntries].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    reflection_summary: result.reflection_summary || "Reflection completed with no structural changes."
  };
};
