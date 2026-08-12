import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  buildUserPrompt,
  type CommunityParams,
} from './legal-templates.js';

/**
 * Legal Document Generator.
 *
 * Provider selection (aligned with Blue):
 *   1. Grok (xAI)  — when XAI_API_KEY is set (OpenAI-compatible Chat Completions)
 *   2. Claude      — Anthropic fallback when Grok is unset, or when Grok fails
 *                    and ANTHROPIC_API_KEY is set
 *   3. Error       — if neither key is configured
 *
 * Default Grok model is `grok-4` (long-form capable; 8k max output for charters).
 * Override with LEGAL_GROK_MODEL or AQUARIUS_GROK_MODEL. Blue uses a faster
 * model for short chat; do not point legal generation at the tiny fast model.
 */

export interface GenerationResult {
  markdown: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  generationTimeMs: number;
}

const GROK_URL = 'https://api.x.ai/v1/chat/completions';
const LEGAL_GROK_MODEL =
  process.env.LEGAL_GROK_MODEL ||
  process.env.AQUARIUS_GROK_MODEL ||
  'grok-4';
const LEGAL_CLAUDE_MODEL =
  process.env.LEGAL_CLAUDE_MODEL || 'claude-sonnet-4-20250514';

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/** True when at least one AI provider key is configured. */
export function isLegalAiConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

interface GrokChatCompletion {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

async function callGrok(options: {
  system?: string;
  user: string;
  maxTokens: number;
}): Promise<GenerationResult> {
  const startTime = Date.now();
  const messages: Array<{ role: string; content: string }> = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }
  messages.push({ role: 'user', content: options.user });

  const res = await fetch(GROK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: LEGAL_GROK_MODEL,
      max_tokens: options.maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    // Do not surface provider body (may include sensitive details).
    throw new Error(`grok ${res.status}`);
  }

  const data = (await res.json()) as GrokChatCompletion;
  const markdown = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!markdown) throw new Error('grok returned empty reply');

  return {
    markdown,
    model: data.model || LEGAL_GROK_MODEL,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    generationTimeMs: Date.now() - startTime,
  };
}

async function callClaude(options: {
  system?: string;
  user: string;
  maxTokens: number;
}): Promise<GenerationResult> {
  const startTime = Date.now();
  const response = await getAnthropic().messages.create({
    model: LEGAL_CLAUDE_MODEL,
    max_tokens: options.maxTokens,
    ...(options.system ? { system: options.system } : {}),
    messages: [{ role: 'user', content: options.user }],
  });

  const markdown =
    response.content[0]?.type === 'text' ? response.content[0].text : '';

  return {
    markdown,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    generationTimeMs: Date.now() - startTime,
  };
}

/**
 * Call Grok when configured; fall back to Anthropic on miss/failure.
 * Throws if no provider can serve the request.
 */
async function completeWithPreferredProvider(options: {
  system?: string;
  user: string;
  maxTokens: number;
}): Promise<GenerationResult> {
  if (process.env.XAI_API_KEY) {
    try {
      return await callGrok(options);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[legal] grok failed, trying claude:', message);
      if (!process.env.ANTHROPIC_API_KEY) {
        throw e instanceof Error ? e : new Error(message);
      }
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return callClaude(options);
  }

  throw new Error('AI provider not configured');
}

/**
 * Generate a complete legal charter and bylaws document.
 */
export async function generateLegalDocument(
  params: CommunityParams
): Promise<GenerationResult> {
  const systemPrompt = buildSystemPrompt(params.charterTemplate);
  const userPrompt = buildUserPrompt(params);

  return completeWithPreferredProvider({
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 8000,
  });
}

/**
 * Validate that a generated document contains all required sections.
 */
export function validateDocument(markdown: string): {
  valid: boolean;
  missingSections: string[];
} {
  const requiredSections = [
    'Preamble',
    'Name and Formation',
    'Membership',
    'Governance',
    'Founders',
    'Economic',
    'Institution',
    'Position',
    'Share',
    'Proposal',
    'Dispute',
    'Alliance',
    'Amendment',
    'Dissolution',
    'Disclaimer',
  ];

  const lowerMarkdown = markdown.toLowerCase();
  const missing = requiredSections.filter(
    (section) => !lowerMarkdown.includes(section.toLowerCase())
  );

  return {
    valid: missing.length === 0,
    missingSections: missing,
  };
}

/**
 * Generate a brief summary/abstract of a charter document.
 */
export async function generateCharterSummary(
  charterMarkdown: string,
  communityName: string
): Promise<string> {
  const result = await completeWithPreferredProvider({
    user: `Summarize the following community charter for "${communityName}" in 3-4 sentences, highlighting the governance style, economic model, and key member rights:\n\n${charterMarkdown.substring(0, 4000)}`,
    maxTokens: 500,
  });
  return result.markdown;
}
