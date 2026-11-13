// Refreshes scripts/euctr-als.json, the saved copy of ALS trials from the EU
// Clinical Trials Register (EudraCT). Run by hand now and then; the deploy
// build only reads the saved copy. Behind an HTTPS proxy on Node 22+, run with
// NODE_USE_ENV_PROXY=1.
import { saveEuctrSnapshot } from './other-registries.mjs'

console.log(`Saved ${await saveEuctrSnapshot()} EU CTR trials`)
