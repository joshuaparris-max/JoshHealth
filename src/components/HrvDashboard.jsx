import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts'
import db from '../lib/db.js'
import { normalizeHRV, groupHRVDynamically, calculateRollingBaselines } from '../lib/hrvStats.js'

export default function HrvDashboard() {
  const [rawData, setRawData] = useState([])
  const [importHistory, setImportHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // UI Controls
  const [dateRange, setDateRange] = useState(30)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [overnightOnly, setOvernightOnly] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const heartMetrics = await db.heart_metrics.toArray()
        console.log('BROWSER CONSOLE:', 'Loaded heartMetrics:', heartMetrics.length)
        if (heartMetrics.length > 0) {
          console.log('BROWSER CONSOLE:', 'First metric:', JSON.stringify(heartMetrics[0]))
        }
        setRawData(heartMetrics)
        
        const imports = await db.health_imports.orderBy('imported_at').reverse().toArray()
        setImportHistory(imports)
      } catch (err) {
        console.error('Failed to load HRV data', err)
        setError('Failed to load data from local database.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const processedData = useMemo(() => {
    if (!rawData.length) return { chartData: [], sources: [] }

    const sourcesFound = new Set()
    
    // Filter by source
    const filteredRaw = rawData.filter(m => {
      sourcesFound.add(m.source_id)
      if (sourceFilter !== 'all' && m.source_id !== parseInt(sourceFilter)) return false
      return true
    })

    const hrvSamples = []
    const rhrByDate = {}
    
    filteredRaw.forEach(m => {
      if (m.metric_type === 'hrv_sample') {
        hrvSamples.push({ time: new Date(m.timestamp_or_date).getTime(), heart_rate_variability_millis: m.value })
      } else if (m.metric_type === 'resting_hr') {
        const dateStr = m.timestamp_or_date.slice(0, 10)
        if (!rhrByDate[dateStr]) rhrByDate[dateStr] = []
        rhrByDate[dateStr].push(m.value)
      }
    })

    const normalized = normalizeHRV(hrvSamples)
    const grouped = groupHRVDynamically(normalized, overnightOnly ? 'overnight' : '24h')
    const baselines = calculateRollingBaselines(grouped)

    const merged = {}
    
    Object.keys(baselines).forEach(d => {
      if (!merged[d]) merged[d] = { date: d }
      merged[d].hrvMedian = baselines[d].median
      merged[d].hrvIqr = baselines[d].iqr
      merged[d].hrvCount = baselines[d].count
      merged[d].hrvBaseline = baselines[d].baseline
    })
    
    Object.keys(rhrByDate).forEach(d => {
      if (!merged[d]) merged[d] = { date: d }
      const sum = rhrByDate[d].reduce((a, b) => a + b, 0)
      merged[d].restingHr = sum / rhrByDate[d].length
    })
    
    let sorted = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date))
    
    if (dateRange !== 'all') {
      sorted = sorted.slice(-parseInt(dateRange))
    }
    
    return { chartData: sorted, sources: Array.from(sourcesFound) }
  }, [rawData, dateRange, sourceFilter, overnightOnly])

  const exportCsv = () => {
    const { chartData } = processedData
    const header = "Date,HRV Median (ms),HRV IQR (ms),HRV Samples,HRV Baseline (ms),Resting HR (bpm)\n"
    const rows = chartData.map(d => 
      `${d.date},${d.hrvMedian || ''},${d.hrvIqr || ''},${d.hrvCount || ''},${d.hrvBaseline || ''},${d.restingHr || ''}`
    ).join("\n")
    
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `HealthLens_HRV_Export_${overnightOnly ? 'Overnight' : '24h'}.csv`
    a.click()
  }

  if (loading) return <div className="text-slate-ui p-6 animate-pulse" data-testid="dashboard-loading">Loading Database...</div>
  if (error) return <div className="bg-crimson-health/10 border border-crimson-health text-crimson-health p-4 rounded-xl">{error}</div>
  if (processedData.chartData.length === 0) {
    return (
      <div className="bg-ink border border-slate-border rounded-xl p-8 text-center space-y-4" data-testid="empty-dashboard">
        <h3 className="text-white text-lg">No HRV Data Available</h3>
        <p className="text-slate-ui">Upload a Health Connect ZIP file in the Upload tab to populate this dashboard.</p>
      </div>
    )
  }

  const { chartData, sources } = processedData

  return (
    <div className="space-y-6 animate-slide-up" data-testid="hrv-dashboard">
      
      {/* Import History Panel */}
      {importHistory.length > 0 && (
        <div className="bg-ink-soft border border-slate-border rounded-xl p-4 text-sm" data-testid="import-history">
          <h4 className="text-white font-semibold mb-2">Import History</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {importHistory.map(imp => (
              <div key={imp.id} className="flex justify-between text-slate-ui border-b border-slate-border/50 pb-1">
                <span>
                  <span className="text-white">{imp.file_name}</span> 
                  <span className="text-xs ml-2 opacity-60">Hash: {imp.file_hash?.slice(0, 8)}</span>
                </span>
                <span className="flex gap-4">
                  <span className={`px-2 rounded text-xs ${imp.status === 'completed' ? 'bg-jade/20 text-jade' : imp.status === 'cancelled' ? 'bg-amber-health/20 text-amber-health' : imp.status === 'failed' ? 'bg-crimson-health/20 text-crimson-health' : 'bg-blue-500/20 text-blue-400'}`}>
                    {imp.status}
                  </span>
                  <span>{imp.record_count} records</span>
                  <span>{new Date(imp.imported_at).toLocaleDateString()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-ink border border-slate-border rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-ui">
            Date Range:
            <select 
              value={dateRange} 
              onChange={e => setDateRange(e.target.value)}
              className="bg-ink-soft border border-slate-border rounded px-2 py-1 text-white"
              data-testid="date-range-select"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </label>
          
          <label className="flex items-center gap-2 text-xs text-slate-ui">
            Source:
            <select 
              value={sourceFilter} 
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-ink-soft border border-slate-border rounded px-2 py-1 text-white"
              data-testid="source-filter-select"
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>Source ID: {s}</option>)}
            </select>
          </label>
        </div>
        
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-xs text-slate-ui cursor-pointer">
            <input 
              type="checkbox" 
              checked={overnightOnly} 
              onChange={e => setOvernightOnly(e.target.checked)}
              className="accent-jade"
              data-testid="overnight-toggle"
            />
            Overnight Only (8PM - 8AM)
          </label>
          
          <button onClick={exportCsv} className="bg-slate-border hover:bg-slate-ui text-white px-3 py-1 rounded text-xs transition" data-testid="export-csv">
            Export CSV
          </button>
        </div>
      </div>
      
      {/* Explainer */}
      <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 p-4 rounded-xl text-sm flex flex-col gap-2">
        <p>
          <strong>Observation:</strong> This dashboard displays <em>RMSSD</em> (Root Mean Square of Successive Differences) measured in milliseconds, extracted directly from the <code>heart_rate_variability_rmssd_record_table</code> schema.
        </p>
        <p className="text-xs text-slate-ui mt-1">
          <strong>Convention:</strong> "Overnight" designates the sleep window ending on the displayed calendar morning. (e.g., Aug 1 overnight covers July 31 8PM to Aug 1 8AM). HealthLens describes personal trends and does not diagnose medical conditions.
        </p>
      </div>

      {/* Main Chart */}
      <div className="bg-ink-soft border border-slate-border rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-semibold text-white text-base">
            {overnightOnly ? 'Overnight HRV Median' : '24-Hour HRV Median'} vs 7-Day Baseline
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-ui">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-jade"></div> Median</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> 7-Day Baseline</span>
          </div>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(e) => { if(e?.activePayload) setSelectedDate(e.activePayload[0].payload) }}>
              <defs>
                <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D333B" vertical={false} />
              <XAxis dataKey="date" stroke="#768390" tick={{ fontSize: 10 }} tickMargin={10} minTickGap={30} />
              <YAxis yAxisId="left" stroke="#768390" tick={{ fontSize: 10 }} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1C2128', borderColor: '#444C56', color: '#ADBAC7', fontSize: '12px' }}
                cursor={{ stroke: '#444C56', strokeWidth: 1, strokeDasharray: '5 5' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-ink border border-slate-border p-3 rounded-lg shadow-xl text-xs space-y-1">
                        <p className="font-bold text-white border-b border-slate-border pb-1 mb-2">{label}</p>
                        {d.hrvMedian && <p className="text-jade">Median HRV: {d.hrvMedian.toFixed(1)} ms</p>}
                        {d.hrvIqr && <p className="text-slate-ui">IQR: {d.hrvIqr.toFixed(1)} ms</p>}
                        {d.hrvBaseline && <p className="text-indigo-400">Baseline: {d.hrvBaseline.toFixed(1)} ms</p>}
                        {d.hrvCount && <p className={d.hrvCount < 5 ? "text-crimson-health" : "text-slate-ui"}>Samples: {d.hrvCount}</p>}
                        {d.restingHr && <p className="text-amber-health">Resting HR: {d.restingHr.toFixed(1)} bpm</p>}
                        <p className="text-[10px] text-slate-ui/50 mt-2 pt-1 border-t border-slate-border">(Click to inspect)</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area yAxisId="left" type="monotone" dataKey="hrvBaseline" name="7-Day Baseline" stroke="#4F46E5" fillOpacity={1} fill="url(#colorBaseline)" isAnimationActive={false} />
              <Line yAxisId="left" type="monotone" dataKey="hrvMedian" name="Median" stroke="#2EA043" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#1C2128' }} activeDot={{ r: 6, fill: '#2EA043' }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Detail Inspection Panel */}
      {selectedDate && (
        <div className="bg-ink border border-slate-border rounded-xl p-4 animate-fade-in flex flex-col gap-2 mt-4" data-testid="daily-inspection">
          <div className="flex justify-between">
             <h4 className="font-semibold text-white">Daily Inspection: {selectedDate.date}</h4>
             <button onClick={() => setSelectedDate(null)} className="text-slate-ui hover:text-white text-xs">Close</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-sm">
            <div>
              <p className="text-slate-ui text-xs">Median RMSSD</p>
              <p className="text-white font-mono">{selectedDate.hrvMedian?.toFixed(1) || '--'} ms</p>
            </div>
            <div>
              <p className="text-slate-ui text-xs">Interquartile Range (IQR)</p>
              <p className="text-white font-mono">{selectedDate.hrvIqr?.toFixed(1) || '--'} ms</p>
            </div>
            <div>
              <p className="text-slate-ui text-xs">Sample Volume</p>
              <p className={`font-mono ${selectedDate.hrvCount < 5 ? 'text-crimson-health' : 'text-white'}`}>
                {selectedDate.hrvCount || 0} {selectedDate.hrvCount < 5 ? '(Low Confidence)' : ''}
              </p>
            </div>
            <div>
              <p className="text-slate-ui text-xs">Resting HR</p>
              <p className="text-white font-mono">{selectedDate.restingHr?.toFixed(1) || '--'} bpm</p>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-ink-soft border border-slate-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-white text-base mb-4">Resting Heart Rate (RHR)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D333B" vertical={false} />
                <XAxis dataKey="date" stroke="#768390" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis stroke="#768390" tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1C2128', borderColor: '#444C56', color: '#ADBAC7', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="restingHr" name="Resting HR" stroke="#F47067" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-ink-soft border border-slate-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-white text-base mb-4">Sample Volume (Readings per {overnightOnly ? 'Night' : 'Day'})</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D333B" vertical={false} />
                <XAxis dataKey="date" stroke="#768390" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis stroke="#768390" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1C2128', borderColor: '#444C56', color: '#ADBAC7', fontSize: '12px' }}
                />
                <Area type="step" dataKey="hrvCount" name="Samples Count" stroke="#539BF5" fillOpacity={0.3} fill="#539BF5" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
