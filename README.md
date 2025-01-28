# 🧪 Distil

> Because life's too short to version prompts manually.

Are you tired of:
- 😫 Copy-pasting prompts across your codebase like it's 2022?
- 🤯 Trying to remember which version of "write me a button" worked best?
- 💸 Watching your OpenAI credits vanish into the void of prompt experimentation?
- 📊 Dealing with fine-tuning datasets that look like they were curated by a caffeinated squirrel?

## The Lazy Engineer's Solution

Distil is your AI prompt sommelier - it handles all the boring stuff while you take credit for the results. Drop it into your existing OpenAI code, and it'll automatically:

- 🎯 Version your prompts (even the ones you forgot about)
- 📝 Create fine-tuning datasets while you sleep
- 💰 Track your costs (so you can blame the intern)
- 🚀 Deploy fine-tuned models with zero effort
- 🏪 Monetize your models (yes, really)

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

Visit `https://distil.ai/dashboard` to:

- 👀 View all your prompt versions (even the embarrassing ones)
- ✏️ Edit and rate responses
- 🎓 Fine-tune models with one click
- 🔄 Toggle between fine-tuned and base models
- 💎 Share and monetize your fine-tuned models

## Model Marketplace 🏪

Turn your prompts into profit:

```typescript
// Someone else's code
const ai = new Distil();
await ai.useModel('button-master-5000', {
  apiKey: 'your-wallet-is-now-lighter'
});
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

## Why Distil?

- 🧠 It's smarter than your last intern
- 🚀 Faster than manual versioning
- 💰 Cheaper than therapy after losing your prompt history
- 🎩 Makes you look professional in meetings

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
