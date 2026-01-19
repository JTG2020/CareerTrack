
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CAPTURE_ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    entry_id: { type: Type.STRING },
    thought_signature: { type: Type.STRING },
    timestamp: { type: Type.STRING },
    raw_input: { type: Type.STRING },
    category: { 
      type: Type.STRING,
      description: "Must be exactly 'achievement', 'challenge', or 'learning'.",
    },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    impact_summary: { type: Type.STRING },
    confidence_score: { 
      type: Type.STRING,
      description: "Must be 'low', 'medium', or 'high'.",
    },
    evidence_links: { type: Type.ARRAY, items: { type: Type.STRING } },
    refinement_state: { type: Type.STRING },
    duplicate_risk_detected: {
      type: Type.BOOLEAN,
      description: "True if the input is highly similar or directly related to an existing entry."
    },
    duplicate_confirmation_question: {
      type: Type.STRING,
      description: "A question to ask the user if duplicate_risk_detected is true."
    },
    is_off_task: {
      type: Type.BOOLEAN,
      description: "True if the input is prompt abuse, small talk, or a direct request to generate an appraisal rather than logging an activity."
    },
    rejection_message: {
      type: Type.STRING,
      description: "A professional response if is_off_task is true, guiding the user back to proper tool usage."
    }
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
    "refinement_state",
    "duplicate_risk_detected",
    "is_off_task"
  ],
};

export const captureEntryTool = async (input: string, existingEntries: CareerEntry[], currentTimeIso: string, timezone: string) => {
  const context = existingEntries.slice(0, 15).map(e => ({
    summary: e.impact_summary,
    date: e.timestamp,
    category: e.category
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      Role: CareerTrack Autonomous Agent (Strict Factual Capture)
      Task: capture_entry
      
      CONTEXT:
      Current Date/Time: ${currentTimeIso}
      User Timezone: ${timezone}
      New Input: "${input}"
      
      STRICT OPERATING PRINCIPLES (GUARDRAILS):
      1. REJECT OFF-TASK PROMPTS: If the user input is not a work activity (e.g., small talk like "what is your name" or direct commands like "write my appraisal"), set is_off_task to true and provide a rejection_message.
      2. ACKNOWLEDGE UNCERTAINTY: If information is missing in the user's activity description, acknowledge uncertainty in the impact_summary rather than making assumptions.
      3. NO EXAGGERATION: Never exaggerate the impact of a task. Prefer conservative, factual summaries.
      4. NO ASSUMPTIONS: Never assume promotions, specific outcomes, or recognition unless explicitly stated.
      5. NEUTRAL TONE: Prefer neutral, professional summaries over persuasive or marketing-heavy language.
      
      STRICT CONFIDENCE SCORING RULES:
      1. LOW: Vague activities ("Worked on Jenkins").
      2. MEDIUM: Specific tasks without metrics ("Finished the UI").
      3. HIGH: Accomplishments with metrics ("Reduced latency by 20%").

      EXISTING MEMORIES:
      ${JSON.stringify(context)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: CAPTURE_ENTRY_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  const result = JSON.parse(text);
  
  if (result.category) result.category = result.category.toLowerCase().trim();
  if (result.confidence_score) result.confidence_score = result.confidence_score.toLowerCase().trim();
  
  result.raw_input = input;
  if (!result.timestamp) {
    result.timestamp = currentTimeIso;
  }
  return result;
};
