import { SOURCE_PRIORITY } from './schema.js'

export const PROVIDER_CONFIGS = {
  anthropic: {
    label: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    style: 'anthropic',
    defaultModel: 'claude-sonnet-4-5',
    promptBudgetChars: 90000,
  },
  groq: {
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    style: 'openai',
    defaultModel: 'llama-3.3-70b-versatile',
    promptBudgetChars: 42000,
  },
  openrouter: {
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    style: 'openai',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    promptBudgetChars: 50000,
  },
}

const ANALYSIS_MODES = {
  quickSummary: {
    label: 'Quick Summary',
    icon: '+',
    prompt: 'Give a clear, plain-English overview. Highlight the 3-5 most important findings, the confidence level for each, and the next practical step.',
  },
  deepPattern: {
    label: 'Deep Pattern Analysis',
    icon: '*',
    prompt: 'Look for trends over time, anomalies, source conflicts, and patterns that are safely supported by the deterministic Data Pack.',
  },
  clinicalReview: {
    label: 'Clinical Records',
    icon: 'C',
    prompt: 'Review pathology, ECG, blood-test, or clinical text cautiously. Separate extracted facts from interpretation and suggest GP discussion points without diagnosing.',
  },
  sleepAnalysis: {
    label: 'Sleep Analysis',
    icon: 'S',
    prompt: 'Analyse sleep duration, consistency, efficiency/stages if present, source reliability, and how sleep appears to interact with recovery metrics.',
  },
  movementBreakdown: {
    label: 'Movement & Exercise',
    icon: 'M',
    prompt: 'Analyse steps, exercise sessions, intensity/load, active minutes, sudden changes, and likely gaps such as strength training.',
  },
  recoveryHRV: {
    label: 'Recovery & HRV',
    icon: 'R',
    prompt: 'Analyse HRV/RMSSD, resting HR, respiratory rate, sleep, and activity together. Flag under-recovery patterns cautiously.',
  },
  nutritionGaps: {
    label: 'Nutrition Gaps',
    icon: 'N',
    prompt: 'Analyse nutrition only if direct intake or clinical markers exist. If data is missing, name the gap plainly instead of guessing.',
  },
  actionPlan: {
    label: '90-Day Action Plan',
    icon: '90',
    prompt: 'Create a practical 90-day plan with a small number of high-yield experiments, success metrics, and warning signs.',
  },
  comparePeriods: {
    label: 'Compare Time Periods',
    icon: '<>',
    prompt: 'Compare periods shown in the Data Pack. Name improvements, declines, and unknowns with dates and row counts where available.',
  },
}

export { ANALYSIS_MODES }

function getConfig(provider) {
  return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.anthropic
}

function appOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://health-lens-rust.vercel.app'
}

