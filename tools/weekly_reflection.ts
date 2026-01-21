
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
          raw_input: { type: Type.STRING, description: "A combined or summarized string of all merged raw inputs." },
          category: { 
            type: Type.STRING,
            description: "Must be 'achievement', 'challenge', or 'learning' in lowercase.",
          },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          impact_summary: { type: Type.STRING, description: "A synthesized, high-impact summary covering all merged activities." },
          confidence_score: { type: Type.STRING },
          evidence_links: { type: Type.ARRAY, items: { type: Type.STRING } },
          refinement_state: { type: Type.STRING },
          clarification_question: { type: Type.STRING, description: "Set to empty string if resolved." },
          reflection_question: { type: Type.STRING, description: "New question generated for skipped items." },
          user_clarification_response: { type: Type.STRING, description: "Set to empty string if refined with new data." },
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
      description: "A narrative summary of the week's progress and patterns detected."
    },
    change_log: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of autonomous changes made, specifically noting merges."
    }
  },
  required: ["refined_entries", "reflection_summary", "change_log"],
};

export const weeklyReflectionTool = async (entries: CareerEntry[], timezone: string): Promise<{ 
  refined_entries: CareerEntry[], 
  reflection_summary: string, 
  change_log: string[]
}> => {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Targets: recent ones, or ones waiting for a response, or skipped ones needing prompts
  const targetEntries = entries.filter(e => {
    const isRecent = new Date(e.timestamp) >= sevenDaysAgo;
    const hasPendingResponse = !!e.user_clarification_response && e.user_clarification_response !== 'skipped';
    const isSkipped = e.user_clarification_response === 'skipped';
    return isRecent || hasPendingResponse || isSkipped;
  });

  const staticEntries = entries.filter(e => !targetEntries.includes(e));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent (Refinement & Merging Specialist)
      Task: weekly_reflection
      
      Review the entries provided and perform semantic merging and refinement.
      
      STRICT MERGING & DE-DUPLICATION RULES:
      1. SEMANTIC CLUSTERING: Identify entries that are part of the same project, workstream, or goal (e.g., "Improved CI reliability" and "Fixed flaky CI tests").
      2. MERGE ACTION: If related entries are found, MERGE them into a single, high-impact achievement.
         - Combine the impact: Synthesize a stronger 'impact_summary' that reflects the cumulative success.
         - Aggregate skills: Include a unique list of all skills mentioned across the cluster.
         - Collect evidence: Include all evidence_links from the cluster.
         - Summarize history: The 'raw_input' should be a concise summary of all inputs in the cluster.
         - Use the most recent timestamp from the merged cluster for the new entry.
      3. LOG MERGES: In the 'change_log', specifically note which entries (by summary or ID) were merged into a single achievement.

      STRICT RESOLUTION RULES:
      1. INTEGRATION: If 'user_clarification_response' is provided and NOT 'skipped':
         - Incorporate details into 'impact_summary'.
         - Upgrade 'confidence_score' to 'high'.
         - Clear 'clarification_question', 'reflection_question', and 'user_clarification_response' (set to "").
      
      2. SKIPPED HANDLING: If 'user_clarification_response' is 'skipped':
         - Generate a specific 'reflection_question' to re-prompt the user later (e.g., "Reflect on: Did the Jenkins work actually save time?").
         - Clear 'clarification_question' and 'user_clarification_response' (set to "").
      
      3. REFINEMENT: Ensure professional summaries and lowercase categories.
      
      Input Memory: ${JSON.stringify(targetEntries)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: REFLECTION_OUTPUT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from reflection agent");
  const result = JSON.parse(text);
  
  const processedRecent = result.refined_entries.map((e: any) => ({
    ...e,
    clarification_question: e.clarification_question || undefined,
    reflection_question: e.reflection_question || undefined,
    user_clarification_response: e.user_clarification_response || undefined,
    refinement_state: 'refined'
  }));
  
  return {
    refined_entries: [...processedRecent, ...staticEntries].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    reflection_summary: result.reflection_summary,
    change_log: result.change_log
  };
};
