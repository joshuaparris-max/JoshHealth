import supabaseAdmin from './supabaseServer.js'

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_API_BASE = 'https://www.strava.com/api/v3'

function envValue(env, key) {
  return env?.[key] || process.env[key]
}

function defaultUserId(env) {
  return envValue(env, 'DEFAULT_USER_ID') || 'local-user'
}

function requireSupabase(client) {
  if (!client) throw new Error('Supabase service role is unavailable')
  return client
}

function toIsoFromEpochSeconds(value) {
  return value ? new Date(Number(value) * 1000).toISOString() : null
}

function addSeconds(dateString, seconds) {
  if (!dateString || !seconds) return null
  return new Date(new Date(dateString).getTime() + Number(seconds) * 1000).toISOString()
}

async function readJsonResponse(response, label) {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    const detail = data?.message || data?.error || response.statusText
    throw new Error(`${label} failed: HTTP ${response.status} ${detail}`.trim())
  }
  return data
}

export async function exchangeStravaCode(code, { env = process.env, fetchImpl = fetch } = {}) {
  const clientId = envValue(env, 'STRAVA_CLIENT_ID')
  const clientSecret = envValue(env, 'STRAVA_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Missing Strava client credentials')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  })

  const response = await fetchImpl(STRAVA_TOKEN_URL, { method: 'POST', body })
  return readJsonResponse(response, 'Strava token exchange')
}

export async function storeStravaToken(tokenData, { supabaseClient = supabaseAdmin, env = process.env, scope = '' } = {}) {
  const client = requireSupabase(supabaseClient)
  const athlete = tokenData?.athlete || {}
  const accountId = athlete.id ? String(athlete.id) : null
  if (!accountId) throw new Error('Strava token response did not include athlete id')

  const row = {
    user_id: defaultUserId(env),
    provider: 'strava',
    account_id: accountId,
    access_token: tokenData.access_token || null,
    refresh_token: tokenData.refresh_token || null,
    expires_at: toIsoFromEpochSeconds(tokenData.expires_at),
    scope: tokenData.scope || scope || null,
    raw_response: {
      token_type: tokenData.token_type || null,
      expires_at: tokenData.expires_at || null,
      expires_in: tokenData.expires_in || null,
      scope: tokenData.scope || scope || null,
      athlete,
    },
  }

  const { data, error } = await client
    .from('oauth_tokens')
    .upsert(row, { onConflict: 'provider,account_id,user_id' })
    .select()
    .single()
  if (error) throw error
  return data || row
}

async function getStravaTokenRow({ supabaseClient = supabaseAdmin, env = process.env, userId = defaultUserId(env), accountId } = {}) {
  const client = requireSupabase(supabaseClient)
  let query = client
    .from('oauth_tokens')
    .select('*')
    .eq('provider', 'strava')
    .eq('user_id', userId)
    .limit(1)

  if (accountId) query = query.eq('account_id', String(accountId))

  const { data, error } = await query.single()
  if (error) throw error
  if (!data) throw new Error('No connected Strava token found')
  return data
}

async function refreshTokenRow(row, { supabaseClient = supabaseAdmin, env = process.env, fetchImpl = fetch } = {}) {
  const clientId = envValue(env, 'STRAVA_CLIENT_ID')
  const clientSecret = envValue(env, 'STRAVA_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Missing Strava client credentials')
  if (!row?.refresh_token) throw new Error('Connected Strava token is missing a refresh token')

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  })

  const response = await fetchImpl(STRAVA_TOKEN_URL, { method: 'POST', body })
  const data = await readJsonResponse(response, 'Strava token refresh')
  const update = {
    access_token: data.access_token || row.access_token,
    refresh_token: data.refresh_token || row.refresh_token,
    expires_at: toIsoFromEpochSeconds(data.expires_at),
    raw_response: {
      ...(row.raw_response || {}),
      token_type: data.token_type || row.raw_response?.token_type || null,
      expires_at: data.expires_at || null,
      expires_in: data.expires_in || null,
    },
  }

  const { data: updated, error } = await requireSupabase(supabaseClient)
    .from('oauth_tokens')
    .update(update)
    .eq('id', row.id)
    .select()
    .single()
  if (error) throw error
  return updated || { ...row, ...update }
}

