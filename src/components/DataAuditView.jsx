import { useState, useEffect } from 'react'
import { getDailySummaries } from '../lib/healthDataApi.js'
import { SOURCE_PRIORITY } from '../lib/schema.js'

export default function DataAuditView({ summaries }) {
  const [selectedDay, setSelectedDay] = useState(null)

  const dayDetails = selectedDay ? summaries.find(s => s.date === selectedDay) : null

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-display font-semibold">Data Quality Audit</h3>
          <p className="text-slate-ui text-xs mt-0.5">Track data provenance and source conflicts</p>
        </div>
        <span className="text-xs text-slate-ui font-mono">{summaries.length} days analyzed</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day Picker */}
        <div className="bg-ink-soft border border-slate-border rounded-2xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          <p className="text-[10px] uppercase tracking-widest text-slate-ui mb-3 px-2">Select Day</p>
          <div className="space-y-1">
            {summaries.slice().reverse().map((s) => (
              <button
                key={s.date}
                onClick={() => setSelectedDay(s.date)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between ${
                  selectedDay === s.date 
                    ? 'bg-jade/10 border border-jade/30 text-jade' 
                    : 'hover:bg-white/5 border border-transparent text-slate-ui'
                }`}
              >
                <span className="font-mono text-sm">{s.date}</span>
                <div className="flex gap-1">
                  {s.source_confidence >= 0.9 ? (
                    <span className="text-jade" title="High Confidence">●</span>
                  ) : s.source_confidence >= 0.7 ? (
                    <span className="text-amber-500" title="Medium Confidence">●</span>
                  ) : (
                    <span className="text-crimson-health" title="Low Confidence">●</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="bg-ink-soft border border-slate-border rounded-2xl p-6">
          {dayDetails ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">{dayDetails.date}</h4>
                <div className="px-3 py-1 rounded-full bg-ink border border-slate-border">
                  <span className="text-xs text-slate-ui font-mono">Confidence: {(dayDetails.source_confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-ui">Metric Provenance</p>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(SOURCE_PRIORITY).map(([metric, priority]) => {
                      const value = dayDetails[metric]
                      if (value === undefined || value === null) return null
                      
                      return (
                        <div key={metric} className="flex items-center justify-between p-3 bg-ink rounded-xl border border-slate-border/50">
                          <span className="text-xs text-slate-ui capitalize">{metric.replace(/_/g, ' ')}</span>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{value}</p>
                            <p className="text-[10px] text-jade font-mono">{dayDetails.source_id || 'unknown source'}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {dayDetails.warnings_json && JSON.parse(dayDetails.warnings_json).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-crimson-health">Source Conflicts / Warnings</p>
                    <div className="p-3 bg-crimson-health/5 border border-crimson-health/20 rounded-xl">
                      <ul className="text-xs text-slate-ui list-disc list-inside space-y-1">
                        {JSON.parse(dayDetails.warnings_json).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
              <div className="text-3xl">🧐</div>
              <p className="text-sm text-slate-ui">Select a day to audit its data provenance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
