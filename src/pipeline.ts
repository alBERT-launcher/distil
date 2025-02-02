// src/pipeline.ts
import { Client } from "@elastic/elasticsearch";
import {
  PipelineVersionRecord,
  ESSearchResponse,
  LLMInput,
  GenerationResult,
} from "./types";
import { validateInput, postprocess, computeTemplateHash } from "./utils";
import { InferenceEngine } from "./inference";
import { Logger } from "./logger";
import { config } from "./config";

let esClient: Client;

if (config.elastic.host) {
  const clientConfig: any = {
    node: config.elastic.host,
  };

  // Only add authentication if credentials are provided
  if (config.elastic.user && config.elastic.password) {
    clientConfig.auth = {
      username: config.elastic.user,
      password: config.elastic.password,
    };
  }

  esClient = new Client(clientConfig);
}

// Types for custom functions.
export type PreProcessingFn = (input: LLMInput) => Promise<LLMInput> | LLMInput;
export type PostProcessingFn = (
  raw: string,
  extraData?: any
) => Promise<string> | string;

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

  constructor(
    config: DistilPipelineConfig,
    logLevel?: "DEBUG" | "INFO" | "WARNING" | "ERROR"
  ) {
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
        ...inputData, // First, take all fields from inputData
        modelName: this.modelName,
      };

      // Merge default parameters first
      const parameters = {
        ...(this.defaultParameters || {}),
        ...(inputData || {}),
      };

      // Helper function to substitute parameters in template strings
      const substituteParameters = (
        template: string,
        params: Record<string, any>
      ): string => {
        let result = template;
        for (const [key, value] of Object.entries(params)) {
          const placeholder = `{${key}}`;
          // Handle different value types
          const replacement =
            typeof value === "object" ? JSON.stringify(value) : String(value);

          // Use regex to replace all occurrences
          result = result.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            replacement
          );
        }
        return result;
      };
      const templateHash = computeTemplateHash({
        systemPrompt: this.systemPrompt,
        userPrompt: this.userPrompt,
        parameters,
        pipelineName: this.pipelineName,
        modelName: this.modelName,
      });

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

      // Store raw input before preprocessing
      const rawInput = { ...validInput };

      // Run preprocessing
      validInput = await this.preprocessFn(validInput);
      validInput.preprocessFn = this.preprocessFn;  // Pass preprocessing function
      validInput.postprocessFn = this.postprocessFn;  // Pass postprocessing function

      // Compute template version hash.
      // Run inference.
      const { detail, rawOutput, processedOutput, cost } =
        await this.inferenceEngine.callInference({
          ...validInput,
          templateHash,
          originalInput: inputData,
          pipelineName: this.pipelineName,
        });
      totalCost += cost;

      const timeTaken = (Date.now() - startTime) / 1000;

      return {
        processedOutput,
        metadata: {
          generationCost: totalCost,
          timeTaken,
          rawInput,
          preprocessedInput: validInput,
          rawOutput,
          templateHash,
        },
      };
    } catch (error: any) {
      await this.logger.error("Generation error: " + error.message);
      return null;
    }
  }
}

interface PipelineAggregationBucket {
  key: string;
  doc_count: number;
  latest_doc: {
    hits: {
      hits: Array<{
        _id: string;
        _source: {
          pipelineName: string;
          pipelineHash: string;
          template: {
            systemPrompt: string;
            userPrompt: string;
            parameterKeys?: string[];
          };
          tags?: string[];
          rating?: number;
          isFinetuned?: boolean;
          "@timestamp"?: string;
        };
      }>;
    };
  };
}

interface PipelineSearchResponse {
  hits: {
    hits: Array<{
      _id: string;
      _source: unknown;
    }>;
  };
  aggregations: {
    unique_pipelines: {
      buckets: PipelineAggregationBucket[];
    };
  };
}

interface SearchResponse<T> {
  hits: {
    hits: Array<{
      _id: string;
      _source: T;
    }>;
  };
}

interface PipelineAggregationResponse {
  hits: {
    hits: any[];
  };
  aggregations?: Record<
    string,
    {
      buckets: PipelineAggregationBucket[];
    }
  >;
}

