import https from 'node:https'

export default async function aiChatHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { providerId, model, messages, apiKey: clientApiKey } = req.body

    // Select API key: prioritize client key, fallback to server pool
    let apiKey = clientApiKey
    if (!apiKey && providerId === 'groq') {
      const serverKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean)
      if (serverKeys.length > 0) {
        apiKey = serverKeys[0] 
        req.serverKeys = serverKeys
      }
    }

    if (!apiKey) {
      return res.status(401).json({ error: `Missing API key for ${providerId}` })
    }

    // Set up headers for streaming
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let attempt = 0
    const maxAttempts = req.serverKeys ? req.serverKeys.length : 1

    while (attempt < maxAttempts) {
      const currentKey = req.serverKeys ? req.serverKeys[attempt] : apiKey
      
      let endpoint = 'https://api.groq.com/openai/v1/chat/completions'
      if (providerId === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions'
      if (providerId === 'anthropic') endpoint = 'https://api.anthropic.com/v1/messages'

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          max_tokens: req.body.max_tokens || 1500
        })
      }

      if (providerId === 'openrouter') {
        fetchOptions.headers['HTTP-Referer'] = 'https://health-lens-rust.vercel.app/'
        fetchOptions.headers['X-Title'] = 'HealthLens'
      } else if (providerId === 'anthropic') {
        delete fetchOptions.headers['Authorization']
        fetchOptions.headers['x-api-key'] = currentKey
        fetchOptions.headers['anthropic-version'] = '2023-06-01'
        // For Anthropic, system prompt is extracted from first message
        const isSystem = messages.length > 0 && messages[0].role === 'system';
        const system = isSystem ? messages[0].content : '';
        const msgList = isSystem ? messages.slice(1) : messages;
        fetchOptions.body = JSON.stringify({
          model,
          system,
          messages: msgList,
          stream: true,
          max_tokens: req.body.max_tokens || 1500
        })
      }

      const response = await fetch(endpoint, fetchOptions)

      if (!response.ok) {
        if (response.status === 401 && req.serverKeys && attempt < maxAttempts - 1) {
          attempt++
          continue
        }

        const errorData = await response.text()
        const retryAfter = response.headers.get('retry-after')
        return res.status(response.status).json({
          error: `Provider HTTP ${response.status}`,
          details: errorData,
          retryAfter
        })
      }

      // Stream the response to the client using Node.js res.write (or Response if edge, but this is node)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value) // value is Uint8Array, Node res.write accepts Uint8Array
      }

      res.end()
      return 
    }

  } catch (error) {
    console.error('AI Chat proxy error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    } else {
      res.end()
    }
  }
}
