/**
 * Charter and legal document templates.
 *
 * Each template provides a base structure that gets customized
 * with the community's specific parameters (name, founders,
 * bylaws, jurisdiction, etc.)
 *
 * Matches pitch deck slide 16: Charter style dropdown
 * - Draft Original
 * - Based on U.S. Constitution
 * - Based on Magna Carta
 * - Based on Blackfeet Tribal Constitution
 */

export interface CommunityParams {
  name: string;
  founders: string[];  // wallet addresses or names
  charterTemplate: string;

  // Bylaws
  admissionRule: 'founders-only' | 'founders-and-members';
  exileRule: 'founders-only' | 'founders-and-members';
  votePercentage: number;
  whoMayPropose: 'founders-only' | 'founders-or-members';

  // Legal nesting
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;

  // Banking
  bankingStyle: 'austrian' | 'keynesian';
  startingTokenAmount: number;
  allowFractionalLending: boolean;
  leverageRatio: number;
}

export const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  'draft-original':
    'A custom charter drafted from scratch based on your specific community parameters.',
  'us-constitution':
    'Modeled after the U.S. Constitution with separation of powers, bill of rights for members, and amendment process.',
  'magna-carta':
    'Inspired by the Magna Carta tradition emphasizing limits on authority, due process, and individual liberty.',
  'blackfeet-tribal':
    'Based on indigenous tribal governance emphasizing communal decision-making, elder councils, and stewardship.',
};

/**
 * Build the system prompt for Claude based on template choice.
 */
export function buildSystemPrompt(template: string): string {
  const base = `You are a legal document generator for the Aquarius community governance platform.
You generate legally-structured community charters, bylaws, and operating agreements.

Your output must be:
1. Written in clear legal language accessible to non-lawyers
2. Structured with numbered articles and sections
3. Internally consistent with all parameters provided
4. Appropriate for the specified jurisdiction
5. Include all standard protective clauses (dispute resolution, amendment process, dissolution)

IMPORTANT: Include a disclaimer that this is an AI-generated template and should be reviewed by a qualified attorney before legal reliance.`;

  const templateInstructions: Record<string, string> = {
    'draft-original': `
Generate a completely original community charter and bylaws document.
Structure it as a modern cooperative operating agreement.`,

    'us-constitution': `
Model this charter after the structure of the United States Constitution:
- Preamble stating the community's purpose
- Articles defining governance structure (legislative/executive/judicial equivalents)
- A Bill of Rights for community members
- Amendment procedures
- Supremacy clause establishing charter as highest community law
Use modern language but maintain the constitutional structure.`,

    'magna-carta': `
Model this charter after the principles of the Magna Carta:
- Emphasis on limiting the power of leadership/founders
- Explicit enumeration of member rights and protections
- Due process requirements before any member can be exiled or penalized
- Protection of member property (tokens, shares, institutional holdings)
- Right to fair trial by peers for disputes
- Regular accountability reviews of leadership`,

    'blackfeet-tribal': `
Model this charter after indigenous tribal governance principles:
- Council-based collective decision making
- Elder/founder advisory role (guidance not dictation)
- Emphasis on consensus over majority rule where practical
- Stewardship of community resources for future generations
- Seasonal or cyclical review of community health
- Restorative rather than punitive justice for conflicts
- Spiritual/cultural purpose clause for community identity`,
  };

  return base + (templateInstructions[template] || templateInstructions['draft-original']);
}

/**
 * Build the user prompt with specific community parameters.
 */
export function buildUserPrompt(params: CommunityParams): string {
  const founderList = params.founders.length > 0
    ? params.founders.map((f, i) => `  ${i + 1}. ${f}`).join('\n')
    : '  (To be specified)';

  return `Generate a complete community charter and bylaws document for the following community:

## Community Details
- **Name**: ${params.name}
- **Founders**:
${founderList}
- **Charter Style**: ${TEMPLATE_DESCRIPTIONS[params.charterTemplate] || 'Custom'}

## Governance Rules (Bylaws)
- **Member Admission**: ${params.admissionRule === 'founders-only' ? 'By vote of founders only' : 'By vote of founders and existing members'}
- **Member Exile**: ${params.exileRule === 'founders-only' ? 'By vote of founders only' : 'By vote of founders and members'}
- **Vote Threshold to Pass**: ${params.votePercentage}% majority required
- **Who May Propose Votes**: ${params.whoMayPropose === 'founders-only' ? 'Only founders' : 'Any member (founders or regular members)'}

## Legal Framework
- **Nested Within**: ${params.legalFramework || 'None specified'}
- **Jurisdiction**: ${params.jurisdiction || 'None specified'}
- **Member Types Allowed**: ${params.allowCorporateMembers ? 'Natural persons and corporations' : 'Natural persons only'}

## Economic Structure
- **Banking Style**: ${params.bankingStyle === 'austrian' ? 'Austrian (Strict) — fixed money supply, no fractional reserve' : 'Keynesian (Fractional Reserve) — flexible money supply'}
- **Starting Token Supply**: ${params.startingTokenAmount.toLocaleString()} tokens
- **Fractional Lending**: ${params.allowFractionalLending ? 'Allowed' : 'Not allowed'}
${params.allowFractionalLending ? `- **Leverage Ratio**: ${params.leverageRatio}:1` : ''}

## Required Sections
Please include ALL of the following sections in the document:

1. **Preamble** — Purpose and vision of the community
2. **Article I: Name and Formation** — Legal name, date of formation, blockchain record
3. **Article II: Membership** — Admission criteria, member rights, member responsibilities
4. **Article III: Governance Structure** — Decision-making process, voting procedures, quorum requirements
5. **Article IV: Founders** — Founder roles, special rights (if any), succession
6. **Article V: Economic System** — Community token, banking rules, token issuance
7. **Article VI: Institutions** — How community institutions are created, managed, dissolved
8. **Article VII: Positions and Roles** — How roles are created, filled, compensated
9. **Article VIII: Shares and Ownership** — Share classes, voting rights, transferability
10. **Article IX: Proposals and Voting** — How proposals are made, voted on, executed
11. **Article X: Dispute Resolution** — Arbitration process, exile procedures, appeals
12. **Article XI: Alliances** — How inter-community alliances are formed and dissolved
13. **Article XII: Amendments** — How this charter can be modified
14. **Article XIII: Dissolution** — What happens if the community dissolves
15. **Disclaimer** — AI-generated template notice

Format the output as clean Markdown.`;
}
