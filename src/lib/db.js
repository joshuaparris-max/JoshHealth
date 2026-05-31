import Dexie from 'dexie'
import { HEALTH_SCHEMA, SOURCE_PRIORITY } from './schema.js'

const db = new Dexie('HealthLensDB')

// Map HEALTH_SCHEMA to Dexie stores with basic primary keys
db.version(2).stores({
  health_sources: '++id, name, type, priority',
  health_imports: '++id, source_id, file_name, file_hash, imported_at, date_range_start, date_range_end, status',
  daily_health_summary: 'date, timezone, source_confidence',
  sleep_sessions: '++id, start_time, end_time, source_id, import_id',
  heart_metrics: '++id, timestamp_or_date, metric_type, source_id, import_id',
  body_measurements: '++id, timestamp_or_date, metric_type, source_id, import_id',
  exercise_sessions: '++id, start_time, end_time, activity_type, source_id, import_id',
  lab_results: '++id, collection_date, report_date, test_name, source_file, source_id, import_id',
  daily_context_tags: 'date',
  analysis_history: '++id, date, model, modes, question'
})

export default db

// Convenience helpers
export const saveAnalysis = async (analysis) => {
  return db.analysis_history.add({
    ...analysis,
    date: new Date().toISOString()
  })
}

export const getAnalysisHistory = async () => {
  return db.analysis_history.orderBy('date').reverse().toArray()
}

export const clearAllLocalData = async () => {
  return Promise.all(db.tables.map(table => table.clear()))
}

export const addSource = async (source) => {
  const id = await db.health_sources.add(source)
  return id
}

export const addImport = async (imp) => {
  const id = await db.health_imports.add(imp)
  return id
}

export const bulkInsertSummaries = async (summaries) => {
  return db.transaction('rw', db.daily_health_summary, async () => {
    for (const summary of summaries) {
      const existing = await db.daily_health_summary.get(summary.date)
      if (existing) {
        // Resolve priority
        // If the new source is higher priority than existing, overwrite
        const metrics = Object.keys(SOURCE_PRIORITY)
        const updated = { ...existing }
        let changed = false

        metrics.forEach(metric => {
          if (summary[metric] !== undefined && summary[metric] !== null) {
            const priorityList = SOURCE_PRIORITY[metric] || []
            const newSourceIdx = priorityList.indexOf(summary.source_id)
            const oldSourceIdx = priorityList.indexOf(existing.source_id)

            // Lower index = higher priority
            if (oldSourceIdx === -1 || (newSourceIdx !== -1 && newSourceIdx <= oldSourceIdx)) {
              updated[metric] = summary[metric]
              changed = true
            }
          }
        })

        if (changed) {
          updated.source_id = summary.source_id // Update to the new "winner" source if many metrics changed
          await db.daily_health_summary.put(updated)
        }
      } else {
        await db.daily_health_summary.add(summary)
      }
    }
  })
}

export const bulkInsertSleep = async (rows) => {
  return db.sleep_sessions.bulkAdd(rows)
}

export const bulkInsertHeart = async (rows) => {
  return db.heart_metrics.bulkAdd(rows)
}