interface GenerationDocument {
  pipelineName: string;
  pipelineHash: string;
  output: string;
  input: {
    raw: {
      [key: string]: any;
    };
    preprocessed: {
      systemPrompt: string;
      userPrompt: string;
      parameters?: Record<string, any>;
    };
    pipelineName: string;
  };
  timeTaken?: number;
  generationCost?: number;
  rating?: number;
  isFinetuned?: boolean;
  "@timestamp"?: string;
}

interface ESSearchHit {
  _id: string;
  _source: GenerationDocument;
}

interface ESGetResponse {
  _id: string;
  _source: GenerationDocument;
}

function isValidHit(
  hit: { _source?: PipelineVersionRecord } | undefined
): hit is { _source: PipelineVersionRecord } {
  return !!hit && !!hit._source;
}

/**
 * Get all pipeline versions.
 */
export async function getAllPipelineVersions(): Promise<
  PipelineVersionRecord[]
> {
  try {
    // Get all indices
    const indices = await esClient.indices.get({ index: "*" });
    const pipelineIndices = Object.keys(indices).filter(
      (index) => !index.startsWith(".")
    );

    if (pipelineIndices.length === 0) {
      return [];
    }
    console.log("Indices:", pipelineIndices);

    const pipelines: PipelineVersionRecord[] = [];

    for (const index of pipelineIndices) {
      try {
        const result = await esClient.search<unknown, PipelineSearchResponse>({
          index,
          body: {
            size: 0,
            aggs: {
              unique_pipelines: {
                terms: {
                  field: "pipelineHash.keyword",
                  size: 1000,
                },
                aggs: {
                  latest_doc: {
                    top_hits: {
                      size: 1,
                      _source: [
                        "pipelineName",
                        "pipelineHash",
                        "parameterKeys",
                        "input",
                        "output",
                        "template",
                        "tags",
                        "rating",
                        "isFinetuned",
                        "@timestamp",
                      ],
                    },
                  },
                },
              },
            },
          },
        });

        const buckets =
          (result.aggregations as any).unique_pipelines?.buckets || [];

        for (const bucket of buckets) {
          const hits = bucket.latest_doc.hits.hits;
          if (hits.length === 0) continue;

          const hit = hits[0];
          const source = hit._source;
          console.log("Hit:", hit);
          if (
            source &&
            typeof source === "object" &&
            "pipelineName" in source
          ) {
            console.log("Source:", source);
            const typedSource = source as {
              pipelineName: string;
              pipelineHash: string;
              input: {
                preprocessed: {
                  systemPrompt: string;
                  userPrompt: string;
                  parameters?: Record<string, any>;
                };
              };
              output: string;
              tags?: string[];
              rating?: number;
              isFinetuned?: boolean;
              "@timestamp"?: string;
            };

            pipelines.push({
              id: typedSource.pipelineHash,
              pipelineName: typedSource.pipelineName,
              template: {
                systemPrompt: typedSource.input.preprocessed.systemPrompt,
                userPrompt: typedSource.input.preprocessed.userPrompt,
                parameterKeys: typedSource.input.preprocessed.parameters
                  ? Object.keys(typedSource.input.preprocessed.parameters)
                  : [],
              },
              tags: typedSource.tags || [],
              rating: typedSource.rating,
              isFinetuned: typedSource.isFinetuned,
              createdAt: typedSource["@timestamp"] || new Date().toISOString(),
              generations: [],
            });
          }
        }
      } catch (error) {
        console.error(`Error searching index ${index}:`, error);
        // Continue with other indices even if one fails
        continue;
      }
    }
    // Sort by timestamp
    return pipelines.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error fetching pipeline versions:", error);
    return [];
  }
}

/**
 * Add a tag to a pipeline version.
 */
export async function addTagToPipelineVersion(
  id: string,
  tag: string
): Promise<boolean> {
  try {
    // Get all indices
    const indices = await esClient.indices.get({ index: "*" });
    const pipelineIndices = Object.keys(indices).filter(
      (index) => !index.startsWith(".")
    );

    if (pipelineIndices.length === 0) {
      return false;
    }

    const response = await esClient.search<PipelineVersionRecord>({
      index: pipelineIndices.join(","),
      body: {
        query: {
          ids: {
            values: [id],
          },
        },
      },
    });

    if (
      !response.hits?.hits ||
      response.hits.hits.length === 0 ||
      response.hits.hits[0]._source === undefined
    ) {
      return false;
    }

    const hit = response.hits.hits[0];
    const version = hit._source!;
    const tags = new Set([...(version.tags || []), tag]);

    await esClient.update({
      index: hit._index,
      id: hit._id!,
      body: {
        doc: {
          tags: Array.from(tags),
        },
      },
    });

    return true;
  } catch (error) {
    console.error("Error adding tag:", error);
    return false;
  }
}

