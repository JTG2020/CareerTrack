
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
      description: "Brief reasoning for why this artifact supports the selected entry.",
    },
    suggested_confidence: {
      type: Type.STRING,
      description: "The new confidence level: 'medium' or 'high'.",
    },
    is_match: {
      type: Type.BOOLEAN,
      description: "Whether a convincing match was found.",
    }
  },
  required: ["match_id", "reasoning", "suggested_confidence", "is_match"],
};

export const attachEvidenceTool = async (artifact: string, entries: CareerEntry[], mimeType: string = 'text/plain') => {
  // We send metadata of entries to save tokens while providing enough context for matching
  const entryContext = entries.map(e => ({
    id: e.entry_id,
    summary: e.impact_summary,
    signature: e.thought_signature,
    category: e.category
  }));

  const contents: any[] = [
    {
      text: `
        Role: CareerTrack Autonomous Agent
        Task: attach_evidence
        
        Analyze the provided artifact and determine which existing career memory entry it supports.
        
        Entries Context: ${JSON.stringify(entryContext)}
        
        Steps:
        1. Interpret the artifact's purpose and context.
        2. Match it to the entry with the most relevant Thought Signature or Impact Summary.
        3. If it supports an entry, increase its confidence level (e.g., LOW to MEDIUM, or MEDIUM to HIGH).
        4. If no match is found, set is_match to false.
      `
    }
  ];

  if (mimeType.startsWith('image/')) {
    contents.push({
      inlineData: {
        data: artifact.split(',')[1], // Remove base64 header
        mimeType: mimeType
      }
    });
  } else {
    contents.push({ text: `Artifact/Link content: ${artifact}` });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: ATTACH_EVIDENCE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from agent");
  return JSON.parse(text);
};
