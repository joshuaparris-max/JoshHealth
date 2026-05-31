# HealthLens Improvements v2

Following the successful implementation of the core sync infrastructure, these 10 improvements focus on data quality, platform breadth, and clinical utility.

## 1. Automated Unit Testing for Data Parsers (High)
**Goal**: Ensure that `fileParser.js` and `dataPackBuilder.js` never regress when handling complex SQLite or CSV files.
- Add `vitest` or `jest` for unit testing.
- Create "Golden Fixture" datasets for Health Connect and Withings exports.

## 2. Apple Health XML Support (High)
**Goal**: Unlock the largest health ecosystem.
- Implement a streaming XML parser for large Apple Health `export.xml` files.
- Map `HKQuantityTypeIdentifier` records to the internal `daily_health_summary` and detailed tables.

## 3. Enhanced Chart Context & Units (Medium)
**Goal**: Make charts more readable and clinically useful.
- Add formatted units (bpm, ms, kg, min) to all chart tooltips.
- Add "Normal Range" overlays for biometrics like Resting HR and Respiratory Rate.

## 4. Multi-Day Batch Sync for Android (High)
**Goal**: Robustness against missed sync days.
- Update the Android app to track "Last Successful Sync" and batch-upload all missing days since then.
- Ensure idempotency in the Vercel API handler.

## 5. Pathology Lab Heuristics (Medium)
**Goal**: Better PDF extraction for Australian labs.
- Add targeted regex patterns for Sonic Healthcare and Laverty Pathology formats.
- Extract common markers like HbA1c, Cholesterol (LDL/HDL), and Vitamin D.

## 6. Longitudinal Analysis History (Medium)
**Goal**: Track progress over months/years.
- Allow the AI to compare the *current* analysis against *past* results stored in `analysis_history`.
- "How has my recovery improved since my last check-in 3 months ago?"

## 7. GP Report Formatting (High)
**Goal**: Professional, shareable summaries.
- Add a dedicated "GP Summary" print stylesheet for HTML exports.
- Include a "Clinician's Corner" section with raw data tables for markers that triggered AI warnings.

## 8. Data Quality Audit Dashboard (Medium)
**Goal**: Transparency on data provenance.
- Add a UI view showing which source "won" for each day's metric (e.g., "Sleep: Oura (Priority 1)").
- Flag days with "Conflicting Data" where sources disagreed significantly.

## 9. Background Sync Progress on Android (Low)
**Goal**: Better visibility into the sync process.
- Implement a persistent notification or progress bar on Android when a sync is active.
- Show "Last Sync: 2 hours ago" on the Android home screen.

## 10. AI-Powered "Ask My Data" Chat Refinement (Medium)
**Goal**: Faster, more accurate follow-up.
- Improve the `ChatPanel` to use RAG (Retrieval Augmented Generation) against the local IndexedDB for specific questions like "When was my highest weight in May?".

---

# Implementation Status
- [x] 1. Unit Testing (Core parsers and DataPack)
- [x] 2. Apple Health XML (Basic schema mapping)
- [x] 3. Chart Enhancements (Formatted units in tooltips)
- [ ] 4. Multi-Day Batch Sync for Android
- [ ] 5. Pathology Lab Heuristics
- [ ] ...
