import { useEffect, useState } from 'react'
import { getStravaStatus } from '../lib/healthDataApi.js'

function formatDistance(meters) {
  if (!meters) return '--'
  return `${(meters / 1000).toFixed(1)} km`
}

function formatHours(seconds) {
  if (!seconds) return '--'
  return `${(seconds / 3600).toFixed(1)} h`
}

function formatDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })
}

export default function StravaPanel() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setError('')
    const result = await getStravaStatus({ days: 90 })
    if (result.error) setError(result.error.message)
    setStatus(result.data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const sportTypes = status?.sportTypes || {}
  const sportSummary = Object.entries(sportTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([sport, count]) => `${sport}: ${count}`)
    .join(' / ')

  return (
    <section className="rounded-3xl border border-slate-border bg-ink-soft p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Strava</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Exercise-source sync</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-ui">
            Strava activities only, not total daily movement. Sleep, HRV baseline, resting HR, respiratory rate, weight, labs, and all-day steps still need Health Connect or manual imports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/strava/start"
            className="rounded-full border border-jade/20 bg-jade/10 px-4 py-2 text-sm font-medium text-jade transition hover:bg-jade/15"
          >
            Connect Strava
          </a>
          <a
            href="/api/strava/start?state=backfill90"
            className="rounded-full border border-slate-border bg-ink px-4 py-2 text-sm font-medium text-slate-ui transition hover:border-jade/30 hover:text-white"
          >
            Backfill 90 days
          </a>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-full border border-slate-border bg-ink px-4 py-2 text-sm font-medium text-slate-ui transition hover:border-white/10 hover:text-white disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Connection</p>
          <p className="mt-3 text-xl font-semibold text-white">{status?.connected ? 'Connected' : 'Not connected'}</p>
          <p className="mt-1 text-sm text-slate-ui">{status?.scope || 'OAuth required'}</p>
        </div>
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Activities</p>
          <p className="mt-3 text-3xl font-bold text-white">{status?.activityCount ?? '--'}</p>
          <p className="mt-1 text-sm text-slate-ui">last 90 days</p>
        </div>
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Distance</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatDistance(status?.totalDistanceM)}</p>
          <p className="mt-1 text-sm text-slate-ui">recorded workouts only</p>
        </div>
        <div className="rounded-3xl border border-slate-border bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-ui">Moving time</p>
          <p className="mt-3 text-3xl font-bold text-white">{formatHours(status?.totalMovingSeconds)}</p>
          <p className="mt-1 text-sm text-slate-ui">latest {formatDate(status?.latestActivityDate)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-border bg-ink p-4 text-sm text-slate-ui">
        <strong className="text-white">Activity types:</strong> {sportSummary || 'No Strava activity types synced yet.'}
        {typeof status?.heartRateActivities === 'number' && (
          <span className="block mt-2">Heart-rate activities: {status.heartRateActivities}</span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-3xl border border-crimson-health/20 bg-crimson-glow p-4 text-sm text-crimson-health">
          {error}
        </div>
      )}
    </section>
  )
}
