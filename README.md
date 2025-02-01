# Distil

[![npm version](https://badge.fury.io/js/distil.svg)](https://npmjs.com/package/distil)  
[![license](https://img.shields.io/npm/l/distil.svg)](https://npmjs.com/package/distil)

**Distil** is an opinionated library for managing LLM pipelines. It lets you define named pipelines with custom prompt templates, preprocess your inputs (e.g. inject code examples), postprocess outputs (e.g. strip code blocks), and automatically track pipeline versions through a dashboard. With Distil, you can also rate outputs and automatically mark successful generations as finetuned when you export them—ensuring that your high-quality prompt–completion pairs are curated for future fine-tuning.

## Key Features

- **Named Pipelines:**  
  Define a pipeline by providing a name, system prompt, user prompt, and default parameters. These templates are used to compute a unique version hash for tracking.

- **Custom Preprocessing/Postprocessing:**  
  Swap in your own functions! For example, preprocess inputs to inject ShadCN component code, or postprocess outputs to remove unwanted TSX codeblocks.

- **Version Tracking & Curation:**  
  Every run is automatically versioned (via a template hash), with metadata such as cost and timing stored. Use the built-in dashboard to view, rate, and tag outputs.

- **Automatic Finetuning Marking:**  
  When you export or trigger fine-tuning via the dashboard, the associated outputs are automatically marked as finetuned so that they are not reused in future training.

- **Integrated Dashboard:**  
  An Express-based dashboard API lets you list pipeline versions, add tags, rate them (1–5 stars), and mark them as finetuned—giving you complete visibility into your generation history.

## Installation

Install via npm:
```bash
npm install distil
```

## Configuration

Distil uses environment variables for configuration. Create a `.env` file in your project root:

```bash
# Copy the example environment file
cp example.env .env
```

### Available Configuration Options

1. **Elasticsearch Configuration:**
   ```env
   ELASTICHOST=http://localhost:9200  # Elasticsearch host URL
   ELASTICUSER=elastic                # Elasticsearch username
   ELASTICPW=changeme                 # Elasticsearch password
   ```
   The library uses two indices by default:
   - `distil_data`: Stores pipeline versions and metadata
   - `distil_logs`: Stores execution logs

2. **OpenRouter/LLM Configuration:**
   ```env
   OPENROUTER_APIKEY=your_api_key_here           # Your OpenRouter API key
   OPENLLM_BASE_URL=https://openrouter.ai/api/v1 # OpenRouter base URL
   ```
   Default cost per token is set to 4.5/10M tokens.

3. **Dashboard Configuration:**
   ```env
   DASHBOARD_PORT=3000    # Port for the dashboard server
   RUN_DASHBOARD=true     # Enable/disable dashboard
   ```

4. **Retry Configuration:**
   The library includes built-in retry logic with these defaults:
   - 3 retry attempts
   - 1000ms delay between retries

### Configuration Priority

1. Environment variables take highest priority
2. Values in `.env` file
3. Default values from the configuration

## Quick Start Example

Below is an example that generates a comprehensive ShadCN React component. The preprocessing step injects component code examples, and the postprocessing step removes TSX code blocks from the output.

```typescript
import { DistilPipeline } from "distil";

// Custom preprocessing: log input and inject default code if missing.
const customPreprocess = async (input) => {
  console.log("Preprocessing: Adjusting input for ShadCN component generation.");
  if (!input.parameters?.primaryComponentCode) {
    input.parameters = {
      ...input.parameters,
      primaryComponentCode: "// Fallback default ShadCN Button code..."
    };
  }
  return input;
};

// Custom postprocessing: remove TSX code blocks.
// Replace "```tsx" with "```" and extract the content inside the code block.
const customPostprocess = async (raw: string, extraData: any) => {
  const cleaned = raw.replaceAll("```tsx", "```");
  const parts = cleaned.split("```");
  // Return the code inside the code block.
  return parts[1] || cleaned;
};

const pipeline = new DistilPipeline({
  pipelineName: "shadcn-react-component-generator",
  systemPrompt:
    "You are an expert React developer with deep knowledge of ShadCN UI components. " +
    "You are provided with a set of component code examples for reference.",
  userPrompt:
    "Using the provided code snippets {primaryComponentCode} and {secondaryComponentCode}, " +
    "generate a brand new, comprehensive React component. Return the result wrapped in a TSX code block.",
  defaultParameters: {
    primaryComponentCode: `
\`\`\`tsx
// Example ShadCN Button component
import React from "react";
export const Button = () => <button className="btn">Click me</button>;
\`\`\`
    `,
    secondaryComponentCode: `
\`\`\`tsx
// Example ShadCN Card component
import React from "react";
export const Card = ({ children }) => <div className="card">{children}</div>;
\`\`\`
    `
  },
  preprocess: customPreprocess,
  postprocess: customPostprocess
}, "DEBUG");

async function runExample() {
  const input = {
    modelName: "ignored", // This is overridden by the pipeline name.
    systemPrompt: pipeline.systemPrompt,
    userPrompt: pipeline.userPrompt,
    parameters: {
      primaryComponentCode: `
\`\`\`tsx
// Custom ShadCN Button component
import React from "react";
export const CustomButton = () => <button className="custom-btn">Press me</button>;
\`\`\`
      `,
      secondaryComponentCode: `
\`\`\`tsx
// Custom ShadCN Card component
import React from "react";
export const CustomCard = ({ children }) => <div className="custom-card">{children}</div>;
\`\`\`
      `
    },
    extraData: { extra: "Include PropTypes documentation." }
  };

  const result = await pipeline.generate(input);
  if (result) {
    console.log("Generated Component Output:\n", result.processedOutput);
    console.log("Metadata:", result.metadata);
  } else {
    console.error("No output generated.");
  }
}

runExample().catch(console.error);

## Dashboard & Curation

Distil includes an Express-based dashboard to help you review and curate your outputs:

1. **Run the Dashboard:**
   Set the environment variable and start the server:
   ```bash
   export RUN_DASHBOARD=true
   npm run build
   npm start
   ```
   Then open [http://localhost:3000/dashboard/versions](http://localhost:3000/dashboard/versions).

2. **Review Pipeline Versions:**  
   The dashboard shows each version with its unique hash, tags, ratings, and finetuning status.

3. **Rate & Tag:**  
   Use endpoints to add tags and rate output quality (e.g. 1–5 stars).

4. **Automatic Finetuning Mark:**  
   When you trigger a finetuning export from your UI, Distil calls the finetuning endpoint to automatically mark those outputs as finetuned, so they are not included in future training rounds.

## Why Distil?

- **Customizable & Transparent:**  
  Easily swap in your own preprocessing and postprocessing, and track every run with versioning and metadata.
- **Efficient Curation:**  
  Review, rate, and curate your best prompt–completion pairs using the built-in dashboard.
- **Automated Finetuning:**  
  Automatically flag outputs as finetuned on export, preparing high-quality data for your next model updates.
- **Developer Friendly:**  
  A modular, easy-to-use codebase that integrates seamlessly into your existing projects.

## Elasticsearch Setup

Distil includes a Docker Compose configuration for setting up Elasticsearch, which can be used for efficient storage and search of your pipeline versions:

1. **Start Elasticsearch:**
   ```bash
   docker-compose up -d elasticsearch
   ```

2. **Verify Installation:**
   ```bash
   curl http://localhost:9200
   ```

The Docker Compose configuration includes:
- Single-node Elasticsearch cluster
- Security features disabled for development
- Memory limits set to 512MB
- Persistent volume for data storage
- Exposed on port 9200

You can customize the configuration by editing the `docker-compose.yml` file:
```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.3
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
```

For production environments, make sure to:
- Enable security features
- Configure appropriate memory limits
- Set up proper authentication
- Use multiple nodes for high availability

## Summary

With **Distil**, you have a full-featured solution to define, track, and curate LLM-generated outputs. Customize your pipelines, inject custom processing into your prompts, and use the integrated dashboard to rate and automatically mark your best outputs as finetuned for future training. Replace prompt-engineered models with high-quality finetuned ones seamlessly.

Happy building and distilling!
