import { PromptLog } from './storage';

export interface ModelVersion {
  id: string;
  name: string;
  baseModel: string;
  fineTuned: boolean;
  templateHash: string;
  createdAt: Date;
  metrics: {
    accuracy?: number;
    avgResponseTime: number;
    costPerToken: number;
    usageCount: number;
  };
  marketplace?: {
    published: boolean;
    price: number;
    description: string;
    tags: string[];
    ratings: number;
    revenue: number;
  };
}

export interface DatasetEntry extends PromptLog {
  rating?: number;
  comment?: string;
  edited: boolean;
  editedCompletion?: string;
}

export interface DashboardAPI {
  // Dataset Management
  listDatasets(): Promise<{
    templateHash: string;
    name: string;
    entries: number;
    avgRating: number;
    lastUpdated: Date;
  }[]>;

  getDatasetEntries(templateHash: string): Promise<DatasetEntry[]>;
  
  rateEntry(entryId: string, rating: number, comment?: string): Promise<void>;
  
  editEntry(entryId: string, completion: string): Promise<void>;

  // Model Management
  listModels(): Promise<ModelVersion[]>;
  
  createFineTune(templateHash: string, options?: {
    name?: string;
    baseModel?: string;
  }): Promise<ModelVersion>;
  
  setActiveModel(modelId: string): Promise<void>;
  
  // Marketplace
  publishModel(modelId: string, options: {
    price: number;
    description: string;
    tags: string[];
  }): Promise<void>;
  
  unpublishModel(modelId: string): Promise<void>;
  
  searchMarketplace(query: string): Promise<ModelVersion[]>;
  
  subscribeToModel(modelId: string): Promise<{
    apiKey: string;
    endpoint: string;
  }>;

  // Analytics
  getAnalytics(modelId: string): Promise<{
    usage: {
      totalRequests: number;
      totalTokens: number;
      totalCost: number;
    };
    performance: {
      avgResponseTime: number;
      avgTokensPerSecond: number;
      errorRate: number;
    };
    revenue?: {
      total: number;
      lastMonth: number;
      subscribers: number;
    };
  }>;
}
