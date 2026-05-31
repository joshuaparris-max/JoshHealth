import supabaseAdmin from '../lib/supabaseServer.js'

function startOfWindow(days) {
  return new Date(Date.now() - Number(days || 90) * 24 * 60 * 60 * 1000).toISOString()
}

function summarizeActivities(rows = []) {
  const sportTypes = {}
  let totalDistanceM = 0
  let totalMovingSeconds = 0
  let heartRateActivities = 0

  rows.forEach((row) => {
    const sport = row.sport_type || row.type || 'Unknown'
    sportTypes[sport] = (sportTypes[sport] || 0) + 1
    const distance = Number(row.distance_m)
    const movingTime = Number(row.moving_time_seconds)
    const avgHr = Number(row.average_heartrate)
    const maxHr = Number(row.max_heartrate)
    if (Number.isFinite(distance)) totalDistanceM += distance
    if (Number.isFinite(movingTime)) totalMovingSeconds += movingTime
    if (Number.isFinite(avgHr) || Number.isFinite(maxHr)) heartRateActivities += 1
  })

  return {
    connected: false,
    activityCount: rows.length,
    latestActivityDate: rows[0]?.start_date || rows[0]?.start_date_local || null,
    totalDistanceM,
    totalMovingSeconds,
    sportTypes,
    heartRateActivities,
    exerciseSourceOnly: true,
  }
}

export async function createStravaStatus({ supabaseClient = supabaseAdmin, env = process.env, days = 90 } = {}) {
  if (!supabaseClient) return { connected: false, error: 'Supabase service role is unavailable' }
  const userId = env.DEFAULT_USER_ID || 'local-user'

  const { data: tokenRows, error: tokenError } = await supabaseClient
    .from('oauth_tokens')
    .select('account_id,scope,created_at,expires_at')
    .eq('provider', 'strava')
    .eq('user_id', userId)
    .limit(1)

  if (tokenError) throw tokenError

  const { data: activities, error: activityError } = await supabaseClient
    .from('strava_activities')
    .select('strava_activity_id,name,sport_type,type,start_date,start_date_local,distance_m,moving_time_seconds,average_heartrate,max_heartrate')
    .eq('user_id', userId)
    .gte('start_date', startOfWindow(days))
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
    .limit(200)

  if (activityError) throw activityError

  return {
    ...summarizeActivities(activities || []),
    connected: Boolean(tokenRows?.length),
    accountId: tokenRows?.[0]?.account_id || null,
    scope: tokenRows?.[0]?.scope || null,
    tokenCreatedAt: tokenRows?.[0]?.created_at || null,
    tokenExpiresAt: tokenRows?.[0]?.expires_at || null,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const status = await createStravaStatus({ days: req.query?.days || 90 })
    res.status(200).json(status)
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message })
  }
}
