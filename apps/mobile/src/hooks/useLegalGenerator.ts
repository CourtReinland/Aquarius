import { useState, useCallback } from 'react';

/**
 * Hook for generating legal documents via the Aquarius API.
 *
 * Calls the backend which uses Claude to generate
 * charter + bylaws from community parameters.
 */

const API_BASE = __DEV__
  ? 'http://localhost:3001'
  : 'https://api.aquariusapp.eth'; // Production URL TBD

interface LegalGenerationParams {
  name: string;
  founders: string[];
  charterTemplate: string;
  admissionRule: string;
  exileRule: string;
  votePercentage: number;
  whoMayPropose: string;
  legalFramework: string;
  jurisdiction: string;
  allowCorporateMembers: boolean;
  bankingStyle: string;
  startingTokenAmount: number;
  allowFractionalLending: boolean;
  leverageRatio: number;
}

interface LegalGenerationResult {
  document: string;
  metadata: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    generationTimeMs: number;
    communityName: string;
    template: string;
    jurisdiction: string;
  };
  validation: {
    complete: boolean;
    missingSections: string[];
  };
}

interface UseLegalGeneratorReturn {
  generate: (params: LegalGenerationParams) => Promise<LegalGenerationResult | null>;
  isGenerating: boolean;
  error: string | null;
  document: string | null;
}

export function useLegalGenerator(): UseLegalGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<string | null>(null);

  const generate = useCallback(
    async (
      params: LegalGenerationParams
    ): Promise<LegalGenerationResult | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/legal/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setDocument(result.document);
          return result as LegalGenerationResult;
        } else {
          throw new Error(result.error || 'Generation failed');
        }
      } catch (err: any) {
        setError(err.message || 'Unknown error');
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return { generate, isGenerating, error, document };
}
