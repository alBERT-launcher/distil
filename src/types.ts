// src/types.ts

/**
 * Generic input for a Distil pipeline.
 * - modelName: Name of the pipeline.
 * - systemPrompt & userPrompt: Template strings for the prompt.
 * - parameters: Input parameters that fill placeholders in the prompt.
 * - extraData: Optional extra information.
 */
export interface LLMInput {
    modelName: string;
    systemPrompt: string;
    userPrompt: string;
    parameters?: Record<string, any>;
    extraData?: any;
  }
  
  /**
   * Result from an inference call.
   */
  export interface InferenceResult {
    detail: string;
    rawOutput: string;
    cost: number;
  }
  
  /**
   * Full result from a generate() call.
   */
  export interface GenerationResult {
    processedOutput: string;
    metadata: {
      generationCost: number;
      timeTaken: number;
      input: LLMInput;
    };
  }
  
  /**
   * Record for tracking pipeline (version) runs.
   * The unique hash is computed from the system prompt, user prompt, and the sorted keys of parameters.
   */
  export interface PipelineVersionRecord {
    id: string; // computed template hash
    pipelineName: string;
    template: {
      systemPrompt: string;
      userPrompt: string;
      parameterKeys: string[];
    };
    tags: string[];
    rating?: number;    // from 1-5 stars
    isFinetuned?: boolean;
    createdAt: string;
  }
  