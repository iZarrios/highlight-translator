export type ExplanationRequest = {
  text: string;
  nearbyContext?: string;
};

export interface ExplanationClient {
  explain(request: ExplanationRequest, signal?: AbortSignal): Promise<string>;
  streamExplanation(
    request: ExplanationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<string>;
}
