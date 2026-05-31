# Connector Architecture & Integration Guide

This document explains how to connect HealthLens to external data sources (Fitbit, Strava, Withings, Welltory, Sleep as Android, Eufy, and Health Connect), and includes scaffolding for serverless OAuth endpoints.

Overview
- Use a small serverless layer (Vercel Serverless Functions or equivalent) to handle OAuth redirects, token exchange, and webhooks. Keep secrets in the hosting provider's secret store (Vercel Environment Variables / GitHub Secrets). Do not commit secrets to the repo.
- The serverless layer should *not* store long-term tokens in plain text in the repo. Use a persistent store (Postgres, SQLite, Vercel KV, or similar) or store tokens encrypted in your chosen back end.
- For devices that sync to Health Connect (Android), prefer an Android companion app that posts daily summaries to a secure endpoint on your serverless API.

Quick connector summary

- Fitbit: OAuth2 + subscriptions/webhooks. Best for steps, heart-rate, sleep, active zone minutes. Requires creating a Fitbit developer app and adding `FITBIT_CLIENT_ID` and `FITBIT_CLIENT_SECRET` to environment variables.
- Strava: OAuth2 + webhooks. Best for recorded activities only. Implemented: OAuth start/callback, webhook event intake, status endpoint, Supabase provenance tables, webhook scripts, and 90-day backfill. Do not treat Strava as sleep, HRV baseline, resting-HR, respiratory-rate, weight, lab, symptom, or all-day step evidence.
- Withings: OAuth2. Best for weight, sleep-mat signals, body composition. Create a Withings developer app; add `WITHINGS_CLIENT_ID`/`WITHINGS_CLIENT_SECRET`.
- Welltory: CSV/CSV API. Prefer manual CSV uploads or API export; add a parser for HRV/RR intervals.
- Sleep as Android: ZIP/CSV export. Use the existing ZIP parser improvements; add automation by watching a Drive folder or by using a small Android export helper.
- Eufy Life scales: no public direct API; prefer Health Connect sync or manual export.
- Health Connect (Android): Best daily source. Two options:
  1. Android companion app reads Health Connect and posts daily JSON summaries to `/api/healthconnect/ingest`.
  2. Continue with ZIP import flow (already supported). For full automation, implement the companion app.

Serverless scaffolding included in this repo
- `api/fitbit/start.js` — redirect to Fitbit's OAuth consent screen.
- `api/fitbit/callback.js` — exchange authorization code for tokens (does not persist tokens; see storage notes below).
- `api/fitbit/webhook.js` — placeholder to receive Fitbit subscription updates.
- `api/withings/start.js` and `api/withings/callback.js` — analogous Withings endpoints.

Environment variables required (example names)
- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `WITHINGS_CLIENT_ID`
- `WITHINGS_CLIENT_SECRET`
- `BASE_URL` — public URL where your app is reachable (e.g., `https://your-app.vercel.app`) used to build OAuth callback URLs.

Persistent storage recommendations
- For production, use a simple server-side database to store tokens and refresh tokens (Postgres, MySQL, SQLite on a small server, or Vercel Postgres). Store tokens encrypted.
- For short-term testing you can display the token in the OAuth callback response and manually paste it into a secure secret in your hosting provider (not recommended long-term).

Security notes
- Never paste tokens or client secrets in chat.
- Use the minimal OAuth scopes required (e.g., activity, heartrate, sleep) when registering developer apps.

Next steps I can implement (pick one)
- Implement full token storage in a chosen database (I will add the DB scaffolding and migration).  
- Add Fitbit webhook subscription helper (serverless route to create subscriptions).  
- Scaffold Android Health Connect companion (Kotlin prototype) to post daily summaries to `/api/healthconnect/ingest`.
