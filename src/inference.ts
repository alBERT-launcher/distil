// src/inference.ts
import axios from "axios";
import { Client } from '@elastic/elasticsearch';
import { config } from "./config";
import { calculateCost, retry } from "./utils";
import { LLMInput, InferenceResult } from "./types";

export class InferenceEngine {
  private esClient = new Client({
    node: config.elastic.host,
    auth: {
      username: config.elastic.user,
      password: config.elastic.password
    }
  });

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
    const processedOutput = detail; // assuming processedOutput is the same as detail
    await this.esClient.index({
      index: config.elastic.dataIndex,
      body: {
        timestamp: new Date().toISOString(),
        pipelineHash: input.templateHash,
        stages: {
          input: {
            raw: input.originalInput,
            preprocessed: {
              systemPrompt: input.systemPrompt,
              userPrompt: input.userPrompt,
              parameters: input.parameters
            }
          },
          output: {
            raw: rawOutput,
            processed: processedOutput
          }
        },
        cost,
        model: input.modelName,
        metadata: input.extraData
      }
    });
    return { detail, rawOutput, cost };
  }
}
