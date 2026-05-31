import fetch from 'node-fetch'

export default async function handler(req, res) {
  const { FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, BASE_URL } = process.env
  const { code } = req.query || req.body || {}
  if (!code) {
    res.status(400).send('Missing code')
    return
  }
  if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET || !BASE_URL) {
    res.status(500).send('Missing environment variables')
    return
  }

  const tokenUrl = 'https://api.fitbit.com/oauth2/token'
  const redirectUri = `${BASE_URL}/api/fitbit/callback`

  const params = new URLSearchParams()
  params.append('client_id', FITBIT_CLIENT_ID)
  params.append('grant_type', 'authorization_code')
  params.append('redirect_uri', redirectUri)
  params.append('code', code)

  const auth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64')

  try {
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })
    const data = await r.json()
    // WARNING: This response contains tokens. Persist securely in your server-side DB.
    res.status(200).json({ message: 'Fitbit token exchange successful (do not store tokens in the repo)', token: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
