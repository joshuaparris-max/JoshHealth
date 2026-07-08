import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import initSqlJs from 'sql.js'

function loadAnalyzer() {
  const source = fs.readFileSync(new URL('../public/health-connect-analyzer.js', import.meta.url), 'utf8')
  const sandbox = {}
  return new Function('globalThis', `${source}\nreturn globalThis.HealthConnectAnalyzer`)(sandbox)
}

test('Health Connect analyzer detects native tables and emits compact structured output', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  const analyzer = loadAnalyzer()
  const base = Date.parse('2026-01-01T10:00:00Z')

  db.run(`
    CREATE TABLE heart_rate_record_series_table (
      parent_key TEXT,
      beats_per_minute INTEGER,
      epoch_millis INTEGER
    );
    CREATE TABLE sleep_session_record_table (
      start_time_epoch_millis INTEGER,
      end_time_epoch_millis INTEGER
    );
    CREATE TABLE sleep_stage_record_table (
      start_time_epoch_millis INTEGER,
      end_time_epoch_millis INTEGER,
      stage_type TEXT
    );
    CREATE TABLE heart_rate_variability_rmssd_record_table (
      rmssd_millis REAL,
      time_epoch_millis INTEGER
    );
    CREATE TABLE respiratory_rate_record_table (
      breaths_per_minute REAL,
      time_epoch_millis INTEGER
    );
    CREATE TABLE steps_record_table (
      count INTEGER,
      start_time_epoch_millis INTEGER
    );
    CREATE TABLE total_calories_burned_record_table (
      energy REAL,
      start_time_epoch_millis INTEGER
    );
    CREATE TABLE weight_record_table (
      weight_grams REAL,
      time_epoch_millis INTEGER
    );
    CREATE TABLE body_fat_record_table (
      percentage REAL,
      time_epoch_millis INTEGER
    );
  `)

  const hr = db.prepare('INSERT INTO heart_rate_record_series_table VALUES (?, ?, ?)')
  for (let i = 0; i <= 10; i += 1) hr.run(['run-1', 120 + i, base + i * 60000])
  hr.free()

  const sleep = db.prepare('INSERT INTO sleep_session_record_table VALUES (?, ?)')
  sleep.run([Date.parse('2026-01-01T11:00:00Z'), Date.parse('2026-01-01T19:00:00Z')])
  sleep.run([Date.parse('2026-01-01T12:00:00Z'), Date.parse('2026-01-01T18:00:00Z')])
  sleep.free()

  const stage = db.prepare('INSERT INTO sleep_stage_record_table VALUES (?, ?, ?)')
  stage.run([Date.parse('2026-01-01T11:00:00Z'), Date.parse('2026-01-01T12:00:00Z'), 'awake'])
  stage.run([Date.parse('2026-01-01T12:00:00Z'), Date.parse('2026-01-01T14:00:00Z'), 'deep'])
  stage.run([Date.parse('2026-01-01T14:00:00Z'), Date.parse('2026-01-01T16:00:00Z'), 'rem'])
  stage.free()

  const hrv = db.prepare('INSERT INTO heart_rate_variability_rmssd_record_table VALUES (?, ?)')
  hrv.run([42.5, base])
  hrv.free()

  const respiratory = db.prepare('INSERT INTO respiratory_rate_record_table VALUES (?, ?)')
  respiratory.run([15.2, base])
  respiratory.free()

  const steps = db.prepare('INSERT INTO steps_record_table VALUES (?, ?)')
  steps.run([4200, base])
  steps.run([3900, base + 1000])
  steps.free()

  const calories = db.prepare('INSERT INTO total_calories_burned_record_table VALUES (?, ?)')
  calories.run([2300, base])
  calories.free()

  const weight = db.prepare('INSERT INTO weight_record_table VALUES (?, ?)')
  weight.run([82000, base])
  weight.free()

  const fat = db.prepare('INSERT INTO body_fat_record_table VALUES (?, ?)')
  fat.run([0, base])
  fat.run([24.5, base + 86400000])
  fat.free()

  const result = analyzer.analyze(db, { timeZone: 'Australia/Sydney' })

  assert.ok(result.detected_tables.includes('heart_rate_record_series_table'))
  assert.deepEqual(result.heart_rate.sample_columns, ['parent_key', 'beats_per_minute', 'epoch_millis'])
  assert.equal(result.heart_rate.samples, 11)
  assert.equal(result.heart_rate.elevated_episodes.length, 1)
  assert.equal(result.sleep.nights, 1)
  assert.equal(result.sleep.nightly[0].asleep_min, 480)
  assert.equal(result.sleep.nightly[0].awake_min, 60)
  assert.equal(result.sleep.nightly[0].deep_min, 120)
  assert.equal(result.sleep.nightly[0].rem_min, 120)
  assert.equal(result.steps.daily[0].value, 4200)
  assert.equal(result.calories.value_column, 'energy')
  assert.equal(result.hrv_rmssd.value_column, 'rmssd_millis')
  assert.equal(result.respiratory_rate.value_column, 'breaths_per_minute')
  assert.equal(result.weight.rows, 1)
  assert.equal(result.body_fat.rows, 1)
  assert.ok(result.text.includes('HEALTH_CONNECT_DEEP_ANALYSIS_JSON_START'))

  db.close()
})
