import OpenAI from 'openai';
import crypto from 'crypto';
import { stringSimilarity } from 'fast-string-similarity';
import { encoding_for_model } from 'tiktoken';
import { StorageAdapter, StorageConfig, createStorageAdapter, UsageStats, PromptLog } from './storage';

interface TemplateEntry {
  pattern: RegExp;
  variables: string[];
  modelVersion: string;
  firstSeen: Date;
  examples: string[];
  rawTemplate: string;
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

class PrefixTree {
  private root: { [key: string]: any } = {};
  private paths: string[][] = [];

  insert(tokens: string[]) {
    let node = this.root;
    for (const token of tokens) {
      if (!node[token]) {
        node[token] = {};
      }
      node = node[token];
    }
    this.paths.push(tokens);
  }

  getClusters(similarityThreshold: number): string[][] {
    const clusters: string[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < this.paths.length; i++) {
      if (used.has(i)) continue;

      const cluster = [this.paths[i].join(' ')];
      used.add(i);

      for (let j = i + 1; j < this.paths.length; j++) {
        if (used.has(j)) continue;

        const similarity = stringSimilarity(
          this.paths[i].join(' '),
          this.paths[j].join(' ')
        );

        if (similarity >= similarityThreshold) {
          cluster.push(this.paths[j].join(' '));
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }
}

export class LeanPromptVersioning {
  private templateBank: Map<string, TemplateEntry> = new Map();
  private isDiscoveryPhase = true;
  private discoveryQueue: string[] = [];
  private dataset: DatasetEntry[] = [];
  private storage: StorageAdapter;
  private tokenizer: any;

  constructor(
    private readonly config: {
      openaiConfig: OpenAI.ClientOptions;
      storage: StorageConfig;
      discoveryThreshold?: number;
      similarityThreshold?: number;
    }
  ) {
    this.storage = createStorageAdapter(config.storage);
    this.discoveryThreshold = config.discoveryThreshold || 50;
    this.similarityThreshold = config.similarityThreshold || 0.7;
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    this.tokenizer = encoding_for_model('gpt-4');
  }

  private calculateUsage(
    prompt: string,
    completion: string,
    model: string,
    durationMs: number
  ): UsageStats {
    const promptTokens = this.tokenizer.encode(prompt).length;
    const completionTokens = this.tokenizer.encode(completion).length;
    const totalTokens = promptTokens + completionTokens;

    // Cost calculation based on model
    const costs: Record<string, { prompt: number; completion: number }> = {
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 }
    };

    const modelCosts = costs[model] || costs['gpt-3.5-turbo'];
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
  }

  async createCompletion(
    params: OpenAI.CompletionCreateParams
  ): Promise<OpenAI.CompletionCreateResponse & { _pvMeta: any }> {
    const prompt = params.prompt as string;
    const startTime = Date.now();
    
    const versionData = await this.processPrompt(prompt);
    const openai = new OpenAI(this.config.openaiConfig);
    const response = await openai.completions.create(params);
    
    const durationMs = Date.now() - startTime;
    const completion = response.choices[0].text || '';
    
    const usage = this.calculateUsage(
      prompt,
      completion,
      params.model,
      durationMs
    );

    await this.logPrompt({
      timestamp: new Date(),
      templateHash: versionData.templateHash,
      template: this.templateBank.get(versionData.templateHash)!.rawTemplate,
      variables: versionData.variables,
      prompt,
      completion,
      model: params.model,
      usage
    });
    
    return this.wrapResponse(response, versionData, usage);
  }

  async createChatCompletion(
    params: OpenAI.ChatCompletionCreateParams
  ): Promise<OpenAI.ChatCompletion & { _pvMeta: any }> {
    const lastUserMessage = params.messages
      .filter(m => m.role === 'user')
      .pop()?.content as string;
    
    const startTime = Date.now();
    const versionData = await this.processPrompt(lastUserMessage);
    
    const openai = new OpenAI(this.config.openaiConfig);
    const response = await openai.chat.completions.create(params);
    
    const durationMs = Date.now() - startTime;
    const completion = response.choices[0].message?.content || '';
    
    const usage = this.calculateUsage(
      lastUserMessage,
      completion,
      params.model,
      durationMs
    );

    await this.logPrompt({
      timestamp: new Date(),
      templateHash: versionData.templateHash,
      template: this.templateBank.get(versionData.templateHash)!.rawTemplate,
      variables: versionData.variables,
      prompt: lastUserMessage,
      completion,
      model: params.model,
      usage
    });
    
    return this.wrapResponse(response, versionData, usage);
  }

  private async logPrompt(log: PromptLog): Promise<void> {
    await this.storage.logPrompt(log);
  }

  private async processPrompt(prompt: string): Promise<PromptMatch> {
    if (this.isDiscoveryPhase) {
      this.discoveryQueue.push(prompt);
      
      if (this.discoveryQueue.length >= this.discoveryThreshold) {
        await this.processDiscoveryBatch();
        this.isDiscoveryPhase = false;
      }
    }
    
    return this.matchToExistingTemplate(prompt);
  }

  private async processDiscoveryBatch() {
    const trie = new PrefixTree();
    this.discoveryQueue.forEach(p => trie.insert(p.split(' ')));
    
    const clusters = trie.getClusters(this.similarityThreshold);
    
    for (const cluster of clusters) {
      const template = this.createTemplate(cluster);
      const templateHash = this.hashTemplate(template.rawTemplate);
      
      this.templateBank.set(templateHash, {
        pattern: template.pattern,
        variables: template.variables,
        modelVersion: `model-${templateHash}-${Date.now()}`,
        firstSeen: new Date(),
        examples: cluster,
        rawTemplate: template.rawTemplate
      });
    }
  }

  private createTemplate(cluster: string[]) {
    // Find the template by identifying variable parts
    const tokens = cluster.map(p => p.split(' '));
    const templateTokens: string[] = [];
    const variables: string[] = [];
    let varCounter = 0;

    // Use the first example as base
    const baseTokens = tokens[0];
    
    for (let i = 0; i < baseTokens.length; i++) {
      let isVariable = false;
      
      // Check if this position varies across examples
      for (let j = 1; j < tokens.length; j++) {
        if (tokens[j][i] !== baseTokens[i]) {
          isVariable = true;
          break;
        }
      }

      if (isVariable) {
        const varName = `var${varCounter++}`;
        variables.push(varName);
        templateTokens.push(`{${varName}}`);
      } else {
        templateTokens.push(baseTokens[i]);
      }
    }

    const rawTemplate = templateTokens.join(' ');
    const pattern = this.createRegexPattern(rawTemplate, variables);

    return { pattern, variables, rawTemplate };
  }

  private createRegexPattern(template: string, variables: string[]): RegExp {
    let pattern = template;
    
    // Escape regex special characters in static parts
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace variables with capture groups
    variables.forEach(v => {
      pattern = pattern.replace(
        `{${v}}`,
        `(?<${v}>[^\\s]+)`
      );
    });
    
    return new RegExp(`^${pattern}$`);
  }

  private matchToExistingTemplate(prompt: string): PromptMatch {
    for (const [hash, entry] of this.templateBank) {
      const match = prompt.match(entry.pattern);
      if (match && match.groups) {
        return {
          templateHash: hash,
          variables: match.groups
        };
      }
    }
    
    // Create new template if no match
    const hash = this.hashTemplate(prompt);
    this.templateBank.set(hash, {
      pattern: new RegExp('^' + prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
      variables: [],
      modelVersion: `model-${hash}-${Date.now()}`,
      firstSeen: new Date(),
      examples: [prompt],
      rawTemplate: prompt
    });
    
    return { templateHash: hash, variables: {} };
  }

  private hashTemplate(template: string): string {
    return crypto
      .createHash('sha256')
      .update(template)
      .digest('hex')
      .substring(0, 8);
  }

  private wrapResponse<T extends { choices: Array<{ text?: string; message?: { content: string } }> }>(
    response: T,
    versionData: PromptMatch,
    usage: UsageStats
  ): T & { _pvMeta: any } {
    const outputText = response.choices[0].text || 
      (response.choices[0].message && response.choices[0].message.content) ||
      '';
    
    // Store dataset entry
    this.dataset.push({
      templateHash: versionData.templateHash,
      variables: versionData.variables,
      output: outputText,
      timestamp: new Date()
    });
    
    const template = this.templateBank.get(versionData.templateHash)!;
    
    return {
      ...response,
      _pvMeta: {
        modelVersion: template.modelVersion,
        templateHash: versionData.templateHash,
        variables: versionData.variables,
        template: template.rawTemplate,
        usage
      }
    };
  }

  exportDataset(options: {
    templateHash?: string;
    format?: 'jsonl' | 'csv';
  } = {}) {
    let entries = this.dataset;
    
    if (options.templateHash) {
      entries = entries.filter(e => e.templateHash === options.templateHash);
    }
    
    return entries.map(entry => ({
      template_hash: entry.templateHash,
      template: this.templateBank.get(entry.templateHash)!.rawTemplate,
      variables: entry.variables,
      output: entry.output,
      timestamp: entry.timestamp.toISOString()
    }));
  }

  getTemplateStats() {
    return Array.from(this.templateBank.entries()).map(([hash, entry]) => ({
      hash,
      template: entry.rawTemplate,
      variables: entry.variables,
      modelVersion: entry.modelVersion,
      firstSeen: entry.firstSeen,
      exampleCount: entry.examples.length
    }));
  }

  async createFineTuneJob(templateHash: string) {
    const template = this.templateBank.get(templateHash);
    if (!template) throw new Error('Template not found');

    const dataset = this.exportDataset({ templateHash });
    
    // Format data for fine-tuning
    const trainingData = dataset.map(entry => ({
      prompt: this.replaceVariables(template.rawTemplate, entry.variables),
      completion: entry.output
    }));

    // Here you would implement the actual fine-tuning job creation
    // using OpenAI's fine-tuning API
    return {
      modelVersion: template.modelVersion,
      trainingExamples: trainingData.length,
      template: template.rawTemplate
    };
  }

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(`{${key}}`, value);
    });
    return result;
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
}
