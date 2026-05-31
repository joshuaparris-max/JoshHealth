import { SOURCE_PRIORITY } from './schema.js';

/**
 * Builds a structured DataPack from parsed files for the LLM to analyze.
 */
export function buildDataPack(parsedFiles) {
  // 1. Identify files and their types
  const files = parsedFiles.map(f => ({
    name: f.name,
    type: f.type,
    size: f.size,
    summary: f.summary
  }));

  // 2. Extract metrics availability and quality notes from summaries
  // The SQLite worker already produces a "DATA PACK: STRUCTURED HEALTH INVENTORY" summary.
  const metrics = {};
  const qualityWarnings = [];
  let detectedInventory = false;

  parsedFiles.forEach(f => {
    if (f.summary && f.summary.includes('DATA PACK: STRUCTURED HEALTH INVENTORY')) {
      detectedInventory = true;
      // The summary itself is the DataPack for SQLite files
    }
    
    // Check for source overlap
    if (f.summary && f.summary.includes('!! QUALITY WARNING')) {
      qualityWarnings.push(`File ${f.name}: ${f.summary.match(/!! QUALITY WARNING: (.*)/)?.[1] || 'Possible duplicate sources'}`);
    }
  });

  const dataPack = {
    header: "DATA PACK: STRUCTURED HEALTH EXTRACTION",
    version: "2.0",
    generatedAt: new Date().toISOString(),
    files: files,
    sourcePriorities: SOURCE_PRIORITY,
    qualityAudit: {
      warnings: qualityWarnings,
      hasStructuredInventory: detectedInventory
    },
    // We pass the full summaries as the primary data source
    content: parsedFiles.map(f => `FILE: ${f.name}\nTYPE: ${f.type}\nSUMMARY:\n${f.summary}`).join('\n\n---\n\n')
  };

  return JSON.stringify(dataPack, null, 2);
}

export const ANALYSIS_MODES = {
  quickSummary: {
    label: 'Quick Summary',
    icon: '⚡',
    prompt: 'Give a clear, plain-English overview of this health data. Highlight the 3-5 most important findings. Be warm and honest. Use Australian English.'
  },
  deepPattern: {
    label: 'Deep Pattern Analysis',
    icon: '🔬',
    prompt: 'Perform a deep pattern analysis. Look for trends over time, correlations between metrics, anomalies, and boom-bust cycles. What stories does this data tell?'
  },
  clinicalReview: {
    label: 'Clinical Records',
    icon: '🩺',
    prompt: 'Review any pathology, blood test, or clinical records in this data. Summarise what each marker means in plain English, flag anything worth discussing with a GP, and note positive findings too. Remind the user this is not medical advice.'
  },
  sleepAnalysis: {
    label: 'Sleep Analysis',
    icon: '🌙',
    prompt: 'Focus specifically on sleep data. Analyse duration, timing/consistency, quality indicators, and how sleep appears to affect next-day metrics. What patterns suggest good or poor sleep hygiene?'
  },
  movementBreakdown: {
    label: 'Movement & Exercise',
    icon: '🏃',
    prompt: 'Break down movement and exercise data. What types of activity are present? How does activity load vary? Are there gaps (e.g. strength training)? How does this compare to Australian adult movement guidelines?'
  },
  recoveryHRV: {
    label: 'Recovery & HRV',
    icon: '💓',
    prompt: 'Analyse recovery signals including HRV, resting heart rate, respiratory rate, and any other recovery metrics. What is the overall recovery picture? Any concerning trends or reassuring signals?'
  },
  nutritionGaps: {
    label: 'Nutrition Gaps',
    icon: '🥗',
    prompt: 'Analyse any nutrition data present. If no direct intake data, look for indirect signals (weight trends, energy markers, bloodwork suggesting nutritional status). Flag any likely gaps for a dairy-free, plant-forward diet.'
  },
  actionPlan: {
    label: '90-Day Action Plan',
    icon: '🎯',
    prompt: 'Based on all the data, generate a practical 90-day action plan. Keep it small and realistic — assume a real life with family, work, and ADHD. Prioritise the highest-yield changes. Format as clear weekly priorities.'
  },
  comparePeriods: {
    label: 'Compare Time Periods',
    icon: '📊',
    prompt: 'Compare health metrics across different time periods in the data. Look for what has improved, what has stayed flat, and what may have declined. Frame improvements as encouragement.'
  }
}

/**
 * Builds the comprehensive system prompt for the AI.
 */
export function buildSystemPrompt(selectedModes) {
  const modesStr = selectedModes.map(m => ANALYSIS_MODES[m]?.label || m).join(', ');
  const modeInstructions = selectedModes.map(m => `- ${ANALYSIS_MODES[m]?.label}: ${ANALYSIS_MODES[m]?.prompt}`).join('\n');
  
  return `You are a senior health data analyst. You are analysing a structured health-data extraction (DataPack), not raw files.

SOURCE PRIORITY RULES:
${Object.entries(SOURCE_PRIORITY).map(([metric, sources]) => `- ${metric}: ${sources.join(' > ')}`).join('\n')}

IMPORTANT RULES:
- Use Australia/Sydney timezone for date interpretation unless a file explicitly proves otherwise.
- Use the SOURCE PRIORITY RULES above to decide which data to trust if multiple sources provide the same metric.
- Do not invent data. If the DataPack says a metric has 0 rows, it is empty.
- Do not say a metric is missing if the DataPack shows rows exist.
- Every major claim must reference the extracted metric, date range, row count, or quality warning.
- Warn when duplication or source overlap may distort totals (e.g. if multiple apps contribute to the same metric).
- If a table exists with 0 rows, say "table exists but contains no records".
- If a parser failed, say "parser limitation", not "data absent".
- Use plain Australian English — warm, direct, never patronising.
- This is NOT medical advice. Always suggest discussing findings with a GP.

RESPONSE STRUCTURE:
1. **Data Inventory**: Summarise files, tables, metrics, date ranges, and row counts.
2. **Data Quality Audit**: Highlight duplicates, source overlap, missing metrics, and confidence ratings.
3. **True Summary**: What can safely be concluded vs what is uncertain.
4. **Metric-by-Metric Analysis**: Detailed findings for Steps, Sleep, HRV, Resting HR, etc.
5. **Pattern Lenses**: Insights on Recovery, Longevity, and ADHD/Regulation if applicable.
6. **Next Experiments**: 1–3 tiny, practical experiments with success measures.
7. **GP Discussion Points**: Specific markers or trends to show a doctor.

Analysis Modes Requested: ${modesStr}

DETAILED MODE INSTRUCTIONS:
${modeInstructions}`;
}
