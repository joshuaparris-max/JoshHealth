function getBaseUrl(req) {
  const fromEnv = process.env.BASE_URL || process.env.HEALTHLENS_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const host = req.headers?.host
  return host ? `https://${host}` : 'https://health-lens-rust.vercel.app'
}

export default function handler(req, res) {
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) {
    res.status(500).send('Missing STRAVA_CLIENT_ID')
    return
  }

  const redirectUri = process.env.STRAVA_REDIRECT_URI || `${getBaseUrl(req)}/api/strava/callback`
  const scopes = process.env.STRAVA_SCOPES || 'read,activity:read'
  const state = req.query?.state || 'healthlens'
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', state)

  res.writeHead(302, { Location: url.toString() })
  res.end()
}
