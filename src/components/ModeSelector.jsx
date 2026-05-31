import { ANALYSIS_MODES } from '../lib/claudeApi.js'

export default function ModeSelector({ selected, onChange, onAnalyse, disabled, customQuestion, onCustomQuestionChange }) {
  const toggle = (key) => {
    onChange(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const selectAll = () => onChange(Object.keys(ANALYSIS_MODES))
  const selectNone = () => onChange([])

  return (
    <div className="bg-ink-soft border border-slate-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-white text-base">Analysis Modes</h3>
          <p className="text-slate-ui text-xs mt-0.5">Select what you want Claude to analyse</p>
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs text-slate-ui hover:text-jade transition-colors">All</button>
          <span className="text-slate-border">·</span>
          <button onClick={selectNone} className="text-xs text-slate-ui hover:text-crimson-health transition-colors">None</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Object.entries(ANALYSIS_MODES).map(([key, mode]) => {
          const active = selected.includes(key)
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`
                flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                ${active
                  ? 'border-jade/50 bg-jade-glow text-white'
                  : 'border-slate-border bg-ink hover:border-jade/30 text-slate-ui hover:text-white'
                }
              `}
            >
              <span className="text-lg flex-shrink-0">{mode.icon}</span>
              <span className="text-sm font-medium leading-tight">{mode.label}</span>
              {active && (
                <span className="ml-auto text-jade text-xs flex-shrink-0">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Free-form analysis box */}
      <div className="pt-2 space-y-2">
        <label className="text-xs uppercase tracking-[0.35em] text-slate-ui block">Custom Question (Optional)</label>
        <textarea
          value={customQuestion}
          onChange={(e) => onCustomQuestionChange(e.target.value)}
          placeholder="e.g. Compare my sleep this winter vs last winter, or look for signs of overtraining."
          className="w-full h-24 bg-ink border border-slate-border rounded-xl p-4 text-sm text-white focus:border-jade outline-none transition-all placeholder:text-slate-ui/40 resize-none"
        />
      </div>

      <div className="pt-2">
        <button
          onClick={onAnalyse}
          disabled={disabled || (selected.length === 0 && !customQuestion.trim())}
          className={`
            w-full font-display font-bold py-4 rounded-xl transition-all text-base
            ${!disabled && (selected.length > 0 || customQuestion.trim())
              ? 'bg-jade hover:bg-jade-dark text-ink-DEFAULT glow-active'
              : 'bg-ink border border-slate-border text-slate-ui cursor-not-allowed'
            }
          `}
        >
          {selected.length === 0 && !customQuestion.trim()
            ? 'Select a mode or ask a question'
            : `Analyse ${selected.length > 0 ? `with ${selected.length} mode${selected.length !== 1 ? 's' : ''}` : ''}${selected.length > 0 && customQuestion.trim() ? ' and ' : ''}${customQuestion.trim() ? 'your question' : ''} →`
          }
        </button>
        <p className="text-center text-xs text-slate-ui/60 mt-2">
          ⚕️ Not medical advice — for personal reflection only
        </p>
      </div>
    </div>
  )
}
