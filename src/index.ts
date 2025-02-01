import OpenAI from 'openai';
import crypto from 'crypto';
import { compareTwoStrings } from 'string-similarity';
import { encoding_for_model } from 'tiktoken';
import { StorageAdapter, StorageConfig, createStorageAdapter, UsageStats, PromptLog, ModelRouting } from './storage';
import { Stream } from 'openai/streaming';

interface TemplateEntry {
  pattern: RegExp;
  variables: string[];
  modelVersion: string;
  firstSeen: Date;
  examples: string[];
  rawTemplate: string;
  version: number;
  lock: Promise<void>;
}

interface PromptMatch {
  templateHash: string;
  variables: Record<string, string>;
}

interface DatasetEntry {
  templateHash: string;
  variables: Record<string, string>;
  output: string;
  timestamp: Date;
}

interface DistilMeta {
  modelVersion: string;
  templateHash: string;
  variables: Record<string, string>;
  template: string;
  usage: UsageStats;
}

type DistilResponse<T extends object> = Omit<T, '_pvMeta'> & {
  _pvMeta?: Record<string, unknown>;
};

interface TrainingDataEntry {
  messages: [
    { role: 'user', content: string },
    { role: 'assistant', content: string }
  ];
}

interface LocalStorageConfig {
  type: 'memory' | 'redis';
  options?: {
    host?: string;
    port?: number;
    password?: string;
  };
}

class ClusteringEngine {
  private prompts: string[] = [];
  private tokenizedPrompts: string[][] = [];

  constructor(prompts: string[]) {
    this.prompts = prompts;
    this.tokenizedPrompts = prompts.map(p => this.advancedTokenize(p));
  }

  private advancedTokenize(prompt: string): string[] {
    // Split on word boundaries but preserve {{variable}} patterns
    return prompt.split(/(\{\{\w+\}\}|\W+)/).filter(t => t.trim());
  }

  private findCommonStructure(): {
    template: string;
    variables: Set<string>;
    coverage: number;
  } {
    const trie = this.buildPositionalTrie();
    const alignments = this.calculateOptimalAlignments();
    return this.generateBestTemplate(trie, alignments);
  }

  private buildPositionalTrie() {
    // Implementation using frequency counts per position
  }

  private calculateOptimalAlignments() {
    // Dynamic programming approach for token alignment
  }

  private generateBestTemplate(trie: any, alignments: any) {
    // Generate template with variables where divergence occurs
  }

  public clusterPrompts(
    minClusterSize: number = 3,
    similarityThresholds: number[] = [0.85, 0.7, 0.5]
  ): string[][] {
    // Hierarchical clustering with decreasing thresholds
  }
}

export class DistilAI {
  private templateBank: Map<string, TemplateEntry> = new Map();
  private discoveryQueue: string[] = [];
  private dataset: DatasetEntry[] = [];
  public storage: StorageAdapter;
  private tokenizer: any;
  private cacheTTL: number = 60000; // 1 minute
  private lastCacheUpdate: Map<string, number>;
  private discoveryThreshold: number;
  private similarityThreshold: number;
  private openaiClient: OpenAI;
  private isProcessing = false;

  constructor(config: {
    apiKey: string;
    organization?: string;
    baseURL?: string;
  } & {
    storage: StorageConfig;
    discoveryThreshold?: number;
    similarityThreshold?: number;
  }) {
    this.openaiClient = new OpenAI(config);
    this.storage = createStorageAdapter(config.storage);
    this.discoveryThreshold = config.discoveryThreshold || 50;
    this.similarityThreshold = config.similarityThreshold || 0.7;
    this.lastCacheUpdate = new Map();
    this.tokenizer = encoding_for_model('gpt-4o');
  }

