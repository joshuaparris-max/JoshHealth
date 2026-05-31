const endpoint = 'https://www.strava.com/api/v3/push_subscriptions'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function argValue(name) {
  const prefix = `${name}=`
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

async function main() {
  const id = argValue('--id') || process.env.STRAVA_WEBHOOK_ID
  if (!id) throw new Error('Missing --id=<subscription_id> or STRAVA_WEBHOOK_ID')

  const url = new URL(`${endpoint}/${encodeURIComponent(id)}`)
  url.searchParams.set('client_id', requireEnv('STRAVA_CLIENT_ID'))
  url.searchParams.set('client_secret', requireEnv('STRAVA_CLIENT_SECRET'))

  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => null)
    console.error(`Strava webhook delete failed: HTTP ${response.status}`)
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }

  console.log(`Strava webhook ${id} deleted`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
