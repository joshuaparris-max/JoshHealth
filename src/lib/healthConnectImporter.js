import initSqlJs from 'sql.js'
import db, { addSource, addImport, bulkPutHeart, bulkInsertSleep } from './db.js'
import { startTimer, endTimer, clearPerfLog } from './perf.js'

function buf2hex(buffer) {
  if (!buffer) return ''
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateStableId(parts) {
  return parts.join('_')
}

function yieldToEventLoop() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function importHealthConnectFile(file, onProgress, signal) {
  let importId = null
  let dbSql = null
  let sourceId = null
  clearPerfLog()
  
  try {
    startTimer('Full Import')
    onProgress('Reading file...')
    startTimer('Reading file bytes')
    const arrayBuffer = await file.arrayBuffer()
    endTimer('Reading file bytes')

    if (signal?.aborted) throw new Error('Cancelled')

    onProgress('Generating file hash...')
    startTimer('SHA-256 hashing')
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const fileHash = buf2hex(hashBuffer)
    endTimer('SHA-256 hashing', { fileHash })
    
    // 2. Deduplication check
    startTimer('IndexedDB lookup/deduplication')
    const existingImports = await db.health_imports.where('file_hash').equals(fileHash).toArray()
    const completedImport = existingImports.find(i => i.status === 'completed')
    endTimer('IndexedDB lookup/deduplication')

    if (completedImport) {
      onProgress('Exact duplicate export detected. Skipping import.')
      return { status: 'skipped', reason: 'Duplicate export skipped', importId: completedImport.id }
    }

    if (signal?.aborted) throw new Error('Cancelled')

    sourceId = await addSource({ name: 'Health Connect', type: 'health_connect', priority: 1, notes: '' })
    
    importId = await addImport({ 
      source_id: sourceId, 
      file_name: file.name, 
      file_hash: fileHash, 
      imported_at: new Date().toISOString(), 
      status: 'processing', 
      record_count: 0 
    })

    onProgress('Loading JSZip library...')
    const JSZip = (await import('jszip')).default
    
    startTimer('ZIP extraction')
    const zip = await JSZip.loadAsync(arrayBuffer)
    const fileList = Object.keys(zip.files)
    const dbFile = fileList.find(f => f.toLowerCase().endsWith('.db'))
    
    if (!dbFile) {
      throw new Error('Could not find a .db file inside the Health Connect ZIP.')
    }

    if (signal?.aborted) throw new Error('Cancelled')

    onProgress(`Extracting ${dbFile} from ZIP...`)
    const dbArrayBuffer = await zip.files[dbFile].async('arraybuffer')
    endTimer('ZIP extraction')

    onProgress('Initializing SQLite engine...')
    startTimer('Loading sql.js WASM')
    const isNode = typeof process !== 'undefined' && process.release && process.release.name === 'node';
    const wasmUrl = isNode ? 'node_modules/sql.js/dist/sql-wasm.wasm' : '/sql-wasm.wasm';
    const sql = await initSqlJs({ locateFile: () => wasmUrl })
    endTimer('Loading sql.js WASM')

    if (signal?.aborted) throw new Error('Cancelled')

    onProgress('Opening SQLite DB...')
    startTimer('Opening SQLite')
    dbSql = new sql.Database(new Uint8Array(dbArrayBuffer))
    endTimer('Opening SQLite')
    
    const tablesRes = dbSql.exec("SELECT name FROM sqlite_master WHERE type='table'")
    const tables = tablesRes.length ? tablesRes[0].values.map(r => r[0]) : []
    
    let totalHrv = 0
    let totalRhr = 0
    let totalSleepRows = 0
    
    // 3. Extract HRV
    if (tables.includes('heart_rate_variability_rmssd_record_table')) {
      onProgress('Extracting HRV records (RMSSD)...')
      const schemaRes = dbSql.exec("PRAGMA table_info(heart_rate_variability_rmssd_record_table)")
      const columns = schemaRes[0].values.map(r => r[1])
      const hasAppInfo = columns.includes('app_info_id')
      
      const query = hasAppInfo ? 
        `SELECT uuid, time, heart_rate_variability_millis, client_record_id, app_info_id FROM heart_rate_variability_rmssd_record_table` :
        `SELECT uuid, time, heart_rate_variability_millis, client_record_id FROM heart_rate_variability_rmssd_record_table`;
      
      startTimer('Querying HRV rows')
      const stmt = dbSql.prepare(query)
      let chunk = []
      const CHUNK_SIZE = 50000
      let chunkCounter = 0
      
      while (stmt.step()) {
        if (signal?.aborted) throw new Error('Cancelled')
        const r = stmt.get()
        const uuidHex = buf2hex(r[0])
        const timeMs = r[1]
        const val = r[2]
        const clientId = r[3] || ''
        const appInfo = hasAppInfo ? (r[4] || '') : ''
        
        // Use fast string concatenation for ID
        const stableId = uuidHex + '_' + clientId + '_hrv_sample_' + timeMs + '_' + val + '_' + appInfo
        
        chunk.push({
           source_record_id: stableId,
           timestamp_or_date: new Date(timeMs).toISOString(),
           metric_type: 'hrv_sample',
           value: val,
           unit: 'ms',
           source_id: sourceId,
           import_id: importId,
           // stringify only needed fields directly
           raw_json: '{"original_ms":' + timeMs + (hasAppInfo ? ',"app_info_id":"' + appInfo + '"' : '') + '}'
        })
        
        if (chunk.length >= CHUNK_SIZE) {
          chunkCounter++
          onProgress(`Saving HRV chunk ${chunkCounter}...`)
          startTimer(`bulkPutHeart chunk ${chunkCounter}`)
          await bulkPutHeart(chunk)
          endTimer(`bulkPutHeart chunk ${chunkCounter}`)
          totalHrv += chunk.length
          chunk = []
          await yieldToEventLoop()
        }
      }
      
      if (chunk.length > 0) {
        chunkCounter++
        onProgress(`Saving HRV chunk ${chunkCounter}...`)
        startTimer(`bulkPutHeart chunk ${chunkCounter}`)
        await bulkPutHeart(chunk)
        endTimer(`bulkPutHeart chunk ${chunkCounter}`)
        totalHrv += chunk.length
      }
      stmt.free()
      endTimer('Querying HRV rows', { rows: totalHrv })
      await yieldToEventLoop()
    }

    // 4. Extract Resting HR
    if (tables.includes('resting_heart_rate_record_table')) {
      onProgress('Extracting Resting Heart Rate records...')
      const schemaRes = dbSql.exec("PRAGMA table_info(resting_heart_rate_record_table)")
      const columns = schemaRes[0].values.map(r => r[1])
      const hasAppInfo = columns.includes('app_info_id')
      
      const query = hasAppInfo ? 
        `SELECT uuid, time, beats_per_minute, client_record_id, app_info_id FROM resting_heart_rate_record_table` :
        `SELECT uuid, time, beats_per_minute, client_record_id FROM resting_heart_rate_record_table`;
      
      startTimer('Querying RHR rows')
      const stmt = dbSql.prepare(query)
      let chunk = []
      const CHUNK_SIZE = 50000
      let chunkCounter = 0
      
      while (stmt.step()) {
        if (signal?.aborted) throw new Error('Cancelled')
        const r = stmt.get()
        const uuidHex = buf2hex(r[0])
        const timeMs = r[1]
        const val = r[2]
        const clientId = r[3] || ''
        const appInfo = hasAppInfo ? (r[4] || '') : ''
        
        const stableId = uuidHex + '_' + clientId + '_resting_hr_' + timeMs + '_' + val + '_' + appInfo
        
        chunk.push({
           source_record_id: stableId,
           timestamp_or_date: new Date(timeMs).toISOString(),
           metric_type: 'resting_hr',
           value: val,
           unit: 'bpm',
           source_id: sourceId,
           import_id: importId,
           raw_json: '{"beats_per_minute":' + val + (hasAppInfo ? ',"app_info_id":"' + appInfo + '"' : '') + '}'
        })
        
        if (chunk.length >= CHUNK_SIZE) {
          chunkCounter++
          onProgress(`Saving RHR chunk ${chunkCounter}...`)
          startTimer(`bulkPutHeart chunk RHR ${chunkCounter}`)
          await bulkPutHeart(chunk)
          endTimer(`bulkPutHeart chunk RHR ${chunkCounter}`)
          totalRhr += chunk.length
          chunk = []
          await yieldToEventLoop()
        }
      }
      if (chunk.length > 0) {
        chunkCounter++
        onProgress(`Saving RHR chunk ${chunkCounter}...`)
        startTimer(`bulkPutHeart chunk RHR ${chunkCounter}`)
        await bulkPutHeart(chunk)
        endTimer(`bulkPutHeart chunk RHR ${chunkCounter}`)
        totalRhr += chunk.length
      }
      stmt.free()
      endTimer('Querying RHR rows', { rows: totalRhr })
      await yieldToEventLoop()
    }

    // 5. Extract Sleep
    if (tables.includes('sleep_session_record_table')) {
      onProgress('Extracting Sleep records...')
      startTimer('Querying Sleep rows')
      const stmt = dbSql.prepare(`SELECT uuid, start_time, end_time, client_record_id FROM sleep_session_record_table`)
      let chunk = []
      while (stmt.step()) {
        const r = stmt.get()
        const uuidHex = buf2hex(r[0])
        const startMs = r[1]
        const endMs = r[2]
        const clientId = r[3] || ''
        const duration = (endMs - startMs) / 60000
        const stableId = uuidHex + '_' + clientId + '_sleep_' + startMs + '_' + endMs
        
        chunk.push({
          source_record_id: stableId,
          start_time: startMs ? new Date(startMs).toISOString() : null, 
          end_time: endMs ? new Date(endMs).toISOString() : null, 
          duration_minutes: duration, 
          source_id: sourceId, 
          import_id: importId, 
          raw_json: '{}' 
        })
      }
      if (chunk.length > 0) {
        await bulkInsertSleep(chunk)
        totalSleepRows += chunk.length
      }
      stmt.free()
      endTimer('Querying Sleep rows', { rows: totalSleepRows })
    }
    
    startTimer('Final import-history update')
    const summaryStr = `Import complete! ${totalHrv} HRV records, ${totalRhr} RHR records, ${totalSleepRows} sleep sessions upserted.`
    onProgress(summaryStr)
    
    // Mark import complete
    await db.health_imports.update(importId, { status: 'completed', record_count: totalHrv + totalRhr + totalSleepRows })
    endTimer('Final import-history update')
    endTimer('Full Import')
    
    return { status: 'success', sourceId, importId, hrvCount: totalHrv, rhrCount: totalRhr, sleepRowsCount: totalSleepRows, summary: summaryStr }

  } catch (error) {
    console.error('IMPORTER ERROR:', error);
    if (importId) {
       await db.health_imports.update(importId, { status: error.message === 'Cancelled' ? 'cancelled' : 'failed' })
    }
    if (dbSql) {
       dbSql.close()
    }
    throw error
  }
}
