import { DistilAI } from './index';
import * as fs from 'fs';
import { jest } from '@jest/globals';

describe('Basic test suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('DistilAI', () => {
  let distil: DistilAI;

  beforeAll(async () => {
    distil = new DistilAI({
      apiKey: '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', // empty so dont bother trying to steal it
      baseURL: 'https://openrouter.ai/api/v1',
      storage: {
        type: 'csv',
        options: { directory: './test-logs' }
      }
    });
    await distil.storage.initialize();
  });

  afterAll(async () => {
    await fs.promises.rm('./test-logs', { 
      recursive: true, 
      force: true 
    });
  });

  describe('Basic functionality', () => {
    it('should act as OpenAI client replacement', async () => {
      const response = await distil.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello world' }]
      });
      
      expect(response.choices[0].message.content).toBeTruthy();
    }, 10000);
  });

  describe('Template detection', () => {
    it('should identify similar prompts as same template', async () => {
      const prompts = [
        'Create a login form with email and password',
        'Create a signup form with username and email',
        'Create a contact form with name and message'
      ];

      const hashes = await Promise.all(
        prompts.map(prompt => 
          distil.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }]
          }).then(res => {
            console.log ({ res })
            return res._pvMeta!.templateHash})
        )
      );

      // All hashes should be the same
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    }, 60000);
  });

  describe('Usage tracking', () => {
    it('should log prompt metadata', async () => {
      const response = await distil.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Translate "hello" to French' }]
      });

      expect(response._pvMeta).toMatchObject({
        templateHash: expect.any(String),
        variables: expect.any(Object),
        usage: {
          totalTokens: expect.any(Number),
          totalCost: expect.any(Number),
          durationMs: expect.any(Number),
          averageTokensPerSecond: expect.any(Number)
        }
      });
    }, 60000);
  });
});