  chat = {
    completions: {
      create: async (
        params: OpenAI.ChatCompletionCreateParamsNonStreaming
      ): Promise<DistilResponse<OpenAI.ChatCompletion>> => {
        const lastUserMessage = params.messages
          .filter(m => m.role === 'user')
          .pop()?.content as string;
        
        const startTime = Date.now();
        const versionData = await this.processPrompt(lastUserMessage);
        const estimatedTokens = lastUserMessage.length / 4;
        const estimatedCost = estimatedTokens * 0.00002;
        const model = 'gpt-4o';

        // Handle function/tool calling
        const response = await this.openaiClient.chat.completions.create({
          ...params,
          model,
          stream: false,
          // Preserve tool/function calling parameters
          tools: params.tools,
          tool_choice: params.tool_choice,
          response_format: params.response_format,
          seed: params.seed,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          presence_penalty: params.presence_penalty,
          frequency_penalty: params.frequency_penalty,
          logit_bias: params.logit_bias,
          user: params.user
        });
        
        const durationMs = Date.now() - startTime;
        const completion = response.choices[0].message?.content || '';
        const toolCalls = response.choices[0].message?.tool_calls;
        
        const usage = this.calculateUsage(
          lastUserMessage,
          completion,
          model,
          durationMs
        );

        await this.logPrompt({
          timestamp: new Date(),
          templateHash: versionData.templateHash,
          template: this.templateBank.get(versionData.templateHash)!.rawTemplate,
          variables: versionData.variables,
          prompt: lastUserMessage,
          completion,
          model,
          usage,
          toolCalls: toolCalls ? JSON.stringify(toolCalls) : undefined
        });
        
        return {
          ...response,
          _pvMeta: {
            modelVersion: this.templateBank.get(versionData.templateHash)!.modelVersion,
            templateHash: versionData.templateHash,
            variables: versionData.variables,
            template: this.templateBank.get(versionData.templateHash)!.rawTemplate,
            usage
          }
        };
      },

      createStreaming: async (
        params: OpenAI.ChatCompletionCreateParamsStreaming
      ): Promise<Stream<OpenAI.ChatCompletionChunk>> => {
        const lastUserMessage = params.messages
          .filter(m => m.role === 'user')
          .pop()?.content as string;
        
        const versionData = await this.processPrompt(lastUserMessage);
        const estimatedTokens = lastUserMessage.length / 4;
        const estimatedCost = estimatedTokens * 0.00002;
        const model = 'gpt-4o';

        const startTime = Date.now();
        const stream = await this.openaiClient.chat.completions.create({
          ...params,
          model,
          stream: true,
          // Preserve tool/function calling parameters
          tools: params.tools,
          tool_choice: params.tool_choice,
          response_format: params.response_format,
          seed: params.seed,
          temperature: params.temperature,
          top_p: params.top_p,
          max_tokens: params.max_tokens,
          presence_penalty: params.presence_penalty,
          frequency_penalty: params.frequency_penalty,
          logit_bias: params.logit_bias,
          user: params.user
        });

        let fullCompletion = '';
        let toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
        const controller = new AbortController();
        const self = this;
        
        const enhancedStream = new Stream(async function*(this: Stream<OpenAI.ChatCompletionChunk>) {
          try {
            for await (const chunk of stream) {
              // Accumulate tool calls from chunks
              if (chunk.choices[0]?.delta?.tool_calls) {
                const deltaToolCalls = chunk.choices[0].delta.tool_calls;
                for (const deltaToolCall of deltaToolCalls) {
                  const existingToolCall = toolCalls.find(t => t.id === deltaToolCall.id);
                  if (existingToolCall) {
                    // Append to existing tool call
                    existingToolCall.function.arguments += deltaToolCall.function?.arguments || '';
                    existingToolCall.function.name = deltaToolCall.function?.name || existingToolCall.function.name;
                  } else {
                    // Create new tool call
                    toolCalls.push({
                      id: deltaToolCall.id || `call_${deltaToolCall.index}`,
                      type: 'function',
                      function: {
                        name: deltaToolCall.function?.name || '',
                        arguments: deltaToolCall.function?.arguments || ''
                      }
                    });
                  }
                }
              }
              
              fullCompletion += chunk.choices[0]?.delta?.content || '';
              yield chunk;
            }

            const durationMs = Date.now() - startTime;
            const usage = self.calculateUsage(
              lastUserMessage,
              fullCompletion,
              model,
              durationMs
            );

            await self.logPrompt({
              timestamp: new Date(),
              templateHash: versionData.templateHash,
              template: self.templateBank.get(versionData.templateHash)!.rawTemplate,
              variables: versionData.variables,
              prompt: lastUserMessage,
              completion: fullCompletion,
              model,
              usage,
              toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined
            });
          } catch (error) {
            console.error('Error in stream processing:', error);
            throw error;
          }
        }, controller);

        // Handle cleanup when the stream is aborted
        controller.signal.addEventListener('abort', async () => {
          try {
            // @ts-ignore - stream.controller exists but isn't typed
            if (stream.controller) {
              // @ts-ignore
              await stream.controller.abort();
            }
          } catch (error) {
            console.warn('Error during stream abort:', error);
          }
        });

        return enhancedStream;
      }
    }
  };

  private async logPrompt(log: PromptLog): Promise<void> {
    await this.storage.logPrompt(log);
  }

  private async processPrompt(prompt: string): Promise<PromptMatch> {
    this.addToDiscoveryQueue(prompt);
    return this.matchToExistingTemplate(prompt);
  }

  private addToDiscoveryQueue(prompt: string) {
    this.discoveryQueue.push(prompt);
    
    if (this.discoveryQueue.length >= this.discoveryThreshold && !this.isProcessing) {
      this.isProcessing = true;
      const batch = this.discoveryQueue.splice(0, this.discoveryThreshold);
      
      // Process without blocking
      this.processDiscoveryBatch(batch).finally(() => {
        this.isProcessing = false;
        
        // Check remaining items after processing
        if (this.discoveryQueue.length >= this.discoveryThreshold) {
          this.addToDiscoveryQueue(''); // Trigger recursive processing
        }
      });
    }
  }

