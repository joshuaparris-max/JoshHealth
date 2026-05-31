import { useState, useEffect } from 'react'
import { getAnalysisHistory } from '../lib/db.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function HistoryView() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    getAnalysisHistory().then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-slate-ui animate-pulse">Loading history...</div>
  }

  if (history.length === 0) {
    return (
      <div className="bg-ink-soft border border-slate-border rounded-2xl p-12 text-center space-y-4">
        <div className="text-4xl">📜</div>
        <h3 className="text-white font-semibold">No analysis history yet</h3>
        <p className="text-slate-ui text-sm max-w-xs mx-auto">
          Analyses you perform will be saved locally in your browser.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-white font-display font-semibold">Saved Analyses</h3>
        <span className="text-xs text-slate-ui font-mono">{history.length} total</span>
      </div>

      <div className="space-y-3">
        {history.map((item) => {
          const isExpanded = expandedId === item.id
          return (
            <div 
              key={item.id} 
              className={`bg-ink-soft border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-jade/40 ring-1 ring-jade/20' : 'border-slate-border'}`}
            >
              <button 
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full p-5 flex items-start justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-xs text-jade font-mono uppercase tracking-wider">
                    {new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <h4 className="text-white font-medium leading-tight">
                    {item.modes.length > 0 ? item.modes.join(', ') : 'Custom Question'}
                  </h4>
                  {item.question && (
                    <p className="text-slate-ui text-xs italic line-clamp-1 mt-1">
                      "{item.question}"
                    </p>
                  )}
                  <p className="text-[10px] text-slate-ui/60 font-mono mt-1">
                    Model: {item.model}
                  </p>
                </div>
                <span className={`text-slate-ui transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-border/50">
                  <div className="prose-health prose-sm max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {item.result}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
