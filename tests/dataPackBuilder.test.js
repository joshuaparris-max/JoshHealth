import test from 'node:test'
import assert from 'node:assert'
import { buildStructuredDataPack } from '../src/lib/dataPackBuilder.js'

test('dataPackBuilder: correctly inventories files and metrics', (t) => {
  const mockFiles = [
    {
      name: 'test_health.db',
      type: 'db',
      size: 1024,
      summary: 'HEALTH CONNECT EXPORT\nTotal rows: 150\n- Steps: avg ~5000'
    }
  ]

  const output = buildStructuredDataPack(mockFiles)
  
  assert.ok(output.includes('test_health.db'), 'Should include filename')
  assert.ok(output.includes('Records: 150'), 'Should include row count')
  assert.ok(output.includes('Steps: sample average 5000'), 'Should include metric average')
  assert.ok(output.includes('DETERMINISTIC DATA INVENTORY'), 'Should include section header')
})

test('dataPackBuilder: handles empty summary gracefully', (t) => {
  const mockFiles = [
    {
      name: 'empty.txt',
      type: 'txt',
      size: 100,
      summary: ''
    }
  ]

  const output = buildStructuredDataPack(mockFiles)
  assert.ok(output.includes('empty.txt'), 'Should still include filename')
})

test('dataPackBuilder: preserves structured Health Connect deep analysis JSON', (t) => {
  const analysis = {
    schema: 'health-connect-deep-analysis/v1',
    detected_tables: ['heart_rate_record_series_table'],
    heart_rate: { samples: 11, days: 1, elevated_episodes: [{ duration_min: 10 }] },
    sleep: { nights: 1 },
  }
  const mockFiles = [
    {
      name: 'health_connect.db',
      type: 'db',
      size: 2048,
      summary: `=== Health Connect Deep Analysis ===
HEALTH_CONNECT_DEEP_ANALYSIS_JSON_START
${JSON.stringify(analysis)}
HEALTH_CONNECT_DEEP_ANALYSIS_JSON_END`
    }
  ]

  const output = buildStructuredDataPack(mockFiles)

  assert.ok(output.includes('STRUCTURED HEALTH CONNECT DEEP ANALYSIS JSON'))
  assert.ok(output.includes('"schema": "health-connect-deep-analysis/v1"'))
  assert.ok(output.includes('HR samples: 11'))
})
