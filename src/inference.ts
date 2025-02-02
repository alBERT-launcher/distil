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
    const rawOutput = response.data.choices[0].message.content;
    const processedOutput = input.postprocessFn ? 
      await input.postprocessFn(rawOutput, input.extraData) : 
      rawOutput;

    const detail = rawOutput;
    const cost = calculateCost(JSON.stringify(messages), rawOutput);

    // Store completion data
    await this.esClient.index({
      index: input.pipelineName.toLowerCase(), // Use pipeline name as index name
      body: {
        timestamp: new Date().toISOString(),
        pipelineName: input.pipelineName,
        pipelineHash: input.templateHash,
        input: {
          raw: input.originalInput,
          preprocessed: {
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            parameters: input.parameters
          }
        },
        rawOutput,
        output: JSON.stringify(processedOutput),
        cost,
        model: input.modelName,
        metadata: input.extraData
      }
    });

    // Return exactly what InferenceResult expects
    return {
      detail: "Success",
      rawInput: input.originalInput,
      preprocessedInput: input,
      rawOutput,
      processedOutput,
      cost,
      retryCount: 0 // Add retryCount to the return object
    };
  }
}
