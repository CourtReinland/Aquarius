import { Hono } from 'hono';
import { z } from 'zod';
import {
  generateLegalDocument,
  validateDocument,
  generateCharterSummary,
  isLegalAiConfigured,
} from '../services/legal-generator.js';
import type { CommunityParams } from '../services/legal-templates.js';
import { getSessionFromAuthorization, type SessionRecord } from './auth.js';
import {
  legalGenerateAddressLimiter,
  legalGenerateIpLimiter,
  legalSummarizeAddressLimiter,
  legalSummarizeIpLimiter,
  rateLimitResponse,
} from '../lib/rate-limit.js';
import { clientIp } from '../lib/request.js';

export const legalRoutes = new Hono();

/** Bound summarize payloads so clients cannot ship unbounded bodies. */
const MAX_CHARTER_CHARS = 50_000;
const MAX_COMMUNITY_NAME_CHARS = 100;

// ─── Input Validation Schema ──────────────────────────────────────

const communityParamsSchema = z.object({
  name: z.string().min(1).max(100),
  founders: z.array(z.string()).min(1).max(50),
  charterTemplate: z.enum([
    'draft-original',
    'us-constitution',
    'magna-carta',
    'blackfeet-tribal',
  ]),
  admissionRule: z.enum(['founders-only', 'founders-and-members']),
  exileRule: z.enum(['founders-only', 'founders-and-members']),
  votePercentage: z.number().min(51).max(100),
  whoMayPropose: z.enum(['founders-only', 'founders-or-members']),
  legalFramework: z.string().default(''),
  jurisdiction: z.string().default(''),
  allowCorporateMembers: z.boolean().default(false),
  bankingStyle: z.enum(['austrian', 'keynesian']).default('austrian'),
  startingTokenAmount: z.number().min(1).default(1000000),
  allowFractionalLending: z.boolean().default(false),
  leverageRatio: z.number().min(1).max(9).default(1),
});

const summarizeSchema = z.object({
  charter: z.string().min(1).max(MAX_CHARTER_CHARS),
  communityName: z.string().min(1).max(MAX_COMMUNITY_NAME_CHARS),
});

type SessionGate =
  | { ok: true; session: SessionRecord }
  | { ok: false; response: Response };

function requireSession(c: {
  req: { header: (name: string) => string | undefined };
  json: (body: unknown, status?: number) => Response;
}): SessionGate {
  const session = getSessionFromAuthorization(c.req.header('authorization'));
  if (!session) {
    return {
      ok: false,
      response: c.json(
        {
          error: 'Wallet session required',
          message: 'Sign in with your wallet before using AI legal generation.',
        },
        401
      ),
    };
  }
  return { ok: true, session };
}

// ─── Routes ───────────────────────────────────────────────────────

/**
 * POST /api/legal/generate
 * Generate a complete charter + bylaws from community parameters.
 * Requires a valid Aquarius wallet session. Rate-limited (strict).
 */
legalRoutes.post('/generate', async (c) => {
  try {
    const auth = requireSession(c);
    if (!auth.ok) return auth.response;

    const ip = clientIp(c);
    const addressKey = auth.session.address.toLowerCase();

    const ipLimit = legalGenerateIpLimiter.check(`legal-generate:ip:${ip}`);
    if (!ipLimit.allowed) {
      return rateLimitResponse(
        c,
        ipLimit.retryAfterSeconds,
        'Legal generation rate limit exceeded. Wait before retrying.'
      );
    }

    const addressLimit = legalGenerateAddressLimiter.check(
      `legal-generate:addr:${addressKey}`
    );
    if (!addressLimit.allowed) {
      return rateLimitResponse(
        c,
        addressLimit.retryAfterSeconds,
        'Legal generation rate limit exceeded. Wait before retrying.'
      );
    }

    const body = await c.req.json();
    const params = communityParamsSchema.parse(body) as CommunityParams;

    if (!isLegalAiConfigured()) {
      return c.json(
        {
          error: 'AI provider not configured',
          message: 'No AI provider is configured on this server.',
        },
        503
      );
    }

    const result = await generateLegalDocument(params);

    // Validate completeness
    const validation = validateDocument(result.markdown);

    return c.json({
      success: true,
      document: result.markdown,
      metadata: {
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        generationTimeMs: result.generationTimeMs,
        communityName: params.name,
        template: params.charterTemplate,
        jurisdiction: params.jurisdiction,
      },
      validation: {
        complete: validation.valid,
        missingSections: validation.missingSections,
      },
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json(
        { error: 'Invalid parameters', details: error.issues },
        400
      );
    }
    console.error('[legal/generate] failed:', error?.message ?? error);
    return c.json(
      {
        error: 'Generation failed',
        message: 'Unable to generate legal document. Try again later.',
      },
      500
    );
  }
});

/**
 * POST /api/legal/summarize
 * Generate a brief summary of an existing charter.
 * Requires a valid Aquarius wallet session. Rate-limited.
 */
legalRoutes.post('/summarize', async (c) => {
  try {
    const auth = requireSession(c);
    if (!auth.ok) return auth.response;

    const ip = clientIp(c);
    const addressKey = auth.session.address.toLowerCase();

    const ipLimit = legalSummarizeIpLimiter.check(`legal-summarize:ip:${ip}`);
    if (!ipLimit.allowed) {
      return rateLimitResponse(
        c,
        ipLimit.retryAfterSeconds,
        'Legal summarize rate limit exceeded. Wait before retrying.'
      );
    }

    const addressLimit = legalSummarizeAddressLimiter.check(
      `legal-summarize:addr:${addressKey}`
    );
    if (!addressLimit.allowed) {
      return rateLimitResponse(
        c,
        addressLimit.retryAfterSeconds,
        'Legal summarize rate limit exceeded. Wait before retrying.'
      );
    }

    const { charter, communityName } = summarizeSchema.parse(await c.req.json());

    if (!isLegalAiConfigured()) {
      return c.json(
        {
          error: 'AI provider not configured',
          message: 'No AI provider is configured on this server.',
        },
        503
      );
    }

    const summary = await generateCharterSummary(charter, communityName);
    return c.json({ success: true, summary });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return c.json(
        { error: 'Invalid parameters', details: error.issues },
        400
      );
    }
    console.error('[legal/summarize] failed:', error?.message ?? error);
    return c.json(
      {
        error: 'Summarization failed',
        message: 'Unable to summarize charter. Try again later.',
      },
      500
    );
  }
});

/**
 * GET /api/legal/templates
 * List available charter templates (static; public).
 */
legalRoutes.get('/templates', (c) => {
  return c.json({
    templates: [
      {
        id: 'draft-original',
        name: 'Draft Original',
        description: 'Custom charter drafted from your parameters',
      },
      {
        id: 'us-constitution',
        name: 'Based on U.S. Constitution',
        description: 'Separation of powers, bill of rights, amendment process',
      },
      {
        id: 'magna-carta',
        name: 'Based on Magna Carta',
        description: 'Limits on authority, due process, individual liberty',
      },
      {
        id: 'blackfeet-tribal',
        name: 'Based on Blackfeet Tribal Constitution',
        description: 'Communal decisions, elder councils, stewardship',
      },
    ],
  });
});
