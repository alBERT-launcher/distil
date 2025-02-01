# Distil 🧪

Distil is a production-grade TypeScript framework for building, monitoring, and improving LLM pipelines. It provides end-to-end tracing of prompt-completion pairs, integrated curation tools, and automated fine-tuning workflows.

### Current Features
- 🚀 **Robust Pipelines**: Custom pre/post processing, retry logic, and error handling
- 📊 **Full Traceability**: Monitor costs, performance, and success rates with Elasticsearch integration
- 🔄 **Version Control**: Hash-based tracking of prompts and parameters to identify what works best
- ⭐️ **Curation Tools**: Rate outputs, tag examples, and export for fine-tuning
- 📈 **Built-in Dashboard**: View pipeline performance, costs, and version history

### Coming Soon 🔥
- 🤖 **Synthetic Data Generation**: Automatically create high-quality training data using your best examples
- 🎯 **Fine-tuning Integration**: Seamlessly replace prompt-engineered models with fine-tuned versions
- 🔍 **Advanced Analytics**: Deep insights into prompt performance and cost optimization
- 🔐 **Enterprise Features**: Role-based access, audit logs, and persistent storage
- 🌐 **Multi-Model Support**: Use any LLM provider with our unified interface

Perfect for teams who need to:
- Build production-ready LLM features
- Track costs and performance at scale
- Continuously improve output quality
- Create proprietary fine-tuned models

## Cool Features

- **Easy Pipeline Setup:**
  Define your own pipelines with system prompts, user prompts, and parameters. Each run gets a unique fingerprint so you can always track what's what.

- **Custom Pre and Post Processing:**
  Tweak your inputs before sending them off or smooth out the outputs however you like. It’s flexible enough to let you add your own magic.

- **Logging & Tracking:**
  Every pipeline run is logged with details like cost and runtime, so you can keep an eye on performance without breaking a sweat.

- **Built-in Dashboard:**
  Curious about what’s running? The dashboard gives you a simple web interface to view run history, track versions, and check metrics.

- **Elasticsearch Integration:**
  Store your pipeline versions and logs in Elasticsearch for easy searching and analysis.

## Getting Started

### Installation

Just add Distil to your project with npm:

```bash
npm install @lewist9x/distil
```

### Setup

Create a `.env` file in your project root and fill it in like this:

```env
# Elasticsearch config
ELASTICHOST=http://localhost:9200
ELASTICUSER=elastic
ELASTICPW=changeme

# LLM API config
OPENROUTER_APIKEY=your_api_key_here
OPENLLM_BASE_URL=https://openrouter.ai/api/v1

# Dashboard settings
DASHBOARD_PORT=3000
RUN_DASHBOARD=true

# Retry Configuration (optional)
RETRY_ATTEMPTS=3    # Number of retries (default: 3)
RETRY_DELAY=1000   # Delay between retries in ms (default: 1000)

# Elasticsearch Indices (optional)
ES_DATA_INDEX=distil_data  # Store pipeline versions (default: distil_data)
ES_LOG_INDEX=distil_logs   # Store execution logs (default: distil_logs)
```

## Quick Example

Here's a complete RAG example for ShadCN component generation:

```typescript
import { DistilPipeline } from "@lewist9x/distil";

// Define custom preprocessing to inject ShadCN component examples
const preprocess = (input) => {
  console.log("Injecting ShadCN component examples...");
  // Add example components if not provided
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
    }
  }
  return input;
};

// Extract the component code from the TSX code block
const postprocess = (output: string) => {
  console.log("Extracting component code from output...");
  // Remove TSX language specifier and get the code inside the block
  const cleaned = output.replaceAll("```tsx", "```");
  const parts = cleaned.split("```");
  // Return the code inside the code block, or the original if no code block found
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

## Rating & Fine-tuning

Want to level up your components? Distil lets you rate and collect high-quality examples for fine-tuning:

```typescript
// Rate a generated component (1-5 stars)
await pipeline.rateGeneration(result.metadata.templateHash, 5, "Perfect component!");

// Mark it for fine-tuning
await pipeline.markForFinetuning(result.metadata.templateHash);

// Export your best examples
const examples = await pipeline.exportFinetuningData({
  minRating: 4,  // Only export highly-rated generations
  format: "jsonl" // Format suitable for fine-tuning
});

console.log("High quality examples:", examples);
```

The dashboard makes this even easier! Head to `http://localhost:3000/dashboard` to:
- 👀 Browse all your generated components
- ⭐️ Rate them from 1-5 stars
- 🏷️ Add tags like "production-ready" or "needs-work"
- 📊 Track which versions perform best
- 🚀 Export your top-rated examples for fine-tuning

Over time, you'll build up a collection of awesome components that you can use to fine-tune your own model. Each example includes:
- The preprocessed input (with injected ShadCN examples)
- The clean, postprocessed output (just the component code)
- Metadata like ratings, tags, and performance stats

This creates a feedback loop where your generations get better and better!

## Advanced Features

### Logging Levels

Control how chatty Distil is with different logging levels:

```typescript
const pipeline = new DistilPipeline(config, "DEBUG"); // Super chatty
const pipeline = new DistilPipeline(config, "INFO");  // Just the important stuff
const pipeline = new DistilPipeline(config, "WARNING"); // Only warnings
const pipeline = new DistilPipeline(config, "ERROR"); // Just errors
```

