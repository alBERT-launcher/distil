// src/types.ts

/**
 * Generic input for a Distil pipeline.
 * - modelName: Name of the pipeline.
 * - systemPrompt & userPrompt: Template strings for the prompt.
 * - parameters: Input parameters that fill placeholders in the prompt.
 * - extraData: Optional extra information.
 */
// src/types.ts

export interface LLMInput {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  parameters?: Record<string, any>;
  extraData?: any;
  // New fields
  templateHash?: string;       // Added template version identifier
  originalInput?: any;         // Raw input before preprocessing
  startTime?: number;          // Execution timestamp
}

export interface InferenceResult {
  detail: string;
  rawOutput: string;
  cost: number;
  retryCount?: number;      // From retry utility
}

export interface GenerationResult {
  processedOutput: string;
  metadata: {
    generationCost: number;
    timeTaken: number;
    input: LLMInput;
    rawOutput: string;      // Added raw model output
    templateHash: string;   // Version identifier
  };
}

export interface PipelineExecutionResult {
  processedOutput: string;  // Final output after postprocessing
  executionStats?: {
    averageTime: number;
    totalRuns: number;
    successRate: number;
  };
}

export interface PipelineVersionRecord {
  id: string;
  pipelineName: string;
  template: {
    systemPrompt: string;
    userPrompt: string;
    parameterKeys: string[];
  };
  tags: string[];
  rating?: number;
  isFinetuned?: boolean;
  createdAt: string;
}