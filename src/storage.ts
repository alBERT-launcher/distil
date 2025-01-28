import { createObjectCsvWriter } from 'csv-writer';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  durationMs: number;
  tokensPerSecond: number;
}

export interface PromptLog {
  timestamp: Date;
  templateHash: string;
  template: string;
  variables: Record<string, string>;
  prompt: string;
  completion: string;
  model: string;
  usage: UsageStats;
  toolCalls?: string; // JSON stringified tool calls
}

export interface ModelRouting {
  templateHash: string;
  modelId: string;
  isFineTuned: boolean;
  active: boolean;
  priority: number;  // Higher priority routes take precedence
  conditions?: {
    minTokens?: number;
    maxTokens?: number;
    costThreshold?: number;
    timeThreshold?: number;
  };
}

export interface StorageConfig {
  type: 'json' | 'csv' | 'elasticsearch' | 'supabase';
  options: {
    // For file-based storage
    directory?: string;
    filename?: string;
    
    // For Elasticsearch
    elasticUrl?: string;
    elasticApiKey?: string;
    elasticIndex?: string;
    
    // For Supabase
    supabaseUrl?: string;
    supabaseKey?: string;
    supabaseTable?: string;
  };
}

export interface StorageAdapter {
  initialize(): Promise<void>;
  logPrompt(log: PromptLog): Promise<void>;
  getPromptLogs(filter?: {
    templateHash?: string;
    fromDate?: Date;
    toDate?: Date;
    model?: string;
  }): Promise<PromptLog[]>;
  
  // Model routing methods
  getModelRouting(templateHash: string): Promise<ModelRouting[]>;
  setModelRouting(routing: ModelRouting): Promise<void>;
  deleteModelRouting(templateHash: string, modelId: string): Promise<void>;
}

export class JsonStorageAdapter implements StorageAdapter {
  private directory: string;
  private filename: string;
  private fullPath: string;
  private routingFile: string;

  constructor(options: StorageConfig['options']) {
    this.directory = options.directory || './logs';
    this.filename = options.filename || 'prompt-logs.json';
    this.fullPath = path.join(this.directory, this.filename);
    this.routingFile = path.join(this.directory, 'model-routing.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      await fs.access(this.fullPath);
    } catch {
      await fs.writeFile(this.fullPath, '[]');
    }
    try {
      await fs.access(this.routingFile);
    } catch {
      await fs.writeFile(this.routingFile, '[]');
    }
  }

  async logPrompt(log: PromptLog): Promise<void> {
    const logs = await this.getPromptLogs();
    logs.push(log);
    await fs.writeFile(this.fullPath, JSON.stringify(logs, null, 2));
  }

  async getPromptLogs(filter?: {
    templateHash?: string;
    fromDate?: Date;
    toDate?: Date;
    model?: string;
  }): Promise<PromptLog[]> {
    const content = await fs.readFile(this.fullPath, 'utf-8');
    let logs: PromptLog[] = JSON.parse(content);
    
    if (filter) {
      logs = logs.filter(log => {
        if (filter.templateHash && log.templateHash !== filter.templateHash) return false;
        if (filter.model && log.model !== filter.model) return false;
        if (filter.fromDate && new Date(log.timestamp) < filter.fromDate) return false;
        if (filter.toDate && new Date(log.timestamp) > filter.toDate) return false;
        return true;
      });
    }
    
    return logs;
  }

  async getModelRouting(templateHash: string): Promise<ModelRouting[]> {
    const content = await fs.readFile(this.routingFile, 'utf-8');
    const routes: ModelRouting[] = JSON.parse(content);
    return routes.filter(route => route.templateHash === templateHash)
                .sort((a, b) => b.priority - a.priority);
  }

  async setModelRouting(routing: ModelRouting): Promise<void> {
    const content = await fs.readFile(this.routingFile, 'utf-8');
    const routes: ModelRouting[] = JSON.parse(content);
    const index = routes.findIndex(route => 
      route.templateHash === routing.templateHash && route.modelId === routing.modelId
    );
    
    if (index >= 0) {
      routes[index] = routing;
    } else {
      routes.push(routing);
    }
    
    await fs.writeFile(this.routingFile, JSON.stringify(routes, null, 2));
  }

