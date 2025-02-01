// src/inference.ts
import axios from "axios";
import { Client } from '@elastic/elasticsearch';
import { config } from "./config";
import { calculateCost, retry } from "./utils";
import { LLMInput, InferenceResult } from "./types";

export class InferenceEngine {
  private esClient: Client;

  constructor() {
    this.esClient = new Client({
      node: config.elastic.host,
      auth: {
        username: config.elastic.user,
        password: config.elastic.password
      }
    });
  }

  async callInference(input: LLMInput): Promise<InferenceResult> {
    // Construct messages array
    const messages = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt }
    ];

    // Prepare API request with all relevant parameters
    const requestBody = {
      model: input.modelName,
      messages,
      max_tokens: 4000,
      temperature: 1,
      ...(input.parameters || {}) // Include any custom parameters
    };

    const response = await retry(() =>
      axios.post(
        `${config.openLLM.baseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.openLLM.apiKey}`
          }
        }
      )
    );

    // Extract completion
    const rawOutput = response.data.choices
      .map((choice: any) => choice.message?.content || "")
      .join("");
    const detail = rawOutput;
    const cost = calculateCost(JSON.stringify(messages), rawOutput);

    // Store completion data
    await this.esClient.index({
      index: config.elastic.dataIndex,
      body: {
        timestamp: new Date().toISOString(),
        pipelineHash: input.templateHash,
        input: {
          raw: input.originalInput,
          preprocessed: {
            systemPrompt: input.systemPrompt,  // This is now the parameterized version
            userPrompt: input.userPrompt,      // This is now the parameterized version
            parameters: input.parameters
          }
        },
        parameterizedPrompts: {
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt
        },
        output: rawOutput,
        cost,
        model: input.modelName,
        metadata: input.extraData
      }
    });

    // Return exactly what InferenceResult expects
    return {
      detail,
      rawOutput,
      cost
    };
  }
}
