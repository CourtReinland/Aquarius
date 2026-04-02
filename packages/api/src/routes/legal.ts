import { Hono } from 'hono';
import { z } from 'zod';
import {
  generateLegalDocument,
  validateDocument,
  generateCharterSummary,
} from '../services/legal-generator.js';
import type { CommunityParams } from '../services/legal-templates.js';

export const legalRoutes = new Hono();

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

// ─── Routes ───────────────────────────────────────────────────────

/**
 * POST /api/legal/generate
 * Generate a complete charter + bylaws from community parameters.
 */
legalRoutes.post('/generate', async (c) => {
  try {
    const body = await c.req.json();
    const params = communityParamsSchema.parse(body) as CommunityParams;

    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json(
        {
          error: 'ANTHROPIC_API_KEY not configured',
          hint: 'Set ANTHROPIC_API_KEY environment variable',
        },
        500
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
    return c.json(
      {
        error: 'Generation failed',
        message: error?.message?.substring(0, 200),
      },
      500
    );
  }
});

/**
 * POST /api/legal/summarize
 * Generate a brief summary of an existing charter.
 */
legalRoutes.post('/summarize', async (c) => {
  try {
    const { charter, communityName } = await c.req.json();

    if (!charter || !communityName) {
      return c.json({ error: 'charter and communityName required' }, 400);
    }

    const summary = await generateCharterSummary(charter, communityName);
    return c.json({ success: true, summary });
  } catch (error: any) {
    return c.json({ error: error?.message }, 500);
  }
});

/**
 * GET /api/legal/templates
 * List available charter templates.
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
