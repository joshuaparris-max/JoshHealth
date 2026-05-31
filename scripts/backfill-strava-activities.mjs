import {
  fetchStravaActivities,
  fetchStravaActivity,
  fetchStravaActivityStreams,
  getValidStravaAccessToken,
  upsertStravaActivityToSupabase,
} from '../api/lib/stravaClient.js'

function argValue(name) {
  const prefix = `${name}=`
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name)
}

function epochFromInput() {
  const afterArg = argValue('--after')
  if (afterArg) return Math.floor(new Date(afterArg).getTime() / 1000)
  const days = Number(argValue('--days') || 90)
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
}

async function main() {
  const accountId = argValue('--account') || process.env.STRAVA_ACCOUNT_ID || undefined
  const perPage = Math.min(Number(argValue('--per-page') || 50), 100)
  const maxPages = Number(argValue('--max-pages') || 10)
  const fetchStreams = hasFlag('--streams')
  const userId = process.env.DEFAULT_USER_ID || 'local-user'
  const accessToken = await getValidStravaAccessToken(userId, { accountId })
  const after = epochFromInput()
  let synced = 0
  let skipped = 0

  for (let page = 1; page <= maxPages; page += 1) {
    const activities = await fetchStravaActivities({ after, page, perPage, accessToken })
    if (!Array.isArray(activities) || activities.length === 0) break

    for (const summary of activities) {
      try {
        const detail = await fetchStravaActivity(summary.id, accessToken)
        const streams = fetchStreams
          ? await fetchStravaActivityStreams(summary.id, ['heartrate', 'distance', 'time'], accessToken).catch(() => null)
          : null
        await upsertStravaActivityToSupabase(detail, streams)
        synced += 1
      } catch (err) {
        skipped += 1
        console.warn(`Skipped Strava activity ${summary.id}: ${err.message}`)
      }
    }

    if (activities.length < perPage) break
  }

  console.log(JSON.stringify({
    ok: true,
    after,
    synced,
    skipped,
    streamsFetched: fetchStreams,
  }, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
