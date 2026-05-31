/**
 * AI Provider Abstraction Layer
 * Defines endpoints, models, and request/response formatting for each provider.
 */

export const PROVIDERS = [
  {
    id: 'groq',
    name: 'Groq',
    label: 'Groq (Fastest)',
    badge: 'Free tier',
    badgeClass: 'text-jade',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
    note: 'Fast Llama models with a generous free tier.',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (recommended)' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
    body: (model, system, messages, stream = true) => ({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4096,
      stream,
    }),
    parseChunk: (json) => json.choices?.[0]?.delta?.content ?? '',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    label: 'OpenRouter',
    badge: 'Multi-model',
    badgeClass: 'text-jade',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-...',
    note: 'Access to many free and paid models.',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)' },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (free)' },
      { id: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (paid)' },
    ],
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'HealthLens',
    }),
    body: (model, system, messages, stream = true) => ({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4096,
      stream,
    }),
    parseChunk: (json) => json.choices?.[0]?.delta?.content ?? '',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    label: 'Anthropic (Best)',
    badge: 'Paid',
    badgeClass: 'text-slate-ui',
    endpoint: 'https://api.anthropic.com/v1/messages',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
    note: 'Requires a paid Anthropic account.',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
    headers: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (model, system, messages, stream = true) => ({
      model,
      system,
      messages,
      max_tokens: 4096,
      stream,
    }),
    parseChunk: (json) => {
      if (json.type === 'content_block_delta' && json.delta?.text) {
        return json.delta.text
      }
      return ''
    },
  },
];

export const getProvider = (id) => PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
