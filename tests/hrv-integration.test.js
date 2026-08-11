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

  const zipPath = 'C:/Users/joshu_w0zb8cp/Downloads/Health Connect (1).zip'
  const buffer = await fs.readFile(zipPath)
  
  // Mock File API
  const file = {
    name: 'Health Connect (1).zip',
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
