import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateStats, normalizeHRV, groupOvernightHRV, calculateRollingBaselines } from '../src/lib/hrvStats.js'

test('calculateStats works correctly', (t) => {
  const values = [10, 20, 30, 40, 50]
  const stats = calculateStats(values)
  assert.equal(stats.min, 10)
  assert.equal(stats.max, 50)
  assert.equal(stats.median, 30)
  assert.equal(stats.q1, 20) // 5 * 0.25 = 1.25 -> index 1 -> 20
  assert.equal(stats.q3, 40) // 5 * 0.75 = 3.75 -> index 3 -> 40
  assert.equal(stats.iqr, 20)
  assert.equal(stats.count, 5)
})

test('normalizeHRV converts time to Sydney timezone', (t) => {
  // Midnight UTC on Jan 1 2026 is 11:00 AM Sydney time (AEDT, UTC+11)
  const utcDate = new Date('2026-01-01T00:00:00Z').getTime()
  const samples = [{ time: utcDate, heart_rate_variability_millis: 42 }]
  const norm = normalizeHRV(samples)
  assert.equal(norm.length, 1)
  assert.equal(norm[0].dateStr, '2026-01-01')
  assert.equal(norm[0].hrv, 42)
  assert.equal(norm[0].timestamp, utcDate)
})

test('groupOvernightHRV groups late night and early morning into morning date', (t) => {
  // Mock samples already normalized. 
  // Let's create timestamps that correspond to Sydney time.
  const createSample = (dateString, hrv) => ({
    timestamp: new Date(dateString).getTime(),
    hrv
  })

  const samples = [
    createSample('2026-08-01T21:00:00+10:00', 30), // Aug 1 9 PM -> Aug 2 Overnight
    createSample('2026-08-02T03:00:00+10:00', 50), // Aug 2 3 AM -> Aug 2 Overnight
    createSample('2026-08-02T12:00:00+10:00', 99), // Aug 2 Noon -> ignored by overnight
  ]

  const overnight = groupOvernightHRV(samples)
  assert.ok(overnight['2026-08-02'], 'Should have group for 2026-08-02')
  assert.equal(overnight['2026-08-02'].count, 2, 'Should only include the two overnight samples')
  assert.equal(overnight['2026-08-02'].min, 30)
  assert.equal(overnight['2026-08-02'].max, 50)
  assert.equal(overnight['2026-08-02'].median, 40)
})

test('calculateRollingBaselines', (t) => {
  const overnight = {
    '2026-08-01': { median: 10, count: 1 },
    '2026-08-02': { median: 20, count: 1 },
    '2026-08-03': { median: 30, count: 1 },
  }
  
  const baselines = calculateRollingBaselines(overnight)
  assert.equal(baselines['2026-08-01'].baseline, null) // No previous days
  assert.equal(baselines['2026-08-02'].baseline, 10)
  assert.equal(baselines['2026-08-02'].deviation, 10)
  
  assert.equal(baselines['2026-08-03'].baseline, 15) // Median of [10, 20] -> 15
  assert.equal(baselines['2026-08-03'].deviation, 15) // 30 - 15 = 15
})
