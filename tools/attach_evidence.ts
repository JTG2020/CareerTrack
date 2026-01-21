
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry, ConfidenceLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ATTACH_EVIDENCE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    match_id: {
      type: Type.STRING,
      description: "The entry_id of the most relevant memory entry.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Detailed reasoning for why this artifact supports the selected entry, referencing specific context overlaps.",
    },
    suggested_confidence: {
      type: Type.STRING,
      description: "The new confidence level: 'medium' or 'high'.",
    },
    is_match: {
      type: Type.BOOLEAN,
      description: "Whether a convincing semantic match was found.",
    }
  },
  required: ["match_id", "reasoning", "suggested_confidence", "is_match"],
};

export const attachEvidenceTool = async (artifact: string, entries: CareerEntry[], mimeType: string = 'text/plain') => {
  // Extract essential metadata for matching context
  const entryContext = entries.map(e => ({
    id: e.entry_id,
    summary: e.impact_summary,
    signature: e.thought_signature, // Anchoring on Thought Signatures
    category: e.category,
    timestamp: e.timestamp
  }));

  const contents: any[] = [
    {
      text: `
        Role: CareerTrack Autonomous Agent (Evidence Verification Specialist)
        Task: attach_evidence
        
        SYSTEM INSTRUCTION: 
        You are performing an autonomous cross-reference of work artifacts against a career memory log. 
        Use "Thinking Levels" to process this request:
        
        Level 1 (Extraction): Analyze the provided artifact. What is it? (URL, screenshot, log, snippet). What are the key entities, dates, and technical terms?
        Level 2 (Semantic Bridge): Compare these entities against the Thought Signatures of existing entries. A Thought Signature represents the underlying "intent" or "context" of a work activity.
        Level 3 (Validation & Self-Correction): Evaluate the probability of a match. Does this artifact definitively prove an outcome? If it contradicts a previous impact claim, self-correct the confidence level downward.
        
        ENTRIES CONTEXT:
        ${JSON.stringify(entryContext)}
        
        MATCHING RULES:
        1. PRIORITIZE SIGNATURES: Match based on the "Thought Signature" if semantic similarity is high.
        2. TEMPORAL PROXIMITY: Favor entries close in time if the semantic match is otherwise ambiguous.
        3. CONFIDENCE UPGRADES: 
           - Artifact proves execution -> Upgrade to MEDIUM.
           - Artifact proves outcome/metric -> Upgrade to HIGH.
        4. NEGATIVE MATCHES: If no entry fits within a 70% confidence interval, set is_match to false.
      `
    }
  ];

  if (mimeType.startsWith('image/')) {
    contents.push({
      inlineData: {
        data: artifact.split(',')[1], // Remove base64 header if present
        mimeType: mimeType
      }
    });
  } else {
    contents.push({ text: `Artifact/Link content: ${artifact}` });
  }

  // Using Pro with Thinking Config for complex reasoning and self-correction
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: ATTACH_EVIDENCE_SCHEMA,
      thinkingConfig: {
        thinkingBudget: 4000 // Reserved for deep cross-referencing and self-correction logic
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from evidence agent");
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Agent returned invalid JSON in evidence matching:", text);
    throw new Error("Failed to parse evidence match response.");
  }
};
