export default function handler(req, res) {
  const { FITBIT_CLIENT_ID, BASE_URL } = process.env
  if (!FITBIT_CLIENT_ID || !BASE_URL) {
    res.status(500).send('Missing FITBIT_CLIENT_ID or BASE_URL environment variables')
    return
  }

  const redirectUri = `${BASE_URL}/api/fitbit/callback`
  const scope = encodeURIComponent('activity heartrate sleep profile')
  const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${FITBIT_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`
  res.writeHead(302, { Location: authUrl })
  res.end()
}
