
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CAPTURE_ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { 
      type: Type.STRING, 
      description: "Must be 'log_entry' for factual work, or 'meta_command' for requests like 'write my appraisal' or 'summarize my week'." 
    },
    feedback: { 
      type: Type.STRING, 
      description: "A polite message to the user if the intent is 'meta_command' or if the input is too vague to log." 
    },
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
  },
  required: [
    "intent",
    "feedback",
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
};

export const captureEntryTool = async (input: string, currentTimeIso: string, timezone: string, currentEntryCount: number) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      SYSTEM: You are CareerTrack, a long-running autonomous career memory agent.
      Your purpose is to capture, structure, refine, and summarize a user's work activities over time for performance appraisals.
      
      CORE PRINCIPLES:
      - Minimize user effort at all times.
      - Convert unstructured input into structured career memory.
      - Maintain long-term continuity using Thought Signatures.
      - You are NOT a chatbot; however, you must detect if a user is giving a command vs logging work.
      - REJECT DIRECT GENERATION: If the user asks you to "Write my appraisal", "Summarize my year", or similar commands without providing a factual log, set intent to 'meta_command'.
      - If intent is 'meta_command', provide feedback prompting them to log specific work activities first.
      - Only set intent to 'log_entry' if the input describes a specific task, achievement, challenge, or learning.

      REASONING & SAFETY GUARDRAILS:
      1. ACKNOWLEDGE UNCERTAINTY: If information is missing, acknowledge uncertainty in the feedback.
      2. NEVER EXAGGERATE: Do not inflate impact. 
      3. NO ASSUMPTIONS: Never assume promotions, outcomes, or recognition.
      
      TASK: capture_entry
      - Detect Intent: 'log_entry' (factual) or 'meta_command' (request for appraisal/reflection/summary).
      - If 'log_entry': Classify into achievement, challenge, or learning. Infer skills and impact conservatively.
      - Context: User currently has ${currentEntryCount} entries in memory.
      
      CONTEXT:
      Current Date/Time: ${currentTimeIso}
      User Timezone: ${timezone}
      User Input: "${input}"
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
  
  if (!result.timestamp || result.timestamp.includes("2023")) {
    result.timestamp = currentTimeIso;
  }
  return result;
};