/**
 * Rate a pipeline version (1-5 stars).
 */
export async function ratePipelineVersion(
  id: string,
  rating: number
): Promise<boolean> {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    const response = await esClient.search<{ _source: PipelineVersionRecord }>({
      index: "pipeline_versions",
      body: {
        query: {
          term: { id },
        },
      },
    });

    if (!response.hits?.hits?.[0]) {
      return false;
    }

    const hit = response.hits.hits[0];

    await esClient.update({
      index: "pipeline_versions",
      id: hit._id!,
      body: {
        doc: { rating },
      },
    });

    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Rating must be between 1 and 5."
    ) {
      throw error;
    }
    console.error("Error rating pipeline version:", error);
    return false;
  }
}

/**
 * Mark a pipeline version as finetuned.
 */
export async function markPipelineVersionAsFinetuned(
  id: string
): Promise<boolean> {
  try {
    const response = await esClient.search<{ _source: PipelineVersionRecord }>({
      index: "pipeline_versions",
      body: {
        query: {
          term: { id },
        },
      },
    });

    if (!response.hits?.hits?.[0]) {
      return false;
    }

    const hit = response.hits.hits[0];

    await esClient.update({
      index: "pipeline_versions",
      id: hit._id!,
      body: {
        doc: { isFinetuned: true },
      },
    });

    return true;
  } catch (error) {
    console.error("Error marking pipeline version as finetuned:", error);
    return false;
  }
}

/**
 * Get generations for a pipeline version
 */
export async function getGenerationsForVersion(
  pipelineName: string,
  versionId: string
) {
  try {
    const response = await esClient.search<GenerationDocument>({
      index: pipelineName.toLowerCase(),
      query: {
        bool: {
          must: [{ term: { pipelineHash: versionId } }],
        },
      },
      size: 50,
    });

    console.log({ response });
    return (response.hits.hits as ESSearchHit[]).map((hit) => {
      const source = hit._source;
      return {
        id: hit._id,
        processedOutput: source.output,
        metadata: {
          input: source.input,
          timeTaken: source.timeTaken || 0,
          generationCost: source.generationCost || 0,
          pipelineHash: source.pipelineHash,
          rawOutput: source.output,
          pipelineName: source.pipelineName,
        },
        rating: source.rating,
        isFinetuned: source.isFinetuned,
      };
    });
  } catch (error) {
    console.error("Error fetching generations for pipeline version:", error);
    return [];
  }
}

/**
 * Get a specific generation by ID
 */
export async function getGenerationById(pipelineName: string, id: string) {
  const response = await esClient.get<GenerationDocument>({
    index: pipelineName.toLowerCase(),
    id,
  });

  if (!response._source) {
    throw new Error(`Generation ${id} not found`);
  }

  const source = response._source;
  return {
    id: response._id,
    processedOutput: source.output,
    metadata: {
      input: source.input,
      timeTaken: source.timeTaken || 0,
      generationCost: source.generationCost || 0,
      pipelineHash: source.pipelineHash,
      rawOutput: source.output,
      pipelineName: source.pipelineName,
    },
    rating: source.rating,
    isFinetuned: source.isFinetuned,
  };
}

/**
 * Rate a generation
 */
export async function rateGeneration(
  id: string,
  rating: number
): Promise<boolean> {
  try {
    await esClient.update({
      index: config.elastic.logIndex,
      id,
      doc: {
        rating: parseInt(rating.toString()),
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to rate generation:", error);
    return false;
  }
}

/**
 * Mark generations for finetuning
 */
export async function markGenerationsForFinetuning(
  ids: string[]
): Promise<boolean> {
  try {
    await Promise.all(
      ids.map((id) =>
        esClient.update({
          index: config.elastic.logIndex,
          id,
          doc: {
            isFinetuned: true,
          },
        })
      )
    );
    return true;
  } catch (error) {
    console.error("Failed to mark generations for finetuning:", error);
    return false;
  }
}
