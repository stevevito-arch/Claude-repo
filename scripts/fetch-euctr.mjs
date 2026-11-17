// Refreshes scripts/data/<disease>/euctr.json, the saved copy of a disease's
// trials from the EU Clinical Trials Register (EudraCT). Run by hand now and
// then; the deploy build only reads the saved copy. Behind an HTTPS proxy on
// Node 22+, run with NODE_USE_ENV_PROXY=1.
//
//   node scripts/fetch-euctr.mjs als
import { saveEuctrSnapshot } from './other-registries.mjs'
import { diseaseFrom } from './diseases.mjs'

const disease = diseaseFrom(process.argv)
console.log(`Saved ${await saveEuctrSnapshot(disease)} EU CTR trials for ${disease.name}`)
