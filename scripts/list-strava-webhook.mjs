const endpoint = 'https://www.strava.com/api/v3/push_subscriptions'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function main() {
  const url = new URL(endpoint)
  url.searchParams.set('client_id', requireEnv('STRAVA_CLIENT_ID'))
  url.searchParams.set('client_secret', requireEnv('STRAVA_CLIENT_SECRET'))

  const response = await fetch(url)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error(`Strava webhook list failed: HTTP ${response.status}`)
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }

  const safe = Array.isArray(data) ? data.map((row) => ({
    id: row.id,
    callback_url: row.callback_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })) : data
  console.log(JSON.stringify(safe, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
