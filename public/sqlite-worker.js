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

function log(msg, status, pct) {
  self.postMessage({ type: 'progress', msg: msg, status: status || 'info', pct: pct != null ? pct : null })
}

self.onmessage = async function(e) {
  var buffer = e.data.buffer
  var fileName = e.data.fileName
  var fileSize = e.data.fileSize

  try {
    log('Step 2/4 — Loading sql.js library...', 'info', 26)

    var wasmPct = 26
    var wasmTimer = setInterval(function() {
      if (wasmPct < 43) {
        wasmPct += 1
        var kb = Math.round((wasmPct - 26) / 17 * 2800)
        log('Step 2/4 — Fetching WASM binary... (~' + kb + ' KB of ~2800 KB)', 'info', wasmPct)
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

    log('Step 3/4 — Opening SQLite database...', 'info', 46)
    log('Step 3/4 — Parsing ' + formatFileSize(fileSize) + ' database file... (this may take a while)', 'info', 47)

    var expectedOpenMs = Math.max(3000, fileSize / (1024 * 1024) * 900)
    var openPct = 47
    var openTimer = setInterval(function() {
      if (openPct < 64) {
        openPct += 1
        var estPct = Math.round((openPct - 47) / 17 * 100)
        log('Step 3/4 — Opening database... (~' + estPct + '% estimated)', 'info', openPct)
      }
    }, expectedOpenMs / 17)

    var startOpen = Date.now()
    var db = new sql.Database(new Uint8Array(buffer))
    clearInterval(openTimer)
    var openMs = Date.now() - startOpen
    log('Step 3/4 — Database opened in ' + (openMs / 1000).toFixed(1) + 's', 'info', 65)

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
          var sampleResult = db.exec('SELECT * FROM "' + table + '" LIMIT 5')
          if (sampleResult.length) {
            var cols = sampleResult[0].columns
            var rows = sampleResult[0].values
            output += 'Columns: ' + cols.join(', ') + '\n'
            output += 'Sample rows:\n'
            rows.forEach(function(row) {
              output += '  ' + row.map(function(v, ci) { return cols[ci] + '=' + v }).join(' | ') + '\n'
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
