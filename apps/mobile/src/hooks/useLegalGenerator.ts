import { useState, useCallback } from 'react';
import { API_BASE } from '../config/api';
import { useWalletStore } from './useWalletStore';

/**
 * Hook for generating legal documents via the Aquarius API.
 *
 * Calls the backend which uses Claude to generate
 * charter + bylaws from community parameters.
 *
 * Requires a signed Aquarius wallet session (Bearer token).
 */

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
  const { session } = useWalletStore();
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
        if (!session?.token) {
          throw new Error('Sign in with your wallet before generating legal documents.');
        }

        const response = await fetch(`${API_BASE}/api/legal/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify(params),
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error(
            result.message || result.error || 'Sign in with your wallet before generating legal documents.'
          );
        }

        if (response.status === 429) {
          throw new Error(
            result.message || 'Too many generation requests. Wait a bit and try again.'
          );
        }

        if (!response.ok) {
          throw new Error(result.message || result.error || `HTTP ${response.status}`);
        }

        if (result.success) {
          setDocument(result.document);
          return result as LegalGenerationResult;
        }

        throw new Error(result.error || 'Generation failed');
      } catch (err: any) {
        setError(err.message || 'Unknown error');
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [session?.token]
  );

  return { generate, isGenerating, error, document };
}
