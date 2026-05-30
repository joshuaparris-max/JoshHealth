// SQLite Web Worker — runs sql.js off the main thread
// Receives: { type: 'parse', buffer: ArrayBuffer, fileName: string, fileSize: number }
// Posts:    { type: 'progress', msg, status, pct }
//           { type: 'done', content }
//           { type: 'error', message }

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function truncate(text, maxChars) {
  if (!text || text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[...truncated — ' + (text.length - maxChars) + ' chars omitted...]'
}

function log(msg, status, pct, id) {
  self.postMessage({ type: 'progress', msg: msg, status: status || 'info', pct: pct != null ? pct : null, id: id })
}

self.onmessage = async function(e) {
  var buffer = e.data.buffer
  var fileName = e.data.fileName
  var fileSize = e.data.fileSize

  try {
    log('Step 2/4 — Loading sql.js library...', 'info', 26, 'wasm-load')

    var wasmPct = 26
    var wasmTimer = setInterval(function() {
      if (wasmPct < 43) {
        wasmPct += 1
        var kb = Math.round((wasmPct - 26) / 17 * 2800)
        log('Step 2/4 — Fetching WASM binary... (~' + kb + ' KB of ~2800 KB)', 'info', wasmPct, 'wasm-load')
      }
    }, 180)

    var startWasm = Date.now()

    importScripts('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js')
    var sql = await initSqlJs({
      locateFile: function() { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm' }
    })

    clearInterval(wasmTimer)
    var wasmMs = Date.now() - startWasm
    log('Step 2/4 — WASM loaded in ' + (wasmMs / 1000).toFixed(1) + 's', 'info', 45)

    log('Step 3/4 — Opening SQLite database...', 'info', 46, 'db-open')
    log('Step 3/4 — Parsing ' + formatFileSize(fileSize) + ' database file... (this may take a while)', 'info', 47, 'db-open')

    var expectedOpenMs = Math.max(3000, fileSize / (1024 * 1024) * 900)
    var openPct = 47
    var openTimer = setInterval(function() {
      if (openPct < 64) {
        openPct += 1
        var estPct = Math.round((openPct - 47) / 17 * 100)
        log('Step 3/4 — Opening database... (~' + estPct + '% estimated)', 'info', openPct, 'db-open')
      }
    }, expectedOpenMs / 17)

    var startOpen = Date.now()
    var db = new sql.Database(new Uint8Array(buffer))
    clearInterval(openTimer)
    var openMs = Date.now() - startOpen
    log('Step 3/4 — Database opened in ' + (openMs / 1000).toFixed(1) + 's', 'info', 65, 'db-open')

    log('Step 4/4 — Querying table list...', 'info', 66)
    var tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")

    if (!tablesResult.length) {
      log('No tables found in database', 'warn', 100)
      db.close()
      self.postMessage({ type: 'done', content: 'SQLite DB: ' + fileName + '\nNo tables found.' })
      return
    }

    var tables = tablesResult[0].values.map(function(r) { return r[0] })
    var toRead = tables.slice(0, 20)
    var tablePreview = toRead.slice(0, 6).join(', ') + (tables.length > 6 ? ' +' + (tables.length - 6) + ' more' : '')
    log('Step 4/4 — Found ' + tables.length + ' table' + (tables.length !== 1 ? 's' : '') + ': ' + tablePreview, 'info', 68)

    var output = 'SQLITE DB: ' + fileName + '\nTables (' + tables.length + '): ' + tables.join(', ') + '\n\n'

    for (var i = 0; i < toRead.length; i++) {
      var table = toRead[i]
      var pct = 68 + Math.round((i / toRead.length) * 28)
      log('Step 4/4 — [' + (i + 1) + '/' + toRead.length + '] Reading table: ' + table, 'info', pct)

      try {
        var countResult = db.exec('SELECT COUNT(*) FROM "' + table + '"')
        var count = countResult[0] && countResult[0].values[0] ? countResult[0].values[0][0] : 0
        output += 'TABLE: ' + table + ' — ' + count.toLocaleString() + ' rows\n'

        if (count > 0) {
          // Get schema to find dates and numbers
          var infoResult = db.exec('PRAGMA table_info("' + table + '")')
          var cols = infoResult[0].values.map(function(c) { return { name: c[1], type: c[2].toUpperCase() } })
          
          var dateCols = cols.filter(function(c) { 
            var n = c.name.toLowerCase()
            return n.indexOf('time') !== -1 || n.indexOf('date') !== -1 || n.indexOf('stamp') !== -1
          })
          
          var numCols = cols.filter(function(c) {
            var t = c.type
            var n = c.name.toLowerCase()
            return (t.indexOf('INT') !== -1 || t.indexOf('FLOAT') !== -1 || t.indexOf('REAL') !== -1 || t.indexOf('NUM') !== -1) 
                   && n.indexOf('id') === -1 && n !== 'version'
          })

          // Build aggregate query
          var aggs = []
          dateCols.forEach(function(c) { 
            aggs.push('MIN("' + c.name + '") as min_' + c.name)
            aggs.push('MAX("' + c.name + '") as max_' + c.name)
          })
          numCols.slice(0, 5).forEach(function(c) { // Limit to 5 numeric aggs to keep query fast
            aggs.push('AVG("' + c.name + '") as avg_' + c.name)
          })

          if (aggs.length > 0) {
            try {
              var aggResult = db.exec('SELECT ' + aggs.join(', ') + ' FROM "' + table + '"')
              if (aggResult.length) {
                output += 'Summary Stats:\n'
                aggResult[0].columns.forEach(function(col, ci) {
                  var val = aggResult[0].values[0][ci]
                  output += '  ' + col + ': ' + (typeof val === 'number' ? val.toFixed(2) : val) + '\n'
                })
              }
            } catch (aggErr) {
              // Fallback if aggregation fails
            }
          }

          // Still provide a small sample for context
          var sampleResult = db.exec('SELECT * FROM "' + table + '" LIMIT 3')
          if (sampleResult.length) {
            output += 'Sample rows:\n'
            var sampleCols = sampleResult[0].columns
            sampleResult[0].values.forEach(function(row) {
              output += '  ' + row.map(function(v, ci) { return sampleCols[ci] + '=' + v }).join(' | ') + '\n'
            })
          }
        }
        output += '\n'
      } catch (tableErr) {
        log('Table ' + table + ' error: ' + tableErr.message, 'warn', pct)
        output += 'TABLE: ' + table + ' — [error: ' + tableErr.message + ']\n\n'
      }
    }

    db.close()
    var finalContent = truncate(output, 15000)
    log('Done — ' + toRead.length + ' table' + (toRead.length !== 1 ? 's' : '') + ' read, ' + finalContent.length.toLocaleString() + ' chars extracted', 'success', 100)
    self.postMessage({ type: 'done', content: finalContent })

  } catch (err) {
    log('SQLite parse failed: ' + err.message, 'error', 100)
    self.postMessage({ type: 'error', message: err.message })
  }
}
