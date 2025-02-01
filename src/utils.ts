// src/utils.ts
import crypto from "crypto";
import { config } from "./config";
import { LLMInput } from "./types";

/**
 * Validate required fields on LLMInput.
 */
export function validateInput(input: any): LLMInput {
  
  if (
    typeof input.modelName !== "string" ||
    typeof input.systemPrompt !== "string" ||
    typeof input.userPrompt !== "string"
  ) {
    throw new Error(
      "Invalid input: modelName, systemPrompt, and userPrompt must be strings."
    );
  }
  return input as LLMInput;
}

/**
 * Estimate cost using an average token length heuristic.
 */
export function calculateCost(inputStr: string, outputStr: string): number {
  const avgTokenLength = 4;
  const inputTokens = Math.ceil(inputStr.length / avgTokenLength);
  const outputTokens = Math.ceil(outputStr.length / avgTokenLength);
  return (inputTokens + outputTokens) * config.costPerToken;
}

/**
 * Simple retry wrapper for async functions.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = config.retry.retries,
  delay = config.retry.delay
): Promise<T> {
  let error: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      error = err;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw error;
}

/**
 * Generic postprocessing function. Extend as needed.
 */
export function postprocess(response: string, extraData?: any): string {
  return response;
}

/**
 * Compute a unique SHA-256 hash based on the systemPrompt, userPrompt, and sorted parameter keys.
 */
export function computeTemplateHash(input: LLMInput): string {
  const hash = crypto.createHash("sha256");
  const paramKeys = input.parameters ? Object.keys(input.parameters).sort() : [];
  hash.update(input.systemPrompt + input.userPrompt + paramKeys.join(","));
  return hash.digest("hex");
}
