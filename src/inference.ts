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
    // Determine if using finetuned model
    const isFineTuned = input.parameters?.useFinetuned === true;
    
    // Construct messages array with appropriate system message
    const systemMessage = isFineTuned ? 
      `You are an AI assistant trained to help with ${input.pipelineName.toLowerCase()} tasks.` :
      input.systemPrompt;

    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: isFineTuned ? input.originalInput : input.userPrompt }
    ];

    // Prepare API request with all relevant parameters
    const requestBody = {
      model: input.modelName,
      messages,
      max_tokens: 4000,
      temperature: 1,
      ...(input.parameters || {}) // Include any custom parameters
    };

    // Choose API endpoint based on whether using finetuned model
    const apiConfig = isFineTuned ? {
      baseUrl: config.openai.baseUrl,
      endpoint: config.openai.finetune.endpoint,
      apiKey: config.openai.apiKey
    } : {
      baseUrl: config.openLLM.baseUrl,
      endpoint: "/chat/completions",
      apiKey: config.openLLM.apiKey
    };

    const response = await retry(() =>
      axios.post(
        `${apiConfig.baseUrl}${apiConfig.endpoint}`,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiConfig.apiKey}`
          }
        }
      )
    );

    // Extract completion
    const rawOutput = response.data.choices[0].message.content;
    const processedOutput = isFineTuned ? 
      rawOutput : // If finetuned, skip post-processing
      (input.postprocessFn ? await input.postprocessFn(rawOutput, input.extraData) : rawOutput);

    const cost = calculateCost(JSON.stringify(messages), rawOutput);

    // Store completion data
    const indexResponse = await this.esClient.index({
      index: input.pipelineName.toLowerCase(),
      body: {
        timestamp: new Date().toISOString(),
        pipelineName: input.pipelineName,
        pipelineHash: input.templateHash,
        input: {
          raw: JSON.stringify(input.originalInput),
          preprocessed: {
            systemPrompt: systemMessage,
            userPrompt: isFineTuned ? input.originalInput : input.userPrompt,
            parameters: JSON.stringify(input.parameters)
          }
        },
        rawOutput,
        output: JSON.stringify(processedOutput),
        cost,
        model: input.modelName,
        metadata: input.extraData,
        isFineTuned
      }
    });

    // Return exactly what InferenceResult expects
    return {
      detail: indexResponse._id,
      rawInput: input.originalInput,
      preprocessedInput: input,
      rawOutput,
      processedOutput,
      cost,
      retryCount: 0
    };
  }
}
