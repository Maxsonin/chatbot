import { env } from '../config/env.js';
import type { ModelId } from '../config/models.js';
import { findModelById } from '../services/model.service.js';

export type AiInput = {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
};

export type AiRequest = {
  model: ModelId;
  input: AiInput[];
  think: boolean;
};

export async function createResponseStream(
  request: AiRequest,
  signal: AbortSignal,
): Promise<Response> {
  const model = findModelById(request.model);

  if (!model) {
    throw new Error(`Unknown model: ${request.model}`);
  }

  if (request.think && !model.thinking.supported) {
    throw new Error(`Model "${model.id}" does not support thinking`);
  }

  const response = await fetch(`${env.liteLlmUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: request.model,
      input: request.input,
      stream: true,

      ...(request.think && {
        reasoning: {
          effort: 'medium',
        },
      }),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const error = await response.text();

    console.error('LiteLLM error:', {
      status: response.status,
      statusText: response.statusText,
      body: error,
    });

    throw new Error('LiteLLM error: ' + error);
  }

  return response;
}
