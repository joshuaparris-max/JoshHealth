import fetch from 'node-fetch'

export default async function handler(req, res) {
  const { WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET, BASE_URL } = process.env
  const { code } = req.query || req.body || {}
  if (!code) {
    res.status(400).send('Missing code')
    return
  }
  if (!WITHINGS_CLIENT_ID || !WITHINGS_CLIENT_SECRET || !BASE_URL) {
    res.status(500).send('Missing environment variables')
    return
  }

  const tokenUrl = 'https://wbsapi.withings.net/v2/oauth2'

  const params = new URLSearchParams()
  params.append('action', 'requesttoken')
  params.append('client_id', WITHINGS_CLIENT_ID)
  params.append('client_secret', WITHINGS_CLIENT_SECRET)
  params.append('code', code)
  params.append('grant_type', 'authorization_code')
  params.append('redirect_uri', `${BASE_URL}/api/withings/callback`)

  try {
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    const data = await r.json()
    res.status(200).json({ message: 'Withings token exchange successful (persist securely)', token: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
