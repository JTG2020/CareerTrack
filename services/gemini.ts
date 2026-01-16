
import { GoogleGenAI, Type } from "@google/genai";
import { EntryType, CareerEntry, AppraisalSummary, ConfidenceLevel } from "../types";

// Always use the required initialization format with named apiKey parameter
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    classification: {
      type: Type.STRING,
      description: "Must be 'achievement', 'challenge', or 'learning'.",
    },
    summary: {
      type: Type.STRING,
      description: "A concise structured summary of the activity.",
    },
    impact: {
      type: Type.STRING,
      description: "The inferred business or team impact (conservative).",
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Specific skills demonstrated.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence score from 0 to 1.",
    },
    thoughtSignature: {
      type: Type.STRING,
      description: "A short string representing the logic used to categorize this.",
    },
    followUpQuestion: {
      type: Type.STRING,
      description: "Only if confidence < 0.7 AND question materially improves appraisal quality. Max 1 question.",
    }
  },
  required: ["classification", "summary", "impact", "skills", "confidence", "thoughtSignature"],
};

export const structureEntry = async (text: string): Promise<any> => {
  const response = await ai.models.generateContent({
    // Use gemini-3-flash-preview for basic text tasks
    model: "gemini-3-flash-preview",
    contents: `
      As CareerTrack Agent, process this work activity input.
      Principles:
      - Classify into achievement, challenge, or learning.
      - Infer skills and impact conservatively.
      - Create a thought signature for continuity.
      - Only ask a follow-up if confidence is low.
      
      Input: "${text}"
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: ENTRY_SCHEMA,
    },
  });

  return JSON.parse(response.text || "{}");
};

export const refineMemory = async (entries: CareerEntry[]): Promise<CareerEntry[]> => {
  const response = await ai.models.generateContent({
    // Use gemini-3-flash-preview for reasoning tasks
    model: "gemini-3-flash-preview",
    contents: `
      Analyze this career memory and perform self-correction. 
      - Look for duplicates.
      - Refine impact statements to be more specific based on related entries.
      - Ensure skill tags are consistent.
      
      Memory: ${JSON.stringify(entries)}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: ENTRY_SCHEMA
      }
    }
  });

  const refinedData = JSON.parse(response.text || "[]");
  // Fix: Correct mapping to match CareerEntry interface properties and ConfidenceLevel enum
  return refinedData.map((d: any, i: number) => ({
    entry_id: entries[i]?.entry_id || Math.random().toString(36).substr(2, 9),
    timestamp: entries[i]?.timestamp || new Date().toISOString(),
    raw_input: entries[i]?.raw_input || "Refined from background context",
    thought_signature: d.thoughtSignature,
    category: d.classification as EntryType,
    skills: d.skills,
    impact_summary: d.impact,
    confidence_score: d.confidence > 0.7 ? ConfidenceLevel.HIGH : (d.confidence > 0.4 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW),
    evidence_links: entries[i]?.evidence_links || [],
    refinement_state: 'refined'
  }));
};
