# ALS Clinical Trials Dashboard

A dashboard for tracking notable ongoing amyotrophic lateral sclerosis (ALS) clinical trials: therapy/modality background, preclinical evidence, phase and design, results reported so far, and estimated timeframes for future readouts.

## Data model

- `src/data/trials.ts` — hand-curated snapshot of ~8 notable ongoing trials plus recently concluded readouts, researched from public sources (ClinicalTrials.gov, sponsor press releases, peer-reviewed literature). Each entry cites its sources.
- `src/lib/clinicalTrialsApi.ts` + `useLiveTrialStatuses` — on load (and on demand via "Refresh live status"), the app queries the public [ClinicalTrials.gov API v2](https://clinicaltrials.gov/data-api/api) client-side for each trial's NCT ID and overlays live `overallStatus`, `enrollmentCount`, and `primaryCompletionDate` onto the curated card/detail view. If that request fails (offline, network policy, API changes) the UI falls back to the curated snapshot silently — there is always something reasonable to show.

## Running locally

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Updating the dataset

Edit `src/data/trials.ts` directly — add a new `Trial` entry (see `src/types/trial.ts` for the shape) or update an existing one's `results` array as new readouts are published. Keep `dataAsOf` current when you do a research pass.
