// src/logger.ts
import { Client } from "@elastic/elasticsearch";
import { config } from "./config";

export class Logger {
  private esClient?: Client;

  constructor(private level: "DEBUG" | "INFO" | "WARNING" | "ERROR" = "DEBUG") {
    if (config.elastic.host) {
      const clientConfig: any = {
        node: config.elastic.host
      };

      // Only add authentication if credentials are provided
      if (config.elastic.user && config.elastic.password) {
        clientConfig.auth = {
          username: config.elastic.user,
          password: config.elastic.password
        };
      }

      this.esClient = new Client(clientConfig);
    }
  }

  private async logToES(index: string, message: any): Promise<void> {
    if (!this.esClient) return;
    await this.esClient.index({
      index,
      body: { ...message, "@timestamp": new Date().toISOString() }
    });
  }

  async debug(msg: string) {
    console.debug(msg);
    await this.logToES(config.elastic.logIndex, { level: "DEBUG", msg });
  }

  async info(msg: string) {
    console.info(msg);
    await this.logToES(config.elastic.logIndex, { level: "INFO", msg });
  }

  async warn(msg: string) {
    console.warn(msg);
    await this.logToES(config.elastic.logIndex, { level: "WARNING", msg });
  }

  async error(msg: string) {
    console.error(msg);
    await this.logToES(config.elastic.logIndex, { level: "ERROR", msg });
  }
}