  async deleteModelRouting(templateHash: string, modelId: string): Promise<void> {
    const content = await fs.readFile(this.routingFile, 'utf-8');
    const routes: ModelRouting[] = JSON.parse(content);
    const filtered = routes.filter(route => 
      !(route.templateHash === templateHash && route.modelId === modelId)
    );
    await fs.writeFile(this.routingFile, JSON.stringify(filtered, null, 2));
  }
}

export class CsvStorageAdapter implements StorageAdapter {
  private directory: string;
  private filename: string;
  private csvWriter: any;
  private routingFile: string;

  constructor(options: StorageConfig['options']) {
    this.directory = options.directory || './logs';
    this.filename = options.filename || 'prompt-logs.csv';
    this.routingFile = path.join(this.directory, 'model-routing.csv');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
    
    this.csvWriter = createObjectCsvWriter({
      path: path.join(this.directory, this.filename),
      header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'templateHash', title: 'TEMPLATE_HASH' },
        { id: 'template', title: 'TEMPLATE' },
        { id: 'variables', title: 'VARIABLES' },
        { id: 'prompt', title: 'PROMPT' },
        { id: 'completion', title: 'COMPLETION' },
        { id: 'model', title: 'MODEL' },
        { id: 'promptTokens', title: 'PROMPT_TOKENS' },
        { id: 'completionTokens', title: 'COMPLETION_TOKENS' },
        { id: 'totalTokens', title: 'TOTAL_TOKENS' },
        { id: 'costUSD', title: 'COST_USD' },
        { id: 'durationMs', title: 'DURATION_MS' },
        { id: 'tokensPerSecond', title: 'TOKENS_PER_SECOND' },
        { id: 'toolCalls', title: 'TOOL_CALLS' }
      ]
    });
  }

  async logPrompt(log: PromptLog): Promise<void> {
    await this.csvWriter.writeRecords([{
      ...log,
      variables: JSON.stringify(log.variables),
      ...log.usage,
      toolCalls: log.toolCalls
    }]);
  }

  async getPromptLogs(): Promise<PromptLog[]> {
    throw new Error('CSV storage does not support reading logs');
  }

  async getModelRouting(templateHash: string): Promise<ModelRouting[]> {
    throw new Error('CSV storage does not support model routing');
  }

  async setModelRouting(routing: ModelRouting): Promise<void> {
    throw new Error('CSV storage does not support model routing');
  }

  async deleteModelRouting(templateHash: string, modelId: string): Promise<void> {
    throw new Error('CSV storage does not support model routing');
  }
}

export class ElasticsearchStorageAdapter implements StorageAdapter {
  private client: ElasticClient;
  private index: string;
  private routingIndex: string;

  constructor(options: StorageConfig['options']) {
    if (!options.elasticUrl || !options.elasticApiKey || !options.elasticIndex) {
      throw new Error('Missing Elasticsearch configuration');
    }

    this.client = new ElasticClient({
      node: options.elasticUrl,
      auth: { apiKey: options.elasticApiKey }
    });
    this.index = options.elasticIndex;
    this.routingIndex = options.elasticIndex + '-routing';
  }

