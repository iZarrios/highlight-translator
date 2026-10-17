import { z } from 'zod';

export type ExplanationRequest = {
  text: string;
  nearbyContext?: string;
};

export const explanationResultSchema = z
  .object({
    translation: z.string().min(1),
    explanation: z.string().min(1),
  })
  .strict();

export type ExplanationResult = z.infer<typeof explanationResultSchema>;
export type ExplanationField = keyof ExplanationResult;
export type ExplanationChunk = {
  field: ExplanationField;
  text: string;
};

export interface ExplanationClient {
  explain(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): Promise<ExplanationResult>;
  streamExplanation(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationChunk>;
}
