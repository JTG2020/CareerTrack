
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CAPTURE_ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    entry_id: { type: Type.STRING },
    thought_signature: { type: Type.STRING },
    timestamp: { type: Type.STRING },
    category: { 
      type: Type.STRING,
      description: "Must be exactly 'achievement', 'challenge', or 'learning' in lowercase.",
    },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    impact_summary: { type: Type.STRING },
    confidence_score: { 
      type: Type.STRING,
      description: "Must be exactly 'low', 'medium', or 'high'."
    },
    evidence_links: { type: Type.ARRAY, items: { type: Type.STRING } },
    refinement_state: { type: Type.STRING },
  },
  required: [
    "entry_id", 
    "thought_signature", 
    "timestamp", 
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
      Role: CareerTrack Autonomous Agent (Strict Performance Auditor)
      Task: capture_entry
      
      CONTEXT:
      Current Date/Time: ${currentTimeIso}
      User Timezone: ${timezone}
      
      Interpret the user input and output a structured memory object.
      
      CATEGORY RULES:
      - 'achievement': A positive outcome, successful delivery, or milestone.
      - 'challenge': A significant technical or process obstacle faced.
      - 'learning': Acquisition of a new skill or insight from a situation.
      
      CRITICAL CONFIDENCE SCORING RULES:
      You MUST be a tough critic. High-integrity appraisals require specific data.
      
      Set confidence_score to 'low' IF:
      - The input is generic or vague (e.g., "Fixed a bug", "Worked on a project").
      - Lacks specific project names, service names, or technical context.
      - Extremely short.
      
      Set confidence_score to 'medium' IF:
      - It describes a specific task or feature with technical context (e.g., "Fixed timeouts in the payment service").
      - It names a specific project, service, or stakeholder.
      - BUT it still lacks hard metrics (percentages, numbers, ROI, time saved).
      
      Set confidence_score to 'high' ONLY IF:
      - It contains clear Action + Result + Metric (e.g., "Optimized DB query [Action] reducing latency by 40% [Metric] for the Checkout service [Result]").
      
      Input: "${input}"
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: CAPTURE_ENTRY_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  const result = JSON.parse(text);
  
  // Normalize category and confidence to lowercase to ensure UI filters work accurately
  if (result.category) {
    result.category = result.category.toLowerCase().trim();
  }
  if (result.confidence_score) {
    result.confidence_score = result.confidence_score.toLowerCase().trim();
  }
  
  if (!result.timestamp || result.timestamp.includes("2023")) {
    result.timestamp = currentTimeIso;
  }
  return result;
};
