const endpoint = 'https://www.strava.com/api/v3/push_subscriptions'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function main() {
  const body = new URLSearchParams({
    client_id: requireEnv('STRAVA_CLIENT_ID'),
    client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
    callback_url: requireEnv('STRAVA_WEBHOOK_CALLBACK_URL'),
    verify_token: requireEnv('STRAVA_VERIFY_TOKEN'),
  })

  const response = await fetch(endpoint, { method: 'POST', body })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error(`Strava webhook registration failed: HTTP ${response.status}`)
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }

  console.log('Strava webhook registered')
  console.log(JSON.stringify({
    id: data?.id,
    callback_url: data?.callback_url,
    created_at: data?.created_at,
    updated_at: data?.updated_at,
  }, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
