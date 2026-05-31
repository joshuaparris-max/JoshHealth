import { getProvider } from './aiProviders.js';
import { buildSystemPrompt } from './promptBuilder.js';

/**
 * Streams AI responses from the selected provider.
 */
async function streamResponse({ providerId, model, apiKey, systemPrompt, messages, onChunk, onComplete, onError }) {
  const provider = getProvider(providerId);
  
  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.headers(apiKey),
      body: JSON.stringify(provider.body(model, systemPrompt, messages, true)),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`${provider.name} error: ${message}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        
        try {
          const json = JSON.parse(trimmed.slice(6));
          const chunk = provider.parseChunk(json);
          if (chunk) {
            fullText += chunk;
            onChunk(fullText);
          }
        } catch (e) {
          // Ignore parse errors for malformed chunks
        }
      }
    }

    onComplete(fullText);
  } catch (err) {
    onError(err.message);
  }
}

/**
 * Verifies the API key with a small request.
 */
export async function checkHealth({ providerId, model, apiKey }) {
  const provider = getProvider(providerId);
  const system = "Health check. Respond with 'OK'.";
  const messages = [{ role: 'user', content: 'Ready?' }];

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.headers(apiKey),
      body: JSON.stringify(provider.body(model, system, messages, false)),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
      return { ok: false, message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Runs the initial analysis on a DataPack.
 */
export async function runAnalysis({ apiKey, providerId, model, dataPack, selectedModes, onChunk, onComplete, onError }) {
  const systemPrompt = buildSystemPrompt(selectedModes);
  
  const userPrompt = `Please perform a deep analysis on this DataPack.\n\n${dataPack}`;

  await streamResponse({
    providerId,
    model,
    apiKey,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    onChunk,
    onComplete,
    onError,
  });
}

/**
 * Handles follow-up chat messages.
 */
export async function runChat({ apiKey, providerId, model, history, userMessage, dataContext, onChunk, onComplete, onError }) {
  const systemPrompt = `You are a warm, honest health data analyst. Answer follow-up questions clearly.`;
  
  const messages = [
    ...(dataContext ? [{ role: 'user', content: `Context:\n${dataContext.slice(0, 8000)}` }] : []),
    ...history,
    { role: 'user', content: userMessage }
  ];

  await streamResponse({
    providerId,
    model,
    apiKey,
    systemPrompt,
    messages,
    onChunk,
    onComplete,
    onError,
  });
}
