import type { Request, Response } from 'express';
import { createResponseStream } from '../client/litellm.js';
import type { AiRequest } from '../client/litellm.js';

export async function chatController(
  req: Request,
  res: Response,
): Promise<void> {
  const controller = new AbortController();

  res.on('close', () => {
    controller.abort();
  });

  req.on('aborted', () => {
    controller.abort();
  });

  try {
    const request = req.body as AiRequest;

    const response = await createResponseStream(request, controller.signal);

    res
      .status(200)
      .set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      .flushHeaders();

    for await (const chunk of response.body!) {
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