  private async processDiscoveryBatch(batch: string[]) {
    const engine = new ClusteringEngine(batch);
    const clusters = engine.clusterPrompts();

    clusters.forEach(cluster => {
      const analysis = engine.findCommonStructure();
      if (analysis.coverage > 0.7) {
        const template = this.createTemplateFromAnalysis(analysis);
        const templateHash = this.hashTemplate(template.rawTemplate);
        
        await this.safeTemplateUpdate(templateHash, {
          pattern: template.pattern,
          variables: template.variables,
          modelVersion: `model-${templateHash}-${Date.now()}`,
          firstSeen: new Date(),
          examples: cluster,
          rawTemplate: template.rawTemplate,
          version: 1,
          lock: Promise.resolve()
        });
      }
    });
  }

  private createTemplateFromAnalysis(analysis: {
    template: string;
    variables: Set<string>;
  }) {
    const variableRegex = '\\w+\\s*\\w*';
    const regexPattern = analysis.template
      .replace(/\{(\w+)\}/g, (_, varName) => 
        `(?<${varName}>${variableRegex})`
      )
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return {
      rawTemplate: analysis.template,
      pattern: new RegExp(`^${regexPattern}$`, 'i'),
      variables: Array.from(analysis.variables)
    };
  }

  private matchToExistingTemplate(prompt: string): PromptMatch {
    for (const [hash, entry] of this.templateBank) {
      try {
        const match = prompt.match(entry.pattern);
        if (match && match.groups) {
          return {
            templateHash: hash,
            variables: match.groups
          };
        }
      } catch (error) {
        console.warn(`Error matching template ${hash}:`, error);
        continue;
      }
    }
    
    // Create new template if no match
    const hash = this.hashTemplate(prompt);
    this.templateBank.set(hash, {
      pattern: new RegExp(`^${prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      variables: [],
      modelVersion: `model-${hash}-${Date.now()}`,
      firstSeen: new Date(),
      examples: [prompt],
      rawTemplate: prompt,
      version: 1,
      lock: Promise.resolve()
    });
    
    return { templateHash: hash, variables: {} };
  }

  private async safeTemplateUpdate(hash: string, entry: TemplateEntry) {
    await entry.lock;
    entry.lock = (async () => {
      // Compare-and-swap logic
      const current = this.templateBank.get(hash);
      if (current.version === entry.version) {
        this.templateBank.set(hash, { ...entry, version: entry.version + 1 });
      }
    })();
  }

  private hashTemplate(template: string): string {
    return crypto
      .createHash('sha256')
      .update(template)
      .digest('hex')
      .substring(0, 8);
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, value);
    });
    return result;
  }

  private exportDataset(options: {
    templateHash?: string;
    format?: 'jsonl' | 'csv';
  } = {}): DatasetEntry[] {
    let entries = this.dataset;
    
    if (options.templateHash) {
      entries = entries.filter(e => e.templateHash === options.templateHash);
    }
    
    return entries.map(entry => ({
      templateHash: entry.templateHash,
      template: this.templateBank.get(entry.templateHash)!.rawTemplate,
      variables: entry.variables,
      output: entry.output,
      timestamp: new Date(entry.timestamp)
    }));
  }

  async getUsageStats(filter?: {
    templateHash?: string;
    fromDate?: Date;
    toDate?: Date;
    model?: string;
  }): Promise<{
    totalCost: number;
    totalTokens: number;
    averageTokensPerSecond: number;
    promptCount: number;
  }> {
    const logs = await this.storage.getPromptLogs(filter);
    
    return logs.reduce((stats, log) => ({
      totalCost: stats.totalCost + log.usage.costUSD,
      totalTokens: stats.totalTokens + log.usage.totalTokens,
      averageTokensPerSecond: 
        (stats.averageTokensPerSecond * stats.promptCount + log.usage.tokensPerSecond) / 
        (stats.promptCount + 1),
      promptCount: stats.promptCount + 1
    }), {
      totalCost: 0,
      totalTokens: 0,
      averageTokensPerSecond: 0,
      promptCount: 0
    });
  }

  private calculateUsage(
    prompt: string,
    completion: string,
    model: string,
    durationMs: number
  ): UsageStats {
    try {
      const promptTokens = this.tokenizer.encode(prompt).length;
      const completionTokens = this.tokenizer.encode(completion).length;
      const totalTokens = promptTokens + completionTokens;

      // Cost calculation based on model
      const costs: Record<string, { prompt: number; completion: number }> = {
        'gpt-4o': { prompt: 0.03, completion: 0.06 },
        'gpt-4o-mini': { prompt: 0.001, completion: 0.002 }
      };

      const baseModel = model.startsWith('ft:') ? model.split(':')[1] : model;
      const modelCosts = costs[baseModel] || costs['gpt-4o-mini'];
      const costUSD = 
        (promptTokens * modelCosts.prompt + 
         completionTokens * modelCosts.completion) / 1000;

      const tokensPerSecond = totalTokens / (durationMs / 1000);

      return {
        promptTokens,
        completionTokens,
        totalTokens,
        costUSD,
        durationMs,
        tokensPerSecond
      };
    } catch (error) {
      console.warn('Error calculating usage:', error);
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUSD: 0,
        durationMs,
        tokensPerSecond: 0
      };
    }
  }
}
