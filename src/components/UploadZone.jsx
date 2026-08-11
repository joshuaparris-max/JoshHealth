import { useCallback, useRef, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { formatFileSize, parseFile } from '../lib/fileParser.js'

const TYPE_ICONS = {
  csv: 'dY"S', json: 'dY"-', pdf: 'dY",', zip: 'dY-o,?', db: 'dY-,?',
  txt: 'dY"?', md: 'dY"?', xml: 'dY"-'
}

const TYPE_COLORS = {
  csv: 'text-jade', json: 'text-amber-health', pdf: 'text-crimson-health',
  zip: 'text-purple-400', db: 'text-blue-400', txt: 'text-slate-ui', md: 'text-slate-ui'
}

const STATUS_COLOR = {
  info:    'text-slate-ui',
  success: 'text-jade',
  warn:    'text-amber-health',
  error:   'text-crimson-health',
}

const STATUS_ICON = {
  info:    'A',
  success: 'o"',
  warn:    's',
  error:   'o-',
}

function LogPanel({ parseLog, onCancel, parsing, importSummary }) {
  const scrollRef = useRef(null)
  const lastEntry = parseLog[parseLog.length - 1]

  const handleScroll = () => {
    // optional user-scroll detach logic could go here
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [parseLog])

  return (
    <div className="space-y-4 animate-fade-in" data-testid="import-status">
      <div className="flex justify-between items-center text-sm">
        <h4 className="text-white font-medium">Import Progress</h4>
        {parsing && (
          <button 
            onClick={onCancel}
            className="text-crimson-health hover:bg-crimson-health/10 px-2 py-1 rounded text-xs transition"
          >
            Cancel Import
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-ink rounded-xl border border-slate-border/50 p-3 space-y-1 h-52 overflow-y-auto font-mono text-xs"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {parseLog.length === 0 && (
          <span className="text-slate-ui/40">Waiting for output...</span>
        )}
        {parseLog.map((entry, i) => {
          const isLast = i === parseLog.length - 1
          return (
            <div
              key={i}
              className={`flex items-start gap-2 leading-relaxed ${
                isLast ? 'opacity-100' : 'opacity-45'
              }`}
            >
              <span className="text-slate-ui/40 flex-shrink-0 w-8 text-right tabular-nums">
                {entry.pct != null ? `${Math.round(entry.pct)}%` : ''}
              </span>
              <span className={`flex-shrink-0 ${STATUS_COLOR[entry.status] || 'text-slate-ui'}`}>
                {STATUS_ICON[entry.status] || 'A'}
              </span>
              <span className={`break-all ${STATUS_COLOR[entry.status] || 'text-slate-ui'}`}>
                {entry.msg}
              </span>
              {isLast && entry.status === 'info' && (
                <span className="text-jade animate-pulse flex-shrink-0">-O</span>
              )}
            </div>
          )
        })}
      </div>

      {importSummary && (
        <div className="bg-jade/10 border border-jade/30 p-4 rounded-xl" data-testid="import-summary">
          <h4 className="text-jade font-semibold mb-1">Import Completed Successfully</h4>
          <p className="text-sm text-slate-ui">{importSummary}</p>
        </div>
      )}
    </div>
  )
}

export default function UploadZone({ onFilesParsed }) {
  const [parsing, setParsing] = useState(false)
  const [parseLog, setParseLog] = useState([])
  const [importSummary, setImportSummary] = useState(null)
  const abortControllerRef = useRef(null)

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    setParsing(true)
    setParseLog([])
    setImportSummary(null)
    
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const log = (payload, fallbackStatus = 'info', fallbackPct = null) => {
      if (typeof payload === 'object' && payload !== null) {
        setParseLog(prev => [...prev, { msg: payload.msg, status: payload.status || fallbackStatus, pct: payload.pct || fallbackPct, ts: Date.now() }])
      } else {
        setParseLog(prev => [...prev, { msg: payload, status: fallbackStatus, pct: fallbackPct, ts: Date.now() }])
      }
    }

    try {
      const results = []
      for (const file of acceptedFiles) {
        if (signal.aborted) break
        
        log(`Preparing ${file.name}...`, 'info', 0)
        
        try {
          const result = await parseFile(file, log, signal)
          results.push(result)
          
          if (result.summary && !result.error) {
             setImportSummary(result.summary)
             // The playwright test specifically looks for 'Import complete' in the log or summary
             // which is already emitted by healthConnectImporter
          }
        } catch (e) {
          log(`Error: ${e.message}`, 'error', 100)
        }
      }
      
      if (signal.aborted) {
        log('Import cancelled by user', 'warn', 100)
      } else {
        log('All files processed', 'success', 100)
        onFilesParsed(results)
      }
    } finally {
      setParsing(false)
      abortControllerRef.current = null
    }
  }, [onFilesParsed])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: parsing
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl transition-all
          ${parsing
            ? 'border-jade/40 cursor-default pointer-events-none'
            : isDragActive
            ? 'border-jade bg-jade/5 p-10 text-center cursor-pointer'
            : 'border-slate-border hover:border-jade/40 hover:bg-jade/2 p-10 text-center cursor-pointer'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none p-10 text-center cursor-pointer">
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-2
            ${isDragActive ? 'bg-jade/20 text-jade scale-110' : 'bg-slate-border/50 text-slate-ui'}
            transition-all duration-300
          `}>
            o
          </div>
          <h3 className="text-white font-display font-medium text-lg">
            {isDragActive ? 'Drop files to parse' : 'Upload Health Data'}
          </h3>
          <p className="text-slate-ui text-sm max-w-sm">
            Drag and drop Apple Health XML, Google Health Connect ZIP, or CSV files here.
          </p>
        </div>
      </div>

      {(parseLog.length > 0 || parsing) && (
        <LogPanel 
          parseLog={parseLog} 
          onCancel={handleCancel} 
          parsing={parsing} 
          importSummary={importSummary}
        />
      )}
    </div>
  )
}
