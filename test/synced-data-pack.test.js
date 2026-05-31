import test from 'node:test'
import assert from 'node:assert'
import { buildSyncedDataPack } from '../src/lib/syncedDataPack.js'

test('buildSyncedDataPack creates an evidence pack from Supabase rows', () => {
  const pack = buildSyncedDataPack([
    { date: '2026-05-30', steps: 0, sleep_minutes: 0, hrv_rmssd: 40, warnings_json: ['rest day'] },
    { date: '2026-05-31', steps: 8000, sleep_minutes: 420, hrv_rmssd: 44 },
  ], {
    selectedDays: 7,
    stravaStatus: {
      connected: true,
      scope: 'read,activity:read',
      activityCount: 2,
      latestActivityDate: '2026-05-31T06:00:00Z',
      totalDistanceM: 22000,
      totalMovingSeconds: 5400,
      sportTypes: { Ride: 1, Walk: 1 },
      heartRateActivities: 1,
    },
  })

  assert.equal(pack.name, 'supabase-synced-data-7d.md')
  assert.equal(pack.type, 'supabase')
  assert.match(pack.summary, /DATA PACK: SUPABASE SYNCED DAILY HEALTH SUMMARY/)
  assert.match(pack.summary, /steps: 8000/)
  assert.match(pack.summary, /2026-05-30, 0, 0/)
  assert.match(pack.summary, /rest day/)
  assert.match(pack.summary, /STRAVA EXERCISE SOURCE/)
  assert.match(pack.summary, /Strava is exercise\/activity evidence only/)
  assert.match(pack.summary, /Do not use Strava activity data as evidence for sleep/)
})

test('buildSyncedDataPack handles empty rows', () => {
  const pack = buildSyncedDataPack([], { selectedDays: 30 })

  assert.equal(pack.name, 'supabase-synced-data-30d.md')
  assert.match(pack.summary, /No synced health data/)
})
