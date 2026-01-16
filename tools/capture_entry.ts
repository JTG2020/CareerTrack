
import { GoogleGenAI, Type } from "@google/genai";

// Always use the required initialization format with named apiKey parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CAPTURE_ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    entry_id: {
      type: Type.STRING,
      description: "A unique identifier for the entry.",
    },
    thought_signature: {
      type: Type.STRING,
      description: "A unique reasoning signature for continuity (e.g., 'technical-growth-challenge').",
    },
    timestamp: {
      type: Type.STRING,
      description: "ISO 8601 timestamp of the entry.",
    },
    raw_input: {
      type: Type.STRING,
      description: "The original text provided by the user.",
    },
    category: {
      type: Type.STRING,
      description: "Must be 'achievement', 'challenge', or 'learning'.",
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Specific skills inferred from the input.",
    },
    impact_summary: {
      type: Type.STRING,
      description: "A concise, conservative summary of the inferred impact.",
    },
    confidence_score: {
      type: Type.STRING,
      description: "Must be 'low', 'medium', or 'high'.",
    },
    evidence_links: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Extracted links or references if present in input.",
    },
    refinement_state: {
      type: Type.STRING,
      description: "Initial state, should be 'pending'.",
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
    "evidence_links", 
    "refinement_state"
  ],
};

export const captureEntryTool = async (input: string) => {
  const now = new Date().toISOString();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent
      Task: capture_entry
      
      Interpret the following user input as a raw career activity and output a structured memory object.
      
      REASONING & SAFETY GUARDRAILS:
      - If information is missing, acknowledge uncertainty in the impact_summary.
      - Never exaggerate impact.
      - Never assume promotions, outcomes, or recognition.
      - Prefer factual summaries over persuasive language.
      
      Steps:
      1. Determine category: achievement, challenge, or learning.
      2. Infer relevant skills demonstrated.
      3. Generate a concise impact summary following guardrails.
      4. Assign a confidence score (low, medium, high).
      5. Create a unique Thought Signature for long-term continuity.
      
      Input: "${input}"
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: CAPTURE_ENTRY_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  return JSON.parse(text);
};
