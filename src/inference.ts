// src/inference.ts
import axios from "axios";
import { config } from "./config";
import { calculateCost, retry } from "./utils";
import { LLMInput, InferenceResult } from "./types";

export class InferenceEngine {
  async callInference(input: LLMInput): Promise<InferenceResult> {
    const messages = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt }
    ];
    
    const response = await retry(() =>
      axios.post(
        `${config.openLLM.baseUrl}/chat/completions`,
        {
          model: input.modelName, // using the pipeline name here
          messages,
          max_tokens: 4000,
          temperature: 1
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.openLLM.apiKey}`
          }
        }
      )
    );

    const rawOutput = response.data.choices
      .map((choice: any) => choice.message?.content || "")
      .join("");
    const detail = rawOutput;
    const cost = calculateCost(JSON.stringify(messages), rawOutput);
    return { detail, rawOutput, cost };
  }
}
