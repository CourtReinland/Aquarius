import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateLegalDocument,
  isLegalAiConfigured,
} from '../src/services/legal-generator.js';
import type { CommunityParams } from '../src/services/legal-templates.js';

const sampleParams: CommunityParams = {
  name: 'Cupcake DAO',
  founders: ['0x0000000000000000000000000000000000000001'],
  charterTemplate: 'draft-original',
  admissionRule: 'founders-only',
  exileRule: 'founders-only',
  votePercentage: 66,
  whoMayPropose: 'founders-or-members',
  legalFramework: '',
  jurisdiction: '',
  allowCorporateMembers: false,
  bankingStyle: 'austrian',
  startingTokenAmount: 1_000_000,
  allowFractionalLending: false,
  leverageRatio: 1,
};

describe('legal-generator provider selection', () => {
  const originalFetch = globalThis.fetch;
  const originalXai = process.env.XAI_API_KEY;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    if (originalXai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalXai;
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
  });

  it('reports configured when either provider key is set', () => {
    expect(isLegalAiConfigured()).toBe(false);
    process.env.XAI_API_KEY = 'xai-test';
    expect(isLegalAiConfigured()).toBe(true);
    delete process.env.XAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(isLegalAiConfigured()).toBe(true);
  });

  it('selects the Grok path when XAI_API_KEY is set', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    delete process.env.ANTHROPIC_API_KEY;

    const fetchMock = vi.fn(async () =>
      Response.json({
        model: 'grok-4',
        choices: [
          {
            message: {
              content:
                '# Preamble\nName and Formation\nMembership\nGovernance\nFounders\nEconomic\nInstitution\nPosition\nShare\nProposal\nDispute\nAlliance\nAmendment\nDissolution\nDisclaimer\n',
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 450 },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateLegalDocument(sampleParams);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.x.ai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer xai-test-key'
    );

    const body = JSON.parse(String(init.body)) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('grok-4');
    expect(body.max_tokens).toBe(8000);
    expect(body.messages.some((m) => m.role === 'system')).toBe(true);
    expect(body.messages.some((m) => m.role === 'user')).toBe(true);

    expect(result.model).toBe('grok-4');
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(450);
    expect(result.markdown).toContain('Preamble');
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('maps missing Grok usage fields to 0', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';

    globalThis.fetch = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: 'Charter body' } }],
      })
    ) as unknown as typeof fetch;

    const result = await generateLegalDocument(sampleParams);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.model).toBe('grok-4');
    expect(result.markdown).toBe('Charter body');
  });

  it('errors clearly when neither provider key is set', async () => {
    await expect(generateLegalDocument(sampleParams)).rejects.toThrow(
      'AI provider not configured'
    );
  });
});
