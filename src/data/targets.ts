// Other names for therapy targets, so a search for any of them finds the same
// studies (e.g. "ataxin-2" finds ATXN2 trials). Keys are the target names used
// in scripts/drugs.json and src/data/trials.ts. Spelling variants that differ
// only in hyphens, spaces or case ("TDP43", "ataxin 2") need no entry: the
// search ignores those differences already. A target without other names
// needs no entry either.
export const TARGET_SYNONYMS: Record<string, string[]> = {
  // Genetic forms of ALS
  SOD1: ['superoxide dismutase 1', 'Cu/Zn superoxide dismutase', 'SOD1-ALS'],
  FUS: ['fused in sarcoma', 'TLS', 'FUS-ALS'],
  'TDP-43 (TARDBP)': ['TARDBP', 'TAR DNA-binding protein 43'],
  C9orf72: ['C9', 'C9-ALS', 'C9orf72 repeat expansion'],
  ATXN2: ['ataxin-2'],
  STMN2: ['stathmin-2'],
  UNC13A: ['Munc13-1'],
  CHCHD10: ['coiled-coil-helix-coiled-coil-helix domain containing 10'],
  SPTLC1: ['serine palmitoyltransferase'],
  // Inflammation and immunity
  TREM2: ['triggering receptor expressed on myeloid cells 2'],
  C1q: ['complement C1q', 'complement', 'classical complement pathway'],
  'C3 (complement)': ['complement C3', 'C3'],
  'C5 (complement)': ['complement C5', 'C5'],
  CSF1R: ['colony stimulating factor 1 receptor', 'microglia'],
  'Microglial activation': ['microglia'],
  'TSPO (microglial activation)': ['translocator protein', 'microglia'],
  'NLRP3 inflammasome': ['NLRP3', 'inflammasome'],
  RIPK1: ['receptor-interacting protein kinase 1', 'RIP1', 'necroptosis'],
  'Regulatory T cells': ['Treg', 'Tregs', 'IL-2', 'interleukin-2', 'CD25'],
  'IL-2 receptor α (CD25)': ['IL2RA', 'interleukin-2 receptor', 'Treg'],
  'IL-6 receptor': ['IL-6', 'IL6R', 'interleukin-6'],
  'IL-1 receptor': ['IL-1', 'IL1R1', 'interleukin-1'],
  'IL-10': ['interleukin-10'],
  'TNF-α': ['TNF', 'tumor necrosis factor'],
  CD40L: ['CD40 ligand', 'CD154'],
  'CD20 (B cells)': ['CD20', 'MS4A1', 'B cells', 'B-cell depletion'],
  'CD80/CD86': ['CD80', 'CD86', 'CTLA4-Ig', 'co-stimulation'],
  KIT: ['c-Kit', 'CD117'],
  BTK: ["Bruton's tyrosine kinase"],
  JAK: ['Janus kinase'],
  'JAK1/JAK2': ['JAK', 'JAK1', 'JAK2', 'Janus kinase'],
  'Endogenous retroviruses (HERV-K)': ['HERV-K', 'HERV', 'endogenous retrovirus'],
  'LINE-1 reverse transcriptase': ['LINE-1', 'L1', 'reverse transcriptase'],
  // Stress responses and protein handling
  eIF2B: ['eukaryotic initiation factor 2B', 'integrated stress response', 'ISR'],
  'PPP1R15A (integrated stress response)': ['GADD34', 'ISR'],
  'Heat shock response (HSP70)': ['HSP70', 'heat shock protein 70'],
  'HSP90 (epichaperome)': ['HSP90', 'heat shock protein 90'],
  XPO1: ['exportin-1', 'CRM1', 'nuclear export'],
  PIKFYVE: ['PIKfyve kinase', 'phosphatidylinositol-3-phosphate 5-kinase'],
  SORT1: ['sortilin', 'progranulin'],
  'GBA1 (glucocerebrosidase)': ['GBA', 'GCase'],
  mTOR: ['mechanistic target of rapamycin', 'mTORC1'],
  AMPK: ['AMP-activated protein kinase'],
  CAPN2: ['calpain-2'],
  // Axons, synapses and neurotrophic signalling
  SARM1: ['sterile alpha and TIR motif containing 1', 'axon degeneration'],
  'MAP3K12 (DLK)': ['DLK', 'dual leucine zipper kinase'],
  MAP4K4: ['HGK'],
  'RTN4 (Nogo-A)': ['Nogo-A', 'Nogo', 'reticulon 4'],
  TRIM72: ['MG53', 'mitsugumin 53'],
  'GSK-3β': ['GSK3B', 'GSK-3', 'glycogen synthase kinase 3'],
  MuSK: ['muscle-specific kinase', 'neuromuscular junction'],
  HGF: ['hepatocyte growth factor'],
  GDNF: ['glial cell line-derived neurotrophic factor'],
  VEGFA: ['VEGF', 'vascular endothelial growth factor'],
  'VEGF receptors': ['VEGFR', 'VEGF', 'vascular endothelial growth factor'],
  'TrkA (NGF receptor)': ['TrkA', 'NTRK1', 'nerve growth factor'],
  'IGF-1 receptor': ['IGF-1', 'IGF1R', 'insulin-like growth factor'],
  'Neurotrophic factors (BDNF, GDNF, VEGF, HGF)': ['neurotrophic factors', 'BDNF', 'GDNF', 'VEGF', 'HGF'],
  Tau: ['MAPT'],
  'SMN2 splicing': ['SMN2', 'SMN'],
  // Excitability and neurotransmission
  'SIGMAR1 (sigma-1 receptor)': ['sigma-1 receptor', 'sigma 1', 'S1R'],
  'EAAT2 (glutamate transporter)': ['EAAT2', 'GLT-1', 'SLC1A2', 'glutamate'],
  'Glutamate release': ['glutamate'],
  'AMPA receptor': ['AMPA', 'glutamate'],
  'NMDA receptor': ['NMDA', 'NMDAR', 'glutamate'],
  'Voltage-gated sodium channels': ['sodium channel', 'Nav'],
  'KCNQ2/KCNQ3 (Kv7.2/7.3)': ['Kv7', 'KCNQ', 'potassium channel'],
  'T-type calcium channels': ['calcium channel', 'Cav3'],
  SV2A: ['synaptic vesicle glycoprotein 2A'],
  'Fast skeletal muscle troponin': ['troponin', 'skeletal muscle activator'],
  'MAO-B': ['monoamine oxidase B'],
  'Dopamine D2 receptor': ['DRD2', 'D2 receptor'],
  '5-HT2A receptor': ['HTR2A', 'serotonin 2A receptor'],
  'Cannabinoid receptors': ['CB1', 'CB2', 'cannabinoid'],
  // Metabolism and oxidative stress
  'MPO (myeloperoxidase)': ['MPO', 'myeloperoxidase'],
  'NAD+ metabolism': ['NAD', 'NAD+', 'nicotinamide adenine dinucleotide'],
  'NAD+/NADH redox metabolism': ['NAD', 'NAD+', 'NADH', 'nicotinamide adenine dinucleotide'],
  Nrf2: ['NFE2L2'],
  'ALOX15 (15-lipoxygenase)': ['15-LO', '15-lipoxygenase', 'ferroptosis'],
  'Lipid peroxidation': ['ferroptosis'],
  PPARγ: ['PPARG', 'PPAR gamma'],
  'PPAR-α': ['PPARA', 'PPAR alpha'],
  PGK1: ['phosphoglycerate kinase 1'],
  'COX-2': ['PTGS2', 'cyclooxygenase-2'],
  'miRNA biogenesis (Dicer)': ['Dicer', 'microRNA'],
  'TGF-β receptor I (ALK5)': ['TGFBR1', 'ALK5', 'TGF-beta'],
  'MEK1/2': ['MEK', 'MAP2K1', 'MAP2K2'],
  'ROCK (Rho kinase)': ['ROCK', 'Rho kinase'],
  'S1P receptors': ['S1P', 'sphingosine-1-phosphate'],
  'PAR1 (activated protein C analogue)': ['PAR1', 'F2R', 'activated protein C'],
  'Gut microbiome': ['microbiome', 'microbiota'],
  'SRD5A (5-alpha-reductase)': ['5-alpha reductase'],
  'Estrogen receptor': ['ESR1', 'oestrogen receptor'],
  'Androgen receptor': ['AR'],
  'Glucocorticoid receptor': ['NR3C1', 'corticosteroid'],
}

/**
 * Other names for the targets named in `text`. Matches a target given exactly,
 * or text that starts with the target's main name, so a free-text target such
 * as "SIGMAR1 (sigma-1 receptor) agonist" or "mTOR pathway" still gets the
 * synonyms of SIGMAR1 or mTOR.
 */
export function targetSynonyms(text: string): string[] {
  const exact = TARGET_SYNONYMS[text]
  if (exact) return exact
  const lower = text.toLowerCase()
  const out: string[] = []
  for (const [name, synonyms] of Object.entries(TARGET_SYNONYMS)) {
    const head = name.split(' (')[0].toLowerCase()
    if (lower.startsWith(head) && !/[0-9a-z]/.test(lower.charAt(head.length))) out.push(name, ...synonyms)
  }
  return out
}
