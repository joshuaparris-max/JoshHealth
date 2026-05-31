import supabaseAdmin from '../apiLib/supabaseServer.js'
import {
  fetchStravaActivity,
  getValidStravaAccessToken,
  markStravaActivityDeleted,
  upsertStravaActivityToSupabase,
} from '../apiLib/stravaClient.js'

function getQueryValue(req, key) {
  return req.query?.[key] ?? req.query?.[key.replace('.', '_')]
}

function eventTimeToIso(value) {
  return value ? new Date(Number(value) * 1000).toISOString() : null
}

function normalizeEvent(body = {}) {
  return {
    object_type: body.object_type || null,
    object_id: body.object_id != null ? String(body.object_id) : null,
    aspect_type: body.aspect_type || null,
    owner_id: body.owner_id != null ? String(body.owner_id) : null,
    subscription_id: body.subscription_id != null ? String(body.subscription_id) : null,
    event_time: eventTimeToIso(body.event_time),
    updates_json: body.updates || {},
    processed: false,
    error: null,
  }
}

async function storeWebhookEvent(event, supabaseClient) {
  const { data, error } = await supabaseClient
    .from('strava_webhook_events')
    .insert(event)
    .select()
    .single()
  if (error) throw error
  return data || event
}

async function markWebhookProcessed(row, supabaseClient, patch) {
  if (!row?.id) return
  await supabaseClient
    .from('strava_webhook_events')
    .update(patch)
    .eq('id', row.id)
}

export async function processStravaWebhookEvent(event, { supabaseClient = supabaseAdmin, env = process.env } = {}) {
  if (event.object_type !== 'activity' || !event.object_id) return { skipped: true }

  if (event.aspect_type === 'delete') {
    await markStravaActivityDeleted(event.object_id, { supabaseClient })
    return { deleted: true }
  }

  if (event.aspect_type === 'create' || event.aspect_type === 'update') {
    const token = await getValidStravaAccessToken(env.DEFAULT_USER_ID || 'local-user', {
      supabaseClient,
      env,
      accountId: event.owner_id,
    })
    const activity = await fetchStravaActivity(event.object_id, token)
    await upsertStravaActivityToSupabase(activity, null, { supabaseClient, env })
    return { upserted: true }
  }

  return { skipped: true }
}

export function createStravaWebhookHandler({ supabaseClient = supabaseAdmin, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method === 'GET') {
      const challenge = getQueryValue(req, 'hub.challenge')
      const verifyToken = getQueryValue(req, 'hub.verify_token')
      if (verifyToken && verifyToken === env.STRAVA_VERIFY_TOKEN) {
        return res.status(200).json({ 'hub.challenge': challenge })
      }
      return res.status(403).json({ error: 'Invalid Strava verify token' })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!supabaseClient) {
      return res.status(500).json({ error: 'Supabase service role is unavailable' })
    }

    const event = normalizeEvent(req.body || {})
    let row
    try {
      row = await storeWebhookEvent(event, supabaseClient)
    } catch (err) {
      return res.status(500).json({ error: 'Failed to store Strava webhook event' })
    }

    if (env.STRAVA_WEBHOOK_PROCESS_INLINE === 'false') {
      return res.status(200).json({ ok: true, stored: true, processed: false })
    }

    try {
      await processStravaWebhookEvent(event, { supabaseClient, env })
      await markWebhookProcessed(row, supabaseClient, { processed: true, error: null })
      return res.status(200).json({ ok: true, stored: true, processed: true })
    } catch (err) {
      await markWebhookProcessed(row, supabaseClient, { processed: false, error: err.message })
      return res.status(200).json({ ok: true, stored: true, processed: false, warning: err.message })
    }
  }
}

export default createStravaWebhookHandler()
