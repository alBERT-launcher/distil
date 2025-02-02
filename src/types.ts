// src/types.ts

/**
 * Generic input for a Distil pipeline.
 * - modelName: Name of the model to use
 * - systemPrompt & userPrompt: Template strings for the prompt
 * - parameters: Input parameters that fill placeholders in the prompt
 * - extraData: Optional extra information
 * - pipelineName: Name of the pipeline (used as ES index)
 * - templateHash: Computed hash for version tracking
 * - originalInput: Raw input before preprocessing
 */
export interface LLMInput {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  parameters?: Record<string, any>;
  extraData?: any;
  pipelineName: string;       // Required for ES indexing
  templateHash?: string;      // Added during pipeline processing
  originalInput?: any;        // Raw input before preprocessing
  startTime?: number;         // Execution timestamp
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
  id: string;              // Same as templateHash
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
  generations?: Array<{
    id: string;
    output: string;
    timestamp: string;
    metadata?: any;
  }>;
}

// Elasticsearch response types
export interface ESSearchResponse<T> {
  hits: {
    total: {
      value: number;
      relation: string;
    };
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: T;
    }>;
  };
  aggregations?: {
    [key: string]: {
      buckets: Array<{
        key: string;
        doc_count: number;
        latest_doc: {
          hits: {
            hits: Array<{
              _source: T;
            }>;
          };
        };
      }>;
    };
  };
}