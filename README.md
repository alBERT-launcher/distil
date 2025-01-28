# 🧪 Distil

> Because life's too short to version prompts manually.

## Zero Config, Just Drop It In 🎯

```typescript
// Before: Your regular OpenAI code
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After: Just change the import, everything else works the same
import { Distil } from 'distil';
const openai = new Distil({ apiKey: process.env.OPENAI_API_KEY });

// That's it! Use it exactly like before
const response = await openai.createChatCompletion({
  messages: [{ role: 'user', content: 'Write me a button' }]
});

// Behind the scenes, Distil is:
// - Versioning your prompts
// - Building fine-tuning datasets
// - Tracking costs and performance
// - Making you look smart
```

Are you tired of:
- 😫 Copy-pasting prompts across your codebase like it's 2022?
- 🤯 Trying to remember which version of "write me a button" worked best?
- 💸 Watching your OpenAI credits vanish into the void of prompt experimentation?
- 📊 Dealing with fine-tuning datasets that look like they were curated by a caffeinated squirrel?
- 🏷️ Spending hours labeling data when you could be "testing in production"?

## The Lazy Engineer's Solution

Distil is your AI prompt sommelier - it handles all the boring stuff while you take credit for the results. Just swap your OpenAI import with Distil, and it'll automatically:

- 🎯 Version your prompts (zero config required)
- 📝 Create fine-tuning datasets while you sleep
- 💰 Track your costs (so you can blame the intern)
- 🚀 Deploy fine-tuned models with zero effort
- 🏪 Monetize your models (yes, really)
- 🎨 Beautiful dashboard for data labeling and model management

## How It Works

### Zero Configuration Required 🎯

Distil works out of the box as a drop-in replacement for the OpenAI library. No configuration needed:

```typescript
// Your existing code stays exactly the same
const response = await openai.createChatCompletion({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Write me a button' }]
});

// But now you get:
console.log(response._pvMeta);
/*
{
  templateHash: 'abc123',  // Automatically detected template
  variables: {
    component: 'button'
  },
  usage: {
    tokens: 150,
    cost: 0.002,
    responseTime: '123ms'
  }
}
*/
```

All the magic happens automatically:
- Template detection ✨
- Variable extraction 🔍
- Usage tracking 📊
- Dataset building 📚

## Quick Start (for the impatient)

```typescript
import { Distil } from 'distil';

// Look ma, no config!
const ai = new Distil({ apiKey: process.env.OPENAI_API_KEY });

// Use it like regular OpenAI (but better)
const response = await ai.createChatCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Write me a button' }]
});

// Magic happens behind the scenes 🪄
```

## What Just Happened?

While you were busy checking Twitter, Distil:
1. Versioned your prompt
2. Tracked its performance
3. Started building a fine-tuning dataset
4. Calculated how much money you're ~~wasting~~ investing
5. Made you look professional

## The Magic Dashboard ✨

Visit the dashboard by running `streamlit run dashboard/app.py` to enter prompt engineering heaven:

### 🗃️ Dataset Management
- View all your prompts in one place (yes, even the embarrassing ones)
- Edit and rate responses with a beautiful UI
- Automatic dataset clustering and template extraction
- Export clean datasets for fine-tuning

### 🤖 Model Management
- Toggle between fine-tuned and base models with one click
- Create new fine-tuning jobs without leaving your chair
- A/B test different model versions
- Track performance metrics and costs