### Retry Logic

Distil automatically retries failed API calls. Configure it in your `.env`:

```env
# Retry Configuration (optional)
RETRY_ATTEMPTS=3    # Number of retries (default: 3)
RETRY_DELAY=1000   # Delay between retries in ms (default: 1000)
```

### Pre/Post Processing

Customize how your inputs are processed before they go to the model, and how outputs are cleaned up:

```typescript
const pipeline = new DistilPipeline({
  pipelineName: "shadcn-component-generator",
  // ... other config
  preprocess: async (input: LLMInput) => {
    // Add example components to system prompt
    input.systemPrompt += "\nHere are some example components:\n" + await getExamples();
    return input;
  },
  postprocess: (output: string) => {
    // Extract just the TSX code
    const tsxMatch = output.match(/```tsx\n([\s\S]*?)```/);
    return tsxMatch ? tsxMatch[1].trim() : output;
  }
});
```

### Model Parameters

Fine-tune your model's behavior:

```typescript
const result = await pipeline.generate({
  parameters: {
    // Component-specific parameters
    componentType: "card",
    style: "modern",
    
    // Model parameters
    temperature: 0.7,     // Lower = more focused
    max_tokens: 2000,     // Longer outputs
    top_p: 0.9,          // Nucleus sampling
    presence_penalty: 0.5 // Encourage novelty
  }
});
```

### Template Versioning

Each unique combination of prompts and parameters gets a hash:

```typescript
// These will have the same hash (parameter order doesn't matter)
const result1 = await pipeline.generate({
  parameters: { type: "card", style: "modern" }
});

const result2 = await pipeline.generate({
  parameters: { style: "modern", type: "card" }
});

// Different parameters = different hash
const result3 = await pipeline.generate({
  parameters: { type: "button", style: "modern" }
});

// Get all versions using this template
const versions = await pipeline.getVersionsByHash(result1.metadata.templateHash);

// Compare performance
console.log(
  "Template Stats:",
  await pipeline.getTemplateStats(result1.metadata.templateHash)
);
```

This helps you:
- Track which prompt versions perform best
- Group similar generations together
- Compare different parameter combinations
- Export high-quality examples for fine-tuning

### Cost Tracking

Keep an eye on your spending:

```typescript
// Set cost per token (default is 4.5/10M tokens)
process.env.COST_PER_TOKEN = "0.000001";

// Track costs in your generations
const result = await pipeline.generate({...});
console.log("Generation cost: $", result.metadata.generationCost);

// Get total costs for a version
const stats = await pipeline.getVersionStats(result.metadata.templateHash);
console.log("Total cost: $", stats.totalCost);
```

### Elasticsearch Integration

All pipeline runs are logged to Elasticsearch for analysis. Configure your indices:

```env
# Elasticsearch Indices (optional)
ES_LOG_INDEX=distil_logs   # Store execution logs (default: distil_logs)
```

Query your logs programmatically:

```typescript
// Get all logs for a specific version
const logs = await pipeline.getVersionLogs(result.metadata.templateHash);

// Search for specific patterns in outputs
const cardExamples = await pipeline.searchVersions({
  tag: "product-card",
  minRating: 4
});
```

## Error Handling

Distil includes built-in error handling and retries. Here's how to handle common scenarios:

```typescript
try {
  const result = await pipeline.generate({
    parameters: {
      componentType: "product card"
    }
  });
  
  if (!result) {
    console.error("Generation failed - no result returned");
    return;
  }
  
  console.log("Success!", result.processedOutput);
} catch (error) {
  if (error.message.includes("Invalid input")) {
    // Handle validation errors (missing required fields)
    console.error("Invalid pipeline input:", error.message);
  } else if (error.message.includes("API")) {
    // Handle API errors (rate limits, auth issues)
    console.error("API error:", error.message);
  } else {
    // Handle other errors
    console.error("Unexpected error:", error);
  }
}

// Check retry counts
const stats = await pipeline.getVersionStats(result.metadata.templateHash);
if (stats.retryCount > 0) {
  console.warn(`Required ${stats.retryCount} retries to succeed`);
}

// Set up error callbacks
pipeline.on("error", (error) => {
  // Handle any pipeline errors
  console.error("Pipeline error:", error);
});

pipeline.on("retry", (attempt) => {
  // Handle retry attempts
  console.warn(`Retry attempt ${attempt}`);
});
```

Common error scenarios:
- Invalid input (missing required fields)
- API errors (rate limits, authentication)
- Network issues (handled by retry logic)
- Preprocessing/postprocessing errors
- Invalid parameter substitution

The dashboard also shows error rates and retry counts for each pipeline version.

## Dashboard

Want to see your pipelines in action? Start the dashboard like this:

```bash
export RUN_DASHBOARD=true
npm start
```

Then open your browser and head to `http://localhost:3000/dashboard` to check out all the cool metrics and history.

## Development Tips

- Run `npm install` to grab all the dependencies.
- Build the project with `npm run build`.
- Keep things in check with `npm test`.

## Contributing

We’re all about making Distil even better. If you have ideas, bug fixes, or improvements, feel free to open a pull request or drop an issue. Every bit helps!

## License

Distil is released under the MIT License – see the LICENSE file for the details.
