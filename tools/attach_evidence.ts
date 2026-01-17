
import { GoogleGenAI, Type } from "@google/genai";
import { CareerEntry, ConfidenceLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ATTACH_EVIDENCE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    match_id: {
      type: Type.STRING,
      description: "The entry_id of the most relevant memory entry that matches the artifact. Provide the most likely ID even if is_match is false.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief reasoning for why this artifact supports or does not support the selected entry.",
    },
    suggested_confidence: {
      type: Type.STRING,
      description: "The new confidence level: 'medium' or 'high'. Upgrading based on evidence strength.",
    },
    is_match: {
      type: Type.BOOLEAN,
      description: "True ONLY if a convincing logical link exists between the artifact and an entry.",
    }
  },
  required: ["match_id", "reasoning", "suggested_confidence", "is_match"],
};

export const attachEvidenceTool = async (artifact: string, entries: CareerEntry[], mimeType: string = 'text/plain') => {
  const entryContext = entries.map(e => ({
    id: e.entry_id,
    summary: e.impact_summary,
    signature: e.thought_signature,
    category: e.category,
    raw: e.raw_input
  }));

  const isImage = mimeType.startsWith('image/');

  const contents: any[] = [
    {
      text: `
        SYSTEM: You are CareerTrack, a long-running autonomous career memory agent.
        Your purpose is to capture, structure, refine, and summarize a user's work activities over time for performance appraisals.
        
        CORE PRINCIPLES:
        - Maintain long-term continuity using Thought Signatures.
        - Never fabricate achievements or evidence.
        - You reason over time and improve data quality continuously.
        
        REASONING & SAFETY GUARDRAILS:
        - Acknowledge uncertainty.
        - Never exaggerate impact; prefer factual summaries over persuasive language.
        - No assumptions: Do not assume the artifact implies more than it shows.

        TASK: attach_evidence
        Analyze the provided artifact (text, URL, or image) and determine which existing career memory entry it supports.
        
        MATCHING STRATEGY:
        1. Parse Artifact: If it's a URL (e.g., GitHub PR, Jira ticket, Doc link), extract repo names, ticket IDs, or keywords.
        2. Content Correlation: Compare the artifact's metadata or text content with the 'raw' input and 'summary' of existing entries.
        3. Thought Signature Alignment: Use the 'signature' (logic bridge) to confirm if the artifact provides proof for that specific reasoning path.
        4. Temporal Check: If multiple entries match keywords, prefer the one with a timestamp closest to the artifact's context (if detectable).
        
        ENTRIES CONTEXT (JSON):
        ${JSON.stringify(entryContext)}
        
        ARTIFACT TO ANALYZE:
        Content: "${artifact}"
        Type: ${mimeType}
      `
    }
  ];

  if (isImage) {
    contents.push({
      inlineData: {
        data: artifact.split(',')[1],
        mimeType: mimeType
      }
    });
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