### 🏪 Model Marketplace
- Share your fine-tuned models with the world
- Set your own pricing (we won't judge)
- Subscribe to other models that actually work
- Track your passive income

### 📊 Analytics That Your Boss Will Love
- Usage trends and cost tracking
- Model performance comparisons
- Revenue analytics for your marketplace models
- Enough graphs to fill any presentation

## Template Evolution Example 🌱

Let's see how Distil learns from your prompts:

```typescript
// First few prompts
await ai.createChatCompletion({
  messages: [{ role: 'user', content: 'Create a login form in React with email and password' }]
});

await ai.createChatCompletion({
  messages: [{ role: 'user', content: 'Create a signup form in React with username and email' }]
});

await ai.createChatCompletion({
  messages: [{ role: 'user', content: 'Create a contact form in React with name and message' }]
});

// Distil discovers the template:
// "Create a {formType} form in React with {fields}"

// Now you can track:
// - Which form types are most requested
// - Common field combinations
// - Performance per form type
// - Cost per form type
```

### Fine-tuning Journey 🚀

Here's how a template evolves from prompts to a fine-tuned model:

1. **Data Collection**
   ```typescript
   // Your regular API calls
   await ai.createChatCompletion({
     messages: [{ role: 'user', content: 'Create a React button with hover animation' }]
   });
   
   // Behind the scenes, Distil:
   // 1. Identifies the template
   // 2. Stores the prompt-completion pair
   // 3. Tracks response quality metrics
   ```

2. **Dataset Curation**
   ```typescript
   // In the dashboard
   const dataset = await ai.getDataset('button-template');
   console.log(dataset.stats);
   /*
   {
     totalExamples: 150,
     avgRating: 4.2,
     commonVariables: {
       style: ['hover', 'click', 'focus'],
       framework: ['React', 'Vue', 'Svelte']
     },
     qualityMetrics: {
       consistency: 0.85,
       completeness: 0.92
     }
   }
   ```
   ```

3. **Fine-tuning Process**
   ```typescript
   // Automatic fine-tuning when criteria are met
   const model = await ai.createFineTune('button-template', {
     baseModel: 'gpt-3.5-turbo',
     // Optional parameters
     validationSplit: 0.2,
     epochs: 3,
     learningRate: 2e-5
   });

   // Track fine-tuning progress
   const status = await model.getStatus();
   /*
   {
     status: 'training',
     progress: 67,
     metrics: {
       trainLoss: 0.123,
       validLoss: 0.145
     }
   }
   ```
   ```

4. **Model Evaluation**
   ```typescript
   const evaluation = await model.evaluate();
   /*
   {
     accuracy: 0.92,
     consistency: 0.88,
     avgResponseTime: 150, // ms
     costPerToken: 0.00001,
     improvements: {
       speedup: '2.5x',
       tokenReduction: '40%',
       costSaving: '45%'
     }
   }
   ```
   ```

5. **Production Deployment**
   ```typescript
   // Set up routing rules
   await ai.setModelRouting({
     templateHash: 'button-template',
     modelId: model.id,
     isFineTuned: true,
     active: true,
     priority: 1,
     conditions: {
       // Use fine-tuned model for typical button requests
       maxTokens: 500,
       costThreshold: 0.02
     }
   });

   // Add fallback route
   await ai.setModelRouting({
     templateHash: 'button-template',
     modelId: 'gpt-4',
     isFineTuned: false,
     active: true,
     priority: 0  // Lower priority = fallback
   });
   ```

### Real-world Benefits 📈

Here's what you get with fine-tuned models:

```typescript
// Before fine-tuning
const before = await ai.createChatCompletion({
  messages: [{
    role: 'user',
    content: `
      Create a React button with these requirements:
      - Hover animation
      - Primary style
      - Loading state
      - Accessible
      - TypeScript props
      Please include comments and follow best practices.
    `
  }]
});
// Results in:
// - 250 tokens prompt
// - 800 tokens completion
// - 500ms response time
// - $0.02 cost

// After fine-tuning
const after = await ai.createChatCompletion({
  messages: [{
    role: 'user',
    content: 'React button: hover, primary, loading, a11y, TS'
  }]
});
// Results in:
// - 15 tokens prompt
// - 400 tokens completion
// - 150ms response time
// - $0.005 cost
// - Same or better quality output
```

## Configuration (if you must)

```typescript
const ai = new Distil({
  openaiConfig: {
    apiKey: process.env.OPENAI_API_KEY
  },
  storage: {
    type: 'supabase',  // for the fancy folks
    options: {
      // your credentials here
    }
  },
  // Set to false if your boss is watching
  autoFineTune: true,
  // For when you're feeling generous
  marketplace: {
    publish: true,
    price: 0.0001  // per token, we're not greedy
  }
});
```

## Storage Options

Store your data like a pro:

```typescript
// For the minimalists
storage: { type: 'json' }

// For the spreadsheet enthusiasts
storage: { type: 'csv' }

// For the enterprise architects
storage: { type: 'elasticsearch' }

// For the cool kids
storage: { type: 'supabase' }
```

## Dashboard Features

### Dataset Management
```typescript
// Rate responses (like social media, but for nerds)
await ai.rateResponse(responseId, {
  rating: 5,
  comment: "This button actually worked!"
});

// Edit responses when AI gets too creative
await ai.editResponse(responseId, {
  completion: "const Button = () => <button>Click me</button>"
});
```

### Model Control
```typescript
// Switch to your fine-tuned model
await ai.useVersion('button-master-5000');

// Switch back when things go wrong
await ai.useVersion('default');
```

### Marketplace Integration
```typescript
// Share your masterpiece
await ai.publishModel('button-master-5000', {
  price: 0.0001,
  description: "Buttons that actually work!",
  tags: ['react', 'buttons', 'actually-tested']
});
```

## Dashboard Setup

```bash
# In the dashboard directory
pip install -r requirements.txt

# Copy and edit environment variables
cp .env.example .env

# Launch the dashboard
streamlit run app.py

# Go get coffee while your data loads
```

## Why Distil?

- 🧠 It's smarter than your last intern
- 🚀 Faster than manual versioning
- 💰 Cheaper than therapy after losing your prompt history
- 🎩 Makes you look professional in meetings
- 🎨 Beautiful UI that doesn't hurt your eyes
- 📈 Enough analytics to justify your job

## Installation

```bash
npm install distil

# Then go get coffee while it handles everything
```

## Contributing

Found a bug? Keep it to yourself (just kidding):
1. Open an issue
2. Submit a PR
3. Wait for our AI to review it
4. Profit?

## License

MIT (because we're nice like that)

---

Made with ❤️ and ☕ by engineers who got tired of versioning prompts manually.

*P.S. If your prompts still aren't working, have you tried turning it off and on again?*
