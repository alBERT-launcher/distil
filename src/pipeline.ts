// src/pipeline.ts
import { LLMInput, GenerationResult, PipelineVersionRecord } from "./types";
import { validateInput, postprocess, computeTemplateHash } from "./utils";
import { InferenceEngine } from "./inference";
import { Logger } from "./logger";

// In-memory store for pipeline version records.
// (In a production system, swap this out with persistent storage.)
const pipelineVersionStore: { [hash: string]: PipelineVersionRecord } = {};

// Types for custom functions.
export type PreProcessingFn = (input: LLMInput) => Promise<LLMInput> | LLMInput;
export type PostProcessingFn = (raw: string, extraData?: any) => Promise<string> | string;

export interface DistilPipelineConfig {
  pipelineName: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  defaultParameters?: Record<string, any>;
  preprocess?: PreProcessingFn;
  postprocess?: PostProcessingFn;
}

export class DistilPipeline {
  private inferenceEngine: InferenceEngine;
  private logger: Logger;
  private preprocessFn: PreProcessingFn;
  private postprocessFn: PostProcessingFn;
  public pipelineName: string;
  public modelName: string;
  public systemPrompt: string;
  public userPrompt: string;
  public defaultParameters?: Record<string, any>;

  constructor(config: DistilPipelineConfig, logLevel?: "DEBUG" | "INFO" | "WARNING" | "ERROR") {
    this.logger = new Logger(logLevel || "DEBUG");
    this.inferenceEngine = new InferenceEngine();
    this.pipelineName = config.pipelineName;
    this.modelName = config.modelName;
    this.systemPrompt = config.systemPrompt;
    this.userPrompt = config.userPrompt;
    this.defaultParameters = config.defaultParameters;
    // Default: identity preprocessing.
    this.preprocessFn = config.preprocess ?? ((input: LLMInput) => input);
    // Default: generic postprocessing.
    this.postprocessFn = config.postprocess ?? postprocess;
  }

  /**
   * Runs the pipeline:
   * 1. Validate input and merge default parameters.
   * 2. Apply custom preprocessing.
   * 3. Compute the template hash.
   * 4. Run inference and apply postprocessing.
   * 5. Return output and metadata.
   */
  public async generate(inputData: any): Promise<GenerationResult | null> {
    const startTime = Date.now();
    let totalCost = 0;
    try {
      // Set required fields from pipeline config, ensuring they can't be overridden
      const input = {
        ...inputData,  // First, take all fields from inputData
        modelName: this.modelName,
      };
      
      // Merge default parameters first
      const parameters = {
        ...(this.defaultParameters || {}),
        ...(inputData || {})
      };


      // Helper function to substitute parameters in template strings
      const substituteParameters = (template: string, params: Record<string, any>): string => {
        let result = template;
        for (const [key, value] of Object.entries(params)) {
          const placeholder = `{${key}}`;
          // Handle different value types
          const replacement = typeof value === 'object' 
            ? JSON.stringify(value)
            : String(value);
          
          // Use regex to replace all occurrences
          result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
        }
        return result;
      };

      // Apply parameter substitution to prompt templates
      const systemPrompt = substituteParameters(this.systemPrompt, parameters);
      const userPrompt = substituteParameters(this.userPrompt, parameters);


      // Add processed prompts to input
      input.systemPrompt = systemPrompt;
      input.userPrompt = userPrompt;
      input.parameters = parameters;
      
      this.logger.info("Validating input..." + JSON.stringify(input));
      let validInput = validateInput(input);
      await this.logger.info("Input validated.");

      // Run preprocessing.
      validInput = await this.preprocessFn(validInput);

      // Compute template version hash.
      const templateHash = computeTemplateHash(validInput);
      // Run inference.
      const { detail, rawOutput, cost } = await this.inferenceEngine.callInference({
        ...validInput,
        templateHash,
        originalInput: inputData,
        pipelineName: this.pipelineName
      });
      totalCost += cost;
      const processedOutput = await this.postprocessFn(rawOutput, validInput.extraData);
      const timeTaken = (Date.now() - startTime) / 1000;

      return {
        processedOutput,
        metadata: { 
          generationCost: totalCost, 
          timeTaken,
          input: validInput,
          rawOutput,
          templateHash
        }
      };
    } catch (error: any) {
      await this.logger.error("Generation error: " + error.message);
      return null;
    }
  }
}

/**
 * Add a tag to a pipeline version.
 */
export function addTagToPipelineVersion(hash: string, tag: string): boolean {
  if (pipelineVersionStore[hash]) {
    if (!pipelineVersionStore[hash].tags.includes(tag)) {
      pipelineVersionStore[hash].tags.push(tag);
    }
    return true;
  }
  return false;
}

/**
 * Rate a pipeline version (1-5 stars).
 */
export function ratePipelineVersion(hash: string, rating: number): boolean {
  if (pipelineVersionStore[hash]) {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }
    pipelineVersionStore[hash].rating = rating;
    return true;
  }
  return false;
}

/**
 * Mark a pipeline version as finetuned.
 * (This step is automatically triggered when the user requests to export or finetune outputs.)
 */
export function markPipelineVersionAsFinetuned(hash: string): boolean {
  if (pipelineVersionStore[hash]) {
    pipelineVersionStore[hash].isFinetuned = true;
    return true;
  }
  return false;
}

/**
 * Get all pipeline version records.
 */
export function getAllPipelineVersions(): PipelineVersionRecord[] {
  return Object.values(pipelineVersionStore);
}
