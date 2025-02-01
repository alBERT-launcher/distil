// src/config.ts
import dotenv from "dotenv";
dotenv.config();

export const config = {
  elastic: {
    host: process.env.ELASTICHOST || "",
    user: process.env.ELASTICUSER || "",
    password: process.env.ELASTICPW || "",
    dataIndex: "distil_data",
    logIndex: "distil_logs"
  },
  openLLM: {
    apiKey: process.env.OPENROUTER_APIKEY || "",
    baseUrl: process.env.OPENLLM_BASE_URL || "https://openrouter.ai/api/v1"
  },
  costPerToken: 4.5 / 10000000,
  retry: {
    retries: 3,
    delay: 1000
  },
  dashboard: {
    port: process.env.DASHBOARD_PORT || 3000
  }
};
