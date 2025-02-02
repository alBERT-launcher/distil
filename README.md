# Distil

**Distil** is a TypeScript framework designed for building, monitoring, and improving LLM pipelines. With end-to-end tracing of prompt–completion pairs, integrated curation tools, and automated fine-tuning workflows, Distil empowers teams to create production-ready LLM features while tracking costs and performance at scale.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Dashboard](#dashboard)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Getting Started](#getting-started)
- [Quick Example](#quick-example)
- [Rating and Fine-tuning](#rating-and-fine-tuning)
- [Advanced Features](#advanced-features)
  - [Logging and Retry Logic](#logging-and-retry-logic)
  - [Pre/Post Processing Customization](#prepost-processing-customization)
  - [Template Versioning](#template-versioning)
  - [Cost Tracking](#cost-tracking)
  - [Elasticsearch Integration](#elasticsearch-integration)
- [Error Handling](#error-handling)
- [Development Tips](#development-tips)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Distil provides a unified interface to design and operate LLM pipelines with a focus on:

- **Robust Pipelines:** Custom pre- and post-processing, retry logic, and error handling.
- **Full Traceability:** End-to-end logging and monitoring of prompt and completion pairs.
- **Version Control:** Hash-based tracking to identify the most effective prompts and parameters.
- **Curation Tools:** Rating outputs, tagging examples, and exporting data for fine-tuning.
- **Integrated Dashboard:** A sleek web interface to visualize pipeline performance, view versions, and monitor metrics.

Whether you’re building new LLM features or refining existing ones, Distil is built to streamline your workflow and continuously improve your output quality.

---

## Core Features

- **Easy Pipeline Setup:**  
  Define pipelines with custom system and user prompts, parameters, and unique fingerprints for every run.

- **Custom Pre and Post Processing:**  
  Tweak inputs before submission and clean outputs after generation. Add your own logic to inject examples or extract code snippets.

- **Logging & Tracking:**  
  Every run is logged with metadata such as cost, runtime, and success rates, so you’re always informed about your pipeline’s performance.

- **Built-in Dashboard:**  
  Enjoy a modern web interface (powered by Express and HTMX) that comes bundled without additional dependencies. Monitor versions, rate outputs, add tags, and track metrics in real time.

- **Elasticsearch Integration:**  
  Store and search your pipeline logs and versions seamlessly with Elasticsearch integration.

---

## Dashboard

When Distil is installed, a web dashboard automatically starts on the configured port (default is **3452**). The dashboard lets you:

- Browse all pipeline versions.
- Inspect generation outputs.
- Rate generations for quality.
- Tag outputs for fine-tuning.
- Track costs and performance metrics.

Access the dashboard at:  
`http://localhost:3452` (or your configured port)

---

## Configuration & Environment Variables

Customize Distil’s behavior through environment variables. Create a `.env` file in your project root:

```env
# Elasticsearch Configuration
ELASTICHOST=http://localhost:9200
ELASTICUSER=elastic
ELASTICPW=changeme

# LLM API Configuration
OPENROUTER_APIKEY=your_api_key_here
OPENLLM_BASE_URL=https://openrouter.ai/api/v1

# Dashboard Settings
DASHBOARD_PORT=3000
RUN_DASHBOARD=true

# Stack Configuration (Optional)
STACK_VERSION=7.17.10
CLUSTER_NAME=distil_cluster

# Retry Configuration (Optional)
RETRY_ATTEMPTS=3    # Default: 3
RETRY_DELAY=1000   # Delay between retries in ms (Default: 1000)

# Elasticsearch Indices (Optional)
ES_DATA_INDEX=distil_data  # Default: distil_data
ES_LOG_INDEX=distil_logs   # Default: distil_logs
```

---

## Getting Started

Install Distil via npm:

```bash
npm install @lewist9x/distil
```

Then, configure your environment and start building pipelines.

---

## Quick Example

Below is a complete example that demonstrates how to create a retrieval-augmented generation (RAG) pipeline for generating ShadCN UI components:

```typescript
import { DistilPipeline } from "@lewist9x/distil";

// Custom preprocessor to inject ShadCN component examples
const preprocess = (input) => {
  console.log("Injecting ShadCN component examples...");
  if (!input.parameters?.components) {
    input.parameters = {
      ...input.parameters,
      components: {
        button: `\`\`\`tsx
import * as React from "react"
import { Button } from "@/components/ui/button"
 
export function ButtonDemo() {
  return (
    <Button variant="outline">Button</Button>
  )
}
\`\`\``,
        card: `\`\`\`tsx
import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
 
export function CardDemo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
    </Card>
  )
}
\`\`\``
      }
    };
  }
  return input;
};

// Custom postprocessor to extract component code from the TSX code block
const postprocess = (output: string) => {
  console.log("Extracting component code from output...");
  const cleaned = output.replaceAll("```tsx", "```");
  const parts = cleaned.split("```");
  return parts[1]?.trim() || output;
};

// Set up the pipeline for generating ShadCN components
const pipeline = new DistilPipeline({
  pipelineName: "shadcn-component-generator",
  modelName: "gpt-3.5-turbo",
  systemPrompt: 
    "You are an expert React developer specializing in ShadCN UI components. " +
    "You create modern, accessible, and reusable components following best practices.",
  userPrompt: 
    "Using these ShadCN component examples as reference:\n\n" +
    "Button Component:\n{components.button}\n\n" +
    "Card Component:\n{components.card}\n\n" +
    "Create a new {componentType} component that {requirements}. " +
    "Return only the component code wrapped in a TSX code block.",
  defaultParameters: {
    componentType: "interactive",
    requirements: "combines Button and Card in an innovative way"
  },
  preprocess,
  postprocess
}, "DEBUG");

async function run() {
  const result = await pipeline.generate({
    parameters: {
      componentType: "product card",
      requirements: "displays product info in a card with a purchase button",
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9
    }
  });
  
  if (result) {
    console.log("✨ Generated Component Code:");
    console.log(result.processedOutput);
    console.log("\n📊 Generation Stats:", {
      cost: `$${result.metadata.generationCost.toFixed(4)}`,
      time: `${result.metadata.timeTaken}ms`,
      version: result.metadata.templateHash
    });
  }
}

run().catch(console.error);
```

---

## Rating and Fine-tuning

Enhance your components by rating and collecting high-quality examples:

```typescript
// Rate a generated component (scale of 1-5)
await pipeline.rateGeneration(result.metadata.templateHash, 5, "Perfect component!");

// Mark the component for fine-tuning
await pipeline.markForFinetuning(result.metadata.templateHash);

// Export your best examples for fine-tuning
const examples = await pipeline.exportFinetuningData({
  minRating: 4,  // Only export highly-rated generations
  format: "jsonl" // Format suitable for fine-tuning
});

console.log("High quality examples:", examples);
```

You can also manage these actions through the dashboard at `http://localhost:3000/dashboard`.

---

## Advanced Features

### Logging and Retry Logic

Control the verbosity of Distil using different logging levels:

```typescript
const pipeline = new DistilPipeline(config, "DEBUG");   // Super chatty
const pipeline = new DistilPipeline(config, "INFO");    // Only important info
const pipeline = new DistilPipeline(config, "WARNING"); // Only warnings
const pipeline = new DistilPipeline(config, "ERROR");   // Only errors
```

Distil includes automatic retry logic for failed API calls. Configure the number of retry attempts and delay in your `.env`:

```env
RETRY_ATTEMPTS=3    # Default: 3
RETRY_DELAY=1000   # Delay in ms (Default: 1000)
```

### Pre/Post Processing Customization

Customize your inputs and outputs easily:

```typescript
const pipeline = new DistilPipeline({
  pipelineName: "shadcn-component-generator",
  // ...other configurations
  preprocess: async (input: LLMInput) => {
    input.systemPrompt += "\nHere are some example components:\n" + await getExamples();
    return input;
  },
  postprocess: (output: string) => {
    const tsxMatch = output.match(/```tsx\n([\s\S]*?)```/);
    return tsxMatch ? tsxMatch[1].trim() : output;
  }
});
```

### Template Versioning

Distil automatically hashes your prompts and parameters so that similar runs are grouped together:

```typescript
// Same parameters produce the same hash, regardless of order:
const result1 = await pipeline.generate({
  parameters: { type: "card", style: "modern" }
});
const result2 = await pipeline.generate({
  parameters: { style: "modern", type: "card" }
});

// Different parameters yield a different hash:
const result3 = await pipeline.generate({
  parameters: { type: "button", style: "modern" }
});

// Retrieve all versions of a given template
const versions = await pipeline.getVersionsByHash(result1.metadata.templateHash);

// Compare performance metrics for a template
console.log(
  "Template Stats:",
  await pipeline.getTemplateStats(result1.metadata.templateHash)
);
```

### Cost Tracking

Keep an eye on spending by tracking the cost per token. Set your cost in the environment:

```env
COST_PER_TOKEN=0.000001
```

Each generation’s cost is then tracked and available in the metadata:

```typescript
const result = await pipeline.generate({...});
console.log("Generation cost: $", result.metadata.generationCost);

const stats = await pipeline.getVersionStats(result.metadata.templateHash);
console.log("Total cost: $", stats.totalCost);
```

### Elasticsearch Integration

Store and search all your logs and pipeline versions using Elasticsearch. Configure your indices in the `.env` file:

```env
ES_LOG_INDEX=distil_logs   # Default: distil_logs
```

Query logs programmatically:

```typescript
// Retrieve logs for a specific version
const logs = await pipeline.getVersionLogs(result.metadata.templateHash);

// Search for outputs with specific tags and ratings
const cardExamples = await pipeline.searchVersions({
  tag: "product-card",
  minRating: 4
});
```

---

## Error Handling

Distil comes with robust error handling and retry mechanisms. Here’s how you might handle common scenarios:

```typescript
try {
  const result = await pipeline.generate({
    parameters: { componentType: "product card" }
  });
  
  if (!result) {
    console.error("Generation failed - no result returned");
    return;
  }
  
  console.log("Success!", result.processedOutput);
} catch (error) {
  if (error.message.includes("Invalid input")) {
    console.error("Invalid pipeline input:", error.message);
  } else if (error.message.includes("API")) {
    console.error("API error:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}

// Check retry counts for the version
const stats = await pipeline.getVersionStats(result.metadata.templateHash);
if (stats.retryCount > 0) {
  console.warn(`Required ${stats.retryCount} retries to succeed`);
}

// Set up event listeners for errors and retries
pipeline.on("error", (error) => {
  console.error("Pipeline error:", error);
});

pipeline.on("retry", (attempt) => {
  console.warn(`Retry attempt ${attempt}`);
});
```

---

## Development Tips

- Run `npm install` to install dependencies.
- Build the project with `npm run build`.
- Run tests with `npm test` to ensure everything is working as expected.

---

## Contributing

We welcome contributions to improve Distil! If you have ideas, bug fixes, or improvements, please open a pull request or submit an issue. Every contribution helps make Distil better for everyone.

---

## License

Distil is released under the [MIT License](LICENSE).


