
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
      Role: CareerTrack Autonomous Agent
      Task: weekly_reflection
      Current Date: ${now.toISOString()}
      User Timezone: ${timezone}
      
      Review the following career memory entries from the last 7 days.
      
      REASONING & SAFETY GUARDRAILS:
      - Maintain valid categories: 'achievement', 'challenge', or 'learning'.
      - Use the Current Date for context. Do NOT suggest dates from 2023.
      - If information is missing, acknowledge uncertainty.
      - Never exaggerate impact.
      - Never assume promotions, outcomes, or recognition.
      - Prefer factual summaries over persuasive language.
      
      Steps:
      1. Detect duplicates or overlapping work.
      2. Merge related entries using Thought Signatures as logic bridges. 
         - If merging, consolidate the impact_summary into a single, high-integrity achievement.
      3. Improve impact summaries ONLY where collective evidence across multiple entries exists.
      4. Promote refinement_state to 'refined' for all processed entries.
      5. Identify patterns in skills and ownership.
      
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

  // Final sanitization of categories
  refinedRecent = refinedRecent.map((entry: any) => ({
    ...entry,
    category: (entry.category || 'achievement').toLowerCase().trim()
  }));
  
  return {
    refined_entries: [...refinedRecent, ...olderEntries].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    reflection_summary: result.reflection_summary || "Reflection completed with no structural changes."
  };
};
