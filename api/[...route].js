import adminSelfTest from '../src/apiHandlers/admin-self-test.js'
import fitbitCallback from '../src/apiHandlers/fitbit-callback.js'
import fitbitStart from '../src/apiHandlers/fitbit-start.js'
import fitbitWebhook from '../src/apiHandlers/fitbit-webhook.js'
import healthconnectIngest from '../src/apiHandlers/healthconnect-ingest.js'
import syncHealthConnect from '../src/apiHandlers/sync-health-connect.js'
import stravaCallback from '../src/apiHandlers/strava-callback.js'
import stravaStart from '../src/apiHandlers/strava-start.js'
import stravaStatus from '../src/apiHandlers/strava-status.js'
import stravaWebhook from '../src/apiHandlers/strava-webhook.js'
import withingsCallback from '../src/apiHandlers/withings-callback.js'
import withingsStart from '../src/apiHandlers/withings-start.js'

const routeMap = new Map([
  ['admin/self-test', adminSelfTest],
  ['fitbit/start', fitbitStart],
  ['fitbit/callback', fitbitCallback],
  ['fitbit/webhook', fitbitWebhook],
  ['healthconnect/ingest', healthconnectIngest],
  ['sync/health-connect', syncHealthConnect],
  ['strava/start', stravaStart],
  ['strava/callback', stravaCallback],
  ['strava/status', stravaStatus],
  ['strava/webhook', stravaWebhook],
  ['withings/start', withingsStart],
  ['withings/callback', withingsCallback],
])

function normalizePath(req) {
  const host = req.headers?.host || 'localhost'
  const url = new URL(req.url || '', `https://${host}`)
  const path = url.pathname.replace(/^\/api\//i, '').replace(/\/$/, '')
  return path.replace(/^\//, '')
}

export default async function handler(req, res) {
  const route = normalizePath(req)
  const routeHandler = routeMap.get(route)
  if (!routeHandler) {
    res.status(404).json({ error: 'Not found', route })
    return
  }

  try {
    const result = routeHandler(req, res)
    if (result && typeof result.then === 'function') {
      await result
    }
  } catch (error) {
    console.error('Catch-all API route error', error)
    res.status(500).json({ error: error?.message || 'Internal server error' })
  }
}
