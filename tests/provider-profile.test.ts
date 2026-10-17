import { describe, expect, it } from 'vitest';
import {
  classifyEndpoint,
  createProviderProfile,
  resolveOpenAIUrl,
} from '@/providers/provider-profile';

describe('provider profiles', () => {
  it('accepts an arbitrary local OpenAI-compatible base URL', () => {
    const profile = createProviderProfile({
      name: 'My Ollama',
      baseUrl: 'http://127.0.0.1:11434/v1/',
      model: 'qwen3:8b',
    });

    expect(profile.baseUrl).toBe('http://127.0.0.1:11434/v1');
    expect(profile.originPermission).toBe('http://127.0.0.1:11434/*');
    expect(resolveOpenAIUrl(profile.baseUrl, 'chat/completions')).toBe(
      'http://127.0.0.1:11434/v1/chat/completions',
    );
  });

  it('does not duplicate a full chat completions endpoint', () => {
    expect(
      resolveOpenAIUrl(
        'https://example.test/custom/v1/chat/completions',
        'chat/completions',
      ),
    ).toBe('https://example.test/custom/v1/chat/completions');
    expect(
      resolveOpenAIUrl(
        'https://example.test/custom/v1/chat/completions',
        'models',
      ),
    ).toBe('https://example.test/custom/v1/models');
  });

  it('rejects credentials embedded in an endpoint URL', () => {
    expect(() =>
      createProviderProfile({
        name: 'Unsafe',
        baseUrl: 'https://token@example.test/v1',
        model: 'model',
      }),
    ).toThrow(/credentials/i);
  });

  it('distinguishes this device, local network, and remote endpoints', () => {
    expect(classifyEndpoint('http://localhost:11434/v1')).toBe('device');
    expect(classifyEndpoint('http://192.168.1.20:8080/v1')).toBe('network');
    expect(classifyEndpoint('http://biluka:10000/v1')).toBe('network');
    expect(classifyEndpoint('https://api.example.test/v1')).toBe('remote');
  });
});
