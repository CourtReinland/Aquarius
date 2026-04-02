import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  buildUserPrompt,
  type CommunityParams,
} from './legal-templates.js';

/**
 * Legal Document Generator using Claude API.
 *
 * Takes community parameters from the FoundCommunity wizard
 * and generates a complete charter + bylaws document.
 *
 * Architecture:
 * 1. Template system builds structured prompts from params
 * 2. Claude generates the legal document
 * 3. Response is validated for required sections
 * 4. Markdown output returned for display + IPFS storage
 */

interface GenerationResult {
  markdown: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  generationTimeMs: number;
}

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/**
 * Generate a complete legal charter and bylaws document.
 */
export async function generateLegalDocument(
  params: CommunityParams
): Promise<GenerationResult> {
  const client = getClient();
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(params.charterTemplate);
  const userPrompt = buildUserPrompt(params);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const markdown =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    markdown,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    generationTimeMs: Date.now() - startTime,
  };
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
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Summarize the following community charter for "${communityName}" in 3-4 sentences, highlighting the governance style, economic model, and key member rights:\n\n${charterMarkdown.substring(0, 4000)}`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