  async initialize(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.index });
    if (!exists) {
      await this.client.indices.create({
        index: this.index,
        mappings: {
          properties: {
            timestamp: { type: 'date' },
            templateHash: { type: 'keyword' },
            template: { type: 'text' },
            variables: { type: 'object' },
            prompt: { type: 'text' },
            completion: { type: 'text' },
            model: { type: 'keyword' },
            usage: {
              properties: {
                promptTokens: { type: 'integer' },
                completionTokens: { type: 'integer' },
                totalTokens: { type: 'integer' },
                costUSD: { type: 'float' },
                durationMs: { type: 'integer' },
                tokensPerSecond: { type: 'float' }
              }
            },
            toolCalls: { type: 'text' }
          }
        }
      });
    }
    const routingExists = await this.client.indices.exists({ index: this.routingIndex });
    if (!routingExists) {
      await this.client.indices.create({
        index: this.routingIndex,
        mappings: {
          properties: {
            templateHash: { type: 'keyword' },
            modelId: { type: 'keyword' },
            isFineTuned: { type: 'boolean' },
            active: { type: 'boolean' },
            priority: { type: 'integer' },
            conditions: { type: 'object' }
          }
        }
      });
    }
  }

  async logPrompt(log: PromptLog): Promise<void> {
    await this.client.index({
      index: this.index,
      document: log
    });
  }

  async getPromptLogs(filter?: {
    templateHash?: string;
    fromDate?: Date;
    toDate?: Date;
    model?: string;
  }): Promise<PromptLog[]> {
    const must: any[] = [];
    
    if (filter) {
      if (filter.templateHash) {
        must.push({ term: { templateHash: filter.templateHash } });
      }
      if (filter.model) {
        must.push({ term: { model: filter.model } });
      }
      if (filter.fromDate || filter.toDate) {
        const range: any = { timestamp: {} };
        if (filter.fromDate) range.timestamp.gte = filter.fromDate;
        if (filter.toDate) range.timestamp.lte = filter.toDate;
        must.push({ range });
      }
    }

    const response = await this.client.search({
      index: this.index,
      query: { bool: { must } }
    });

    return response.hits.hits.map(hit => hit._source as PromptLog);
  }

  async getModelRouting(templateHash: string): Promise<ModelRouting[]> {
    const response = await this.client.search({
      index: this.routingIndex,
      query: { match: { templateHash } },
      sort: [{ priority: 'desc' }]
    });

    return response.hits.hits.map(hit => hit._source as ModelRouting);
  }

  async setModelRouting(routing: ModelRouting): Promise<void> {
    await this.client.index({
      index: this.routingIndex,
      id: `${routing.templateHash}-${routing.modelId}`,
      document: routing,
    });
  }

  async deleteModelRouting(templateHash: string, modelId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: this.routingIndex,
      query: {
        bool: {
          must: [
            { match: { templateHash } },
            { match: { modelId } }
          ]
        }
      }
    });
  }
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private client: any;
  private table: string;
  private routingTable: string;

  constructor(options: StorageConfig['options']) {
    if (!options.supabaseUrl || !options.supabaseKey || !options.supabaseTable) {
      throw new Error('Missing Supabase configuration');
    }

    this.client = createSupabaseClient(options.supabaseUrl, options.supabaseKey);
    this.table = options.supabaseTable;
    this.routingTable = options.supabaseTable + '-routing';
  }

  async initialize(): Promise<void> {
    // Supabase table should be created manually with proper schema
  }

  async logPrompt(log: PromptLog): Promise<void> {
    await this.client
      .from(this.table)
      .insert([{
        ...log,
        timestamp: log.timestamp.toISOString(),
        toolCalls: log.toolCalls
      }]);
  }

  async getPromptLogs(filter?: {
    templateHash?: string;
    fromDate?: Date;
    toDate?: Date;
    model?: string;
  }): Promise<PromptLog[]> {
    let query = this.client
      .from(this.table)
      .select('*');
    
    if (filter) {
      if (filter.templateHash) {
        query = query.eq('templateHash', filter.templateHash);
      }
      if (filter.model) {
        query = query.eq('model', filter.model);
      }
      if (filter.fromDate) {
        query = query.gte('timestamp', filter.fromDate.toISOString());
      }
      if (filter.toDate) {
        query = query.lte('timestamp', filter.toDate.toISOString());
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data.map((row: any) => ({
      ...row,
      timestamp: new Date(row.timestamp)
    }));
  }

  async getModelRouting(templateHash: string): Promise<ModelRouting[]> {
    const { data, error } = await this.client
      .from(this.routingTable)
      .select('*')
      .eq('templateHash', templateHash)
      .order('priority', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  async setModelRouting(routing: ModelRouting): Promise<void> {
    const { error } = await this.client
      .from(this.routingTable)
      .upsert(routing, {
        onConflict: 'templateHash,modelId'
      });
    
    if (error) throw error;
  }

  async deleteModelRouting(templateHash: string, modelId: string): Promise<void> {
    const { error } = await this.client
      .from(this.routingTable)
      .delete()
      .match({ templateHash, modelId });
    
    if (error) throw error;
  }
}

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'json':
      return new JsonStorageAdapter(config.options);
    case 'csv':
      return new CsvStorageAdapter(config.options);
    case 'elasticsearch':
      return new ElasticsearchStorageAdapter(config.options);
    case 'supabase':
      return new SupabaseStorageAdapter(config.options);
    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }
}
