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
