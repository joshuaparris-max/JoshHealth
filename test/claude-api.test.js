import test from 'node:test'
import assert from 'node:assert'
import { buildStructuredDataPack } from '../src/lib/dataPackBuilder.js'

test('buildStructuredDataPack includes file evidence', () => {
  const bigSummary = 'DATA PACK LINE\n'.repeat(100)
  const block = buildStructuredDataPack([
    {
      name: 'health_connect_export.db',
      type: 'db',
      size: 1024,
      summary: bigSummary,
    },
  ])

  assert.match(block, /health_connect_export\.db/)
})
