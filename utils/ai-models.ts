import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export function getModel(modelName: string) {
  switch (modelName) {
    case "gemini-2.5-flash":
    case "gemini-1.5-pro":
      return google(modelName);
    case "gpt-4o-mini":
    case "gpt-4o":
      return openai(modelName);
    default:
      // Fallback
      return google("gemini-2.5-flash");
  }
}
