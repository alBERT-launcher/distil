// src/inference.ts
import { OpenAI } from "openai";
import { Client } from '@elastic/elasticsearch';
import { config } from "./config";
import { calculateCost, retry } from "./utils";
import { LLMInput, InferenceResult } from "./types";
import { Logger } from "./logger";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { ChatCompletion } from "openai/resources/chat/completions";

export class InferenceEngine {
  private esClient: Client;
  private logger: Logger;
  private openaiClient: OpenAI;
  private openLLMClient: OpenAI;

  constructor(
    logLevel?: "DEBUG" | "INFO" | "WARNING" | "ERROR"
  ) {
    this.esClient = new Client({
      node: config.elastic.host,
      auth: {
        username: config.elastic.user,
        password: config.elastic.password
      }
    });
    this.logger = new Logger(logLevel || "DEBUG");
    
    // Initialize OpenAI clients
    this.openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseUrl
    });
    
    this.openLLMClient = new OpenAI({
      apiKey: config.openLLM.apiKey,
      baseURL: config.openLLM.baseUrl
    });
  }

  async callInference(input: LLMInput): Promise<InferenceResult> {
    // Determine if using finetuned model
    const isFineTuned = input.parameters?.useFinetuned === true;
    
    // Construct messages array with appropriate system message
    const systemMessage = isFineTuned ? 
      `You are an AI assistant trained to help with ${input.pipelineName.toLowerCase()} tasks.` :
      input.systemPrompt;

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemMessage },
      { role: "user", content: isFineTuned ? JSON.stringify(input.parameters) : input.userPrompt }
    ];

    // Prepare API request with all relevant parameters
    const requestParams = {
      model: input.modelName,
      messages,
      max_tokens: 4000,
      temperature: 1,
      stream: false,
      // ...(input.parameters || {}) // Include any custom parameters
    };

    await this.logger.debug("Request params:" + JSON.stringify(requestParams));

    // Choose client based on whether using finetuned model
    const client = isFineTuned ? this.openaiClient : this.openLLMClient;

    try {
      const completion = await client.chat.completions.create(requestParams) as ChatCompletion;
      
      // Extract completion
      const rawOutput = completion.choices[0].message.content || "";
      const processedOutput = isFineTuned ? 
        rawOutput : // If finetuned, skip post-processing
        (input.postprocessFn ? await input.postprocessFn(rawOutput, input.extraData) : rawOutput);
      
      await this.logger.debug("Processed output:" + processedOutput);
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
              userPrompt: isFineTuned ? JSON.stringify(input.parameters) : input.userPrompt,
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
    } catch (error) {
      // Log the error and rethrow
      await this.logger.error("OpenAI API error: " + JSON.stringify(error));
      throw error;
    }
  }
}