export async function refreshStravaToken(userId, options = {}) {
  const row = await getStravaTokenRow({ ...options, userId: userId || defaultUserId(options.env) })
  return refreshTokenRow(row, options)
}

export async function getValidStravaAccessToken(userId, options = {}) {
  let row = await getStravaTokenRow({ ...options, userId: userId || defaultUserId(options.env) })
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0
  if (!row.access_token || expiresAt <= Date.now() + 60_000) {
    row = await refreshTokenRow(row, options)
  }
  return row.access_token
}

export async function fetchStravaActivity(activityId, accessToken, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${STRAVA_API_BASE}/activities/${encodeURIComponent(activityId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return readJsonResponse(response, 'Fetch Strava activity')
}

export async function fetchStravaActivities({ after, before, page = 1, perPage = 30, accessToken, fetchImpl = fetch } = {}) {
  if (!accessToken) throw new Error('Missing Strava access token')
  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`)
  if (after) url.searchParams.set('after', String(after))
  if (before) url.searchParams.set('before', String(before))
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return readJsonResponse(response, 'Fetch Strava activities')
}

export async function fetchStravaActivityStreams(activityId, keys, accessToken, { fetchImpl = fetch } = {}) {
  if (!accessToken) throw new Error('Missing Strava access token')
  const url = new URL(`${STRAVA_API_BASE}/activities/${encodeURIComponent(activityId)}/streams`)
  url.searchParams.set('keys', Array.isArray(keys) ? keys.join(',') : String(keys || 'heartrate'))
  url.searchParams.set('key_by_type', 'true')

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return readJsonResponse(response, 'Fetch Strava activity streams')
}

export function mapStravaActivityToRows(activity, { userId = 'local-user', streams = null, sourceId = null, importId = null } = {}) {
  const activityId = String(activity?.id || '')
  if (!activityId) throw new Error('Strava activity is missing id')

  const start = activity.start_date || activity.start_date_local || null
  const movingTimeSeconds = activity.moving_time ?? null
  const elapsedTimeSeconds = activity.elapsed_time ?? movingTimeSeconds
  const externalId = `strava:${activityId}`
  const heartrateStream = streams?.heartrate?.data || streams?.heartrate || null
  const streamHrValues = Array.isArray(heartrateStream)
    ? heartrateStream.map(Number).filter((value) => Number.isFinite(value))
    : []
  const streamAverageHr = streamHrValues.length
    ? Number((streamHrValues.reduce((sum, value) => sum + value, 0) / streamHrValues.length).toFixed(1))
    : null
  const streamMaxHr = streamHrValues.length ? Math.max(...streamHrValues) : null

  const stravaActivityRow = {
    user_id: userId,
    strava_activity_id: activityId,
    name: activity.name || null,
    sport_type: activity.sport_type || null,
    type: activity.type || null,
    start_date: activity.start_date || null,
    start_date_local: activity.start_date_local || null,
    timezone: activity.timezone || null,
    distance_m: activity.distance ?? null,
    moving_time_seconds: movingTimeSeconds,
    elapsed_time_seconds: elapsedTimeSeconds,
    total_elevation_gain: activity.total_elevation_gain ?? null,
    average_speed: activity.average_speed ?? null,
    max_speed: activity.max_speed ?? null,
    average_heartrate: activity.average_heartrate ?? streamAverageHr,
    max_heartrate: activity.max_heartrate ?? streamMaxHr,
    calories: activity.calories ?? null,
    suffer_score: activity.suffer_score ?? null,
    private: activity.private ?? null,
    trainer: activity.trainer ?? null,
    commute: activity.commute ?? null,
    gear_id: activity.gear_id || null,
    raw_json: activity,
    synced_at: new Date().toISOString(),
    deleted_at: null,
    updated_at: new Date().toISOString(),
  }

  const exerciseRow = {
    user_id: userId,
    start_time: start,
    end_time: addSeconds(start, elapsedTimeSeconds),
    activity_type: activity.sport_type || activity.type || 'Strava activity',
    duration_minutes: movingTimeSeconds ? Math.round(Number(movingTimeSeconds) / 60) : null,
    distance_m: activity.distance ?? null,
    calories: activity.calories ?? null,
    steps: null,
    avg_hr: activity.average_heartrate ?? streamAverageHr,
    max_hr: activity.max_heartrate ?? streamMaxHr,
    source_id: sourceId,
    import_id: importId,
    external_id: externalId,
    source_name: 'strava',
    raw_json: {
      provider: 'strava',
      strava_activity_id: activityId,
      exercise_source_only: true,
      raw_activity: activity,
      stream_summary: streamHrValues.length ? { heartrate_samples: streamHrValues.length } : null,
    },
    deleted_at: null,
  }

  const heartMetricRows = []
  if (typeof exerciseRow.avg_hr === 'number') {
    heartMetricRows.push({
      user_id: userId,
      timestamp_or_date: start,
      metric_type: 'strava_activity_avg_hr',
      value: exerciseRow.avg_hr,
      unit: 'bpm',
      source_id: sourceId,
      import_id: importId,
      external_id: `${externalId}:avg_hr`,
      source_name: 'strava',
      raw_json: { provider: 'strava', strava_activity_id: activityId, exercise_source_only: true },
    })
  }
  if (typeof exerciseRow.max_hr === 'number') {
    heartMetricRows.push({
      user_id: userId,
      timestamp_or_date: start,
      metric_type: 'strava_activity_max_hr',
      value: exerciseRow.max_hr,
      unit: 'bpm',
      source_id: sourceId,
      import_id: importId,
      external_id: `${externalId}:max_hr`,
      source_name: 'strava',
      raw_json: { provider: 'strava', strava_activity_id: activityId, exercise_source_only: true },
    })
  }

  return { stravaActivityRow, exerciseRow, heartMetricRows }
}

export async function upsertStravaActivityToSupabase(activity, streams = null, { supabaseClient = supabaseAdmin, env = process.env } = {}) {
  const client = requireSupabase(supabaseClient)
  const userId = defaultUserId(env)
  const rows = mapStravaActivityToRows(activity, { userId, streams })

  const { error: stravaError } = await client
    .from('strava_activities')
    .upsert(rows.stravaActivityRow, { onConflict: 'strava_activity_id' })
  if (stravaError) throw stravaError

  const { error: exerciseError } = await client
    .from('exercise_sessions')
    .upsert(rows.exerciseRow, { onConflict: 'external_id' })
  if (exerciseError) throw exerciseError

  for (const metricRow of rows.heartMetricRows) {
    const { error: metricError } = await client
      .from('heart_metrics')
      .upsert(metricRow, { onConflict: 'external_id' })
    if (metricError) throw metricError
  }

  return {
    stravaActivityId: rows.stravaActivityRow.strava_activity_id,
    heartMetrics: rows.heartMetricRows.length,
  }
}

export async function markStravaActivityDeleted(activityId, { supabaseClient = supabaseAdmin } = {}) {
  const client = requireSupabase(supabaseClient)
  const externalId = `strava:${activityId}`
  const deletedAt = new Date().toISOString()

  const { error: stravaError } = await client
    .from('strava_activities')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq('strava_activity_id', String(activityId))
  if (stravaError) throw stravaError

  const { error: exerciseError } = await client
    .from('exercise_sessions')
    .update({ deleted_at: deletedAt })
    .eq('external_id', externalId)
  if (exerciseError) throw exerciseError

  return { activityId: String(activityId), deletedAt }
}
