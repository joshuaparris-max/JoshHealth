import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { importHealthConnectFile } from '../src/lib/healthConnectImporter.js'
import db from '../src/lib/db.js'

test('Integration: Import ZIP into IndexedDB', async (t) => {
  // Clear DB
  await db.health_imports.clear()
  await db.heart_metrics.clear()
  await db.sleep_sessions.clear()
  await db.health_sources.clear()

  // Generate Synthetic Test Fixture
  const JSZip = (await import('jszip')).default
  const initSqlJs = (await import('sql.js')).default
  
  const sql = await initSqlJs()
  const dbSql = new sql.Database()
  
  dbSql.run(`CREATE TABLE heart_rate_variability_rmssd_record_table (
    uuid BLOB, time INTEGER, heart_rate_variability_millis REAL, client_record_id TEXT
  )`)
  dbSql.run(`CREATE TABLE resting_heart_rate_record_table (
    uuid BLOB, time INTEGER, beats_per_minute INTEGER, client_record_id TEXT
  )`)
  
  // Insert synthetic data
  dbSql.run(`INSERT INTO heart_rate_variability_rmssd_record_table VALUES (?, ?, ?, ?)`, [new Uint8Array(16), Date.now(), 45.2, 'test-hrv'])
  dbSql.run(`INSERT INTO resting_heart_rate_record_table VALUES (?, ?, ?, ?)`, [new Uint8Array(16), Date.now(), 60, 'test-rhr'])
  
  const dbData = dbSql.export()
  dbSql.close()

  const zip = new JSZip()
  zip.file('health_connect.db', dbData)
  const buffer = await zip.generateAsync({ type: 'uint8array' })

  // Mock File API
  const file = {
    name: 'Synthetic_Health_Connect.zip',
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  // Act: Import the ZIP
  const result = await importHealthConnectFile(file, (msg) => console.log('[Test Log]', msg))
  
  // Assert: Imports recorded
  assert.ok(result.importId > 0)
  assert.ok(result.hrvCount > 0)
  
  const heartMetrics = await db.heart_metrics.toArray()
  assert.equal(heartMetrics.length, result.hrvCount + result.rhrCount)

  // Medians are no longer precalculated during import

  // Verify Re-import deduplicates
  const result2 = await importHealthConnectFile(file, () => {})
  const importsCount = await db.health_imports.count()
  assert.equal(importsCount, 1, "Should only have 1 import record after deduplication")
  
  const heartMetrics2 = await db.heart_metrics.toArray()
  assert.equal(heartMetrics2.length, result.hrvCount + result.rhrCount, "Metrics count should not double")
})
