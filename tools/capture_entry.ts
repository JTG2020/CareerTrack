
import { GoogleGenAI, Type } from "@google/genai";

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
};

export const captureEntryTool = async (input: string, currentTimeIso: string, timezone: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Role: CareerTrack Autonomous Agent (Factual Capture)
      Task: capture_entry
      
      CONTEXT:
      Current Date/Time: ${currentTimeIso}
      User Timezone: ${timezone}
      User Input: "${input}"
      
      STEPS:
      1. Determine category: achievement, challenge, or learning.
      2. Infer relevant skills demonstrated.
      3. Generate a concise impact summary based on the input.
      4. Assign a confidence score:
         - 'low': Input is generic, vague, or lacks metrics/specifics.
         - 'medium': Describes a specific task but lacks hard numbers.
         - 'high': Clear Action + Result + Measurable Metric.
      5. Create a unique Thought Signature (a short string representing your logic bridge).
      6. Output a structured memory object.
      
      RULES:
      - Be conservative. If impact is unclear, lower confidence instead of guessing.
      - DO NOT ask follow-up questions during this step.
      - Ensure category is strictly lowercase 'achievement', 'challenge', or 'learning'.
      - Set refinement_state to 'pending'.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: CAPTURE_ENTRY_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  const result = JSON.parse(text);
  
  // Normalize fields for UI consistency
  if (result.category) result.category = result.category.toLowerCase().trim();
  if (result.confidence_score) result.confidence_score = result.confidence_score.toLowerCase().trim();
  
  // Ensure the raw input matches what the user actually typed
  result.raw_input = input;
  
  if (!result.timestamp || result.timestamp.includes("2023")) {
    result.timestamp = currentTimeIso;
  }
  return result;
};