function compactText(text, maxChars) {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[Truncated by HealthLens to stay within provider context limits: ${text.length - maxChars} chars omitted.]`
}

export function buildDataBlock(parsedFiles, provider = 'anthropic') {
  const config = getConfig(provider)
  const totalBudget = config.promptBudgetChars
  const files = parsedFiles || []
  if (!files.length) return ''

  const perFileBudget = Math.max(6000, Math.floor(totalBudget / Math.max(1, files.length)))
  let used = 0
  let omitted = 0
  const blocks = []

  for (const file of files) {
    const base = file.summary || file.content || ''
    const type = file.type || file.name?.split('.').pop()?.toLowerCase() || 'unknown'
    const preferredBudget = ['db', 'sqlite', 'zip'].includes(type)
      ? Math.min(perFileBudget + 8000, 26000)
      : ['pdf', 'csv'].includes(type)
        ? Math.min(perFileBudget + 3000, 18000)
        : perFileBudget
    const remaining = totalBudget - used
    if (remaining <= 1000) {
      omitted += 1
      continue
    }
    const limit = Math.min(preferredBudget, remaining)
    const body = compactText(base, limit)
    used += body.length
    blocks.push(`=== FILE: ${file.name} (${type}, ${((file.size || 0) / 1024).toFixed(1)}KB) ===\n${body}`)
  }

  if (omitted > 0) {
    blocks.push(`[HealthLens omitted ${omitted} file summary block(s) to avoid provider context-length errors. Analyse the included files only.]`)
  }

  return blocks.join('\n\n---\n\n')
}

function extractErrorMessage(text, fallback) {
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text)
    return parsed.error?.message || parsed.error?.code || parsed.message || parsed.detail || text
  } catch {
    return text
  }
}

function statusHint(status, message) {
  const m = String(message || '').toLowerCase()
  if (status === 401) return 'Check that the API key is correct for this provider.'
  if (status === 402) return 'The provider says the account needs credits, billing, or a paid route.'
  if (status === 403) return 'The key is valid enough to reach the provider, but this model or route is not allowed.'
  if (status === 404 || m.includes('model')) return 'The selected model ID may be unavailable. Try the recommended default model.'
  if (status === 413 || m.includes('context') || m.includes('too large')) return 'The request was too large. Try fewer files or a smaller analysis set.'
  if (status === 429) return 'Rate limit hit. Wait a minute or use a smaller/faster model.'
  if (status >= 500) return 'The provider had a server-side failure. Retrying later may work.'
  return ''
}

async function providerError(response, provider) {
  const text = await response.text().catch(() => '')
  const message = extractErrorMessage(text, `${response.status} ${response.statusText}`)
  const hint = statusHint(response.status, message)
  const clean = `${getConfig(provider).label} error ${response.status}: ${message}${hint ? `\n\nHint: ${hint}` : ''}`
  const err = new Error(clean)
  err.status = response.status
  err.provider = provider
  return err
}

function requestHeaders(provider, apiKey) {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = appOrigin()
    headers['X-Title'] = 'HealthLens'
    headers['X-OpenRouter-Title'] = 'HealthLens'
  }

  return headers
}

function requestBody({ provider, model, systemPrompt, messages, maxTokens = 4096 }) {
  const config = getConfig(provider)
  if (config.style === 'anthropic') {
    return {
      model: model || config.defaultModel,
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
      messages,
    }
  }

  return {
    model: model || config.defaultModel,
    max_tokens: maxTokens,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  }
}

async function streamResponse({ provider, model, apiKey, systemPrompt, messages, onChunk, onComplete, onError, maxTokens = 4096 }) {
  try {
    const config = getConfig(provider)
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: requestHeaders(provider, apiKey),
      body: JSON.stringify(requestBody({ provider, model, systemPrompt, messages, maxTokens })),
    })

    if (!response.ok) throw await providerError(response, provider)
    if (!response.body) throw new Error(`${config.label} returned an empty streaming response body.`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue
        try {
          const parsed = JSON.parse(trimmed.slice(6))
          let chunk = ''
          if (provider === 'anthropic') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) chunk = parsed.delta.text
          } else {
            chunk = parsed.choices?.[0]?.delta?.content ?? ''
          }
          if (chunk) {
            fullText += chunk
            onChunk(fullText)
          }
        } catch {
          // Ignore non-JSON SSE keepalive lines.
        }
      }
    }

    onComplete(fullText)
  } catch (err) {
    onError(err.message || String(err))
  }
}

export async function checkHealth({ provider, model, apiKey }) {
  try {
    const config = getConfig(provider)
    const systemPrompt = "Health check. Reply with only OK."
    const messages = [{ role: 'user', content: 'Reply OK if this model is available.' }]
    const body = requestBody({ provider, model, systemPrompt, messages, maxTokens: 8 })
    body.stream = false

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: requestHeaders(provider, apiKey),
      body: JSON.stringify(body),
    })

    if (!response.ok) throw await providerError(response, provider)
    return { ok: true, message: `${config.label} connected with ${model || config.defaultModel}.` }
  } catch (err) {
    return {
      ok: false,
      message: err.message || String(err),
      status: err.status || null,
      provider: err.provider || provider,
    }
  }
}

export async function runAnalysis({ apiKey, provider = 'anthropic', model, parsedFiles, selectedModes, onChunk, onComplete, onError }) {
  const config = getConfig(provider)
  const dataBlock = buildDataBlock(parsedFiles, provider)
  const modeInstructions = selectedModes
    .map(m => ANALYSIS_MODES[m])
    .filter(Boolean)
    .map(m => `**${m.label}**: ${m.prompt}`)
    .join('\n\n')

  const systemPrompt = `You are a senior health data analyst. You are analysing a deterministic HealthLens Data Pack, not raw files.

SOURCE PRIORITY RULES:
${Object.entries(SOURCE_PRIORITY).map(([metric, sources]) => `- ${metric}: ${sources.join(' > ')}`).join('\n')}

ANALYSIS MODES REQUESTED:
${modeInstructions || '- General careful health-data summary'}

IMPORTANT RULES:
- Use Australia/Sydney timezone unless a file explicitly proves otherwise.
- Do not invent data. If the Data Pack says a metric has 0 rows, it is empty.
- Do not say a metric is missing if the Data Pack shows rows exist.
- Every major claim must reference extracted evidence: metric, date range, row count, source hint, or parser warning.
- Warn when source overlap may distort totals.
- If a table exists with 0 rows, say "table exists but contains no records".
- If a parser failed or the request was truncated, say "parser/request limitation", not "data absent".
- Separate raw data, cleaned/aggregated data, inference, and medical boundaries.
- Use plain Australian English: warm, direct, never patronising.
- This is not medical advice. Suggest GP discussion for clinical documents, symptoms, ECG, pathology, medications, chest pain, fainting, palpitations, abnormal breathlessness, or abnormal results.

RESPONSE STRUCTURE:
1. Data Inventory
2. Data Quality Audit
3. What Can Safely Be Concluded
4. What Is Unknown Or Not Safe To Conclude
5. Metric-by-Metric Analysis
6. Pattern Lenses
7. Next Experiments
8. GP / Clinician Discussion Pack if clinical data is present`

  const userPrompt = `Please analyse this HealthLens Data Pack.

HEALTH DATA PACK:
${dataBlock}

Begin with the Data Inventory and keep claims grounded in the Data Pack.`

  await streamResponse({
    provider,
    model: model || config.defaultModel,
    apiKey,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    onChunk,
    onComplete,
    onError,
    maxTokens: 4096,
  })
}

export async function runChat({ apiKey, provider = 'anthropic', model, history, userMessage, dataContext, onChunk, onComplete, onError }) {
  const config = getConfig(provider)
  const systemPrompt = `You are a warm, honest health data analyst helping someone understand their uploaded personal health data.

Rules:
- Use only the provided data context unless the user explicitly asks for general education.
- Do not invent missing metrics.
- Separate evidence, inference, and uncertainty.
- This is not medical advice; suggest GP/clinician review for clinical concerns.
- Use plain Australian English.`

  const contextMessage = dataContext
    ? `[HEALTH DATA CONTEXT]\n${compactText(dataContext, Math.min(config.promptBudgetChars, 30000))}\n[END CONTEXT]\n\n`
    : ''

  const messages = [
    ...(history.length === 0 && dataContext
      ? [
          { role: 'user', content: contextMessage + 'I have uploaded health data. Please be ready to answer questions about it.' },
          { role: 'assistant', content: 'Got it - I have your health data context loaded. What would you like to explore?' },
        ]
      : []),
    ...history,
    { role: 'user', content: userMessage },
  ]

  await streamResponse({
    provider,
    model: model || config.defaultModel,
    apiKey,
    systemPrompt,
    messages,
    onChunk,
    onComplete,
    onError,
    maxTokens: 2048,
  })
}
