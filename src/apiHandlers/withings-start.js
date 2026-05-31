export default function handler(req, res) {
  const { WITHINGS_CLIENT_ID, BASE_URL } = process.env
  if (!WITHINGS_CLIENT_ID || !BASE_URL) {
    res.status(500).send('Missing WITHINGS_CLIENT_ID or BASE_URL environment variables')
    return
  }
  const redirectUri = `${BASE_URL}/api/withings/callback`
  const scope = encodeURIComponent('user.info,user.metrics')
  const authUrl = `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=${WITHINGS_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`
  res.writeHead(302, { Location: authUrl })
  res.end()
}
