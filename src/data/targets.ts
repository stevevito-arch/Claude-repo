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
  'NAD+ metabolism': ['NAD', 'NAD+', 'NADH', 'nicotinamide adenine dinucleotide'],
  'Mitochondrial and energy metabolism': ['mitochondria', 'mitochondrial dysfunction', 'energy metabolism', 'bioenergetics', 'hypermetabolism'],
  'Stem-cell trophic and immune support': ['stem cells', 'mesenchymal stem cells', 'MSC', 'secretome', 'exosomes', 'paracrine'],
  'Fatty-acid oxidation (3-KAT)': ['3-ketoacyl-CoA thiolase', 'fatty-acid oxidation'],
  'SNAP-25 (acetylcholine release)': ['SNAP-25', 'SNARE', 'botulinum toxin'],
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
  // Parkinson's disease.
  'Alpha-synuclein': ['SNCA', 'α-synuclein', 'a-synuclein', 'synuclein'],
  LRRK2: ['leucine-rich repeat kinase 2', 'dardarin'],
  'Glucosylceramide synthase': ['UGCG', 'GCS'],
  'Dopamine D2/D3 receptors': ['DRD2', 'DRD3', 'D2 receptor', 'D3 receptor', 'dopamine agonist'],
  'Dopamine D1/D5 receptors': ['DRD1', 'DRD5', 'D1 receptor', 'dopamine agonist'],
  'Dopamine D3 receptor': ['DRD3', 'D3 receptor'],
  'Dopamine replacement': ['levodopa', 'L-dopa'],
  COMT: ['catechol-O-methyltransferase', 'COMT inhibitor'],
  'MAO-B': ['monoamine oxidase B', 'MAOB', 'MAO-B inhibitor'],
  'AADC (dopa decarboxylase)': ['DDC', 'aromatic L-amino acid decarboxylase', 'dopa decarboxylase'],
  VMAT2: ['SLC18A2', 'vesicular monoamine transporter 2'],
  'Adenosine A2A receptor': ['ADORA2A', 'A2A'],
  mGluR5: ['GRM5', 'metabotropic glutamate receptor 5'],
  mGluR4: ['GRM4', 'metabotropic glutamate receptor 4'],
  '5-HT1A receptor': ['HTR1A', 'serotonin 1A'],
  TAAR1: ['trace amine-associated receptor 1'],
  Acetylcholinesterase: ['ACHE', 'cholinesterase'],
  'Noradrenaline precursor': ['norepinephrine', 'noradrenaline'],
  'Noradrenaline transporter': ['NET', 'SLC6A2', 'norepinephrine transporter'],
  'α1-adrenergic receptor': ['alpha-1 adrenergic'],
  'α2-adrenergic receptor': ['alpha-2 adrenergic'],
  'β3-adrenergic receptor': ['beta-3 adrenergic', 'ADRB3'],
  'Histamine H3 receptor': ['HRH3', 'H3 receptor'],
  'Orexin receptors': ['HCRTR1', 'HCRTR2', 'hypocretin'],
  'GABA-A receptor': ['GABAA'],
  'GABA-B receptor': ['GABAB'],
  'GLP-1 receptor': ['GLP1R', 'GLP-1', 'glucagon-like peptide 1'],
  'DPP-4 (GLP-1 breakdown)': ['DPP4', 'dipeptidyl peptidase 4'],
  'L-type calcium channels (Cav1.3)': ['CACNA1D', 'Cav1.3', 'calcium channel blocker'],
  CDNF: ['cerebral dopamine neurotrophic factor'],
  'PDGF receptor': ['PDGF-BB', 'PDGFRB'],
  'GABA synthesis (GAD)': ['GAD', 'glutamic acid decarboxylase'],
  'TYK2/JAK1': ['TYK2', 'JAK1'],
  'Galectin-3': ['LGALS3'],
  'GM-CSF receptor': ['GM-CSF', 'CSF2RA'],
  'Amyloid-β': ['amyloid beta', 'APP'],
  GPR6: ['G protein-coupled receptor 6'],
}

// Pathways: each target belongs to one, so the target filter can be browsed by
// pathway and a pathway name finds all its studies. Listed in display order.
export const PATHWAYS = [
  'Genetic targets',
  'Dopamine system',
  'Nerve excitability and glutamate',
  'Inflammation and immunity',
  'Protein handling and stress responses',
  'Mitochondria and energy metabolism',
  'Oxidative stress',
  'Axons, synapses and muscle',
  'Growth factors and cell therapy',
  'Neurotransmitter and hormone receptors',
  'Other',
] as const
export type Pathway = (typeof PATHWAYS)[number]

const PATHWAY_MEMBERS: Record<Exclude<Pathway, 'Other'>, string[]> = {
  'Genetic targets': ['SOD1', 'FUS', 'TDP-43 (TARDBP)', 'C9orf72', 'ATXN2', 'STMN2', 'UNC13A', 'CHCHD10', 'SPTLC1', 'SMN2 splicing', 'Tau',
    'LRRK2'],
  'Dopamine system': ['Dopamine replacement', 'Dopamine D2 receptor', 'Dopamine D2/D3 receptors', 'Dopamine D1/D5 receptors', 'Dopamine D3 receptor',
    'Dopamine transporter', 'MAO-B', 'COMT', 'AADC (dopa decarboxylase)', 'VMAT2'],
  'Nerve excitability and glutamate': ['Voltage-gated sodium channels', 'Glutamate release', 'AMPA receptor', 'NMDA receptor',
    'EAAT2 (glutamate transporter)', 'KCNQ2/KCNQ3 (Kv7.2/7.3)', 'SV2A', 'T-type calcium channels', 'Na+/K+-ATPase', 'TRPA1', 'TRPV1',
    'mGluR5', 'mGluR4', 'L-type calcium channels (Cav1.3)', 'Voltage-gated calcium channels (α2δ)', 'GABA-A receptor', 'GABA-B receptor',
    'GABA synthesis (GAD)'],
  'Inflammation and immunity': ['C1q', 'C3 (complement)', 'C5 (complement)', 'TREM2', 'CSF1R', 'RIPK1', 'NLRP3 inflammasome', 'Regulatory T cells',
    'IL-2 receptor α (CD25)', 'IL-6 receptor', 'IL-1 receptor', 'IL-10', 'TNF-α', 'CD14', 'CD2', 'CD3', 'CD20 (B cells)', 'CD40L', 'CD80/CD86',
    'JAK', 'JAK1/JAK2', 'BTK', 'MPO (myeloperoxidase)', 'Microglial activation', 'Macrophage activation', 'Mast cells', 'KIT', 'PDGFR', 'FGFR3',
    'Immune modulation', 'Immunosuppression', 'Neuroinflammation', 'Calcineurin', 'IMPDH', 'COX-2', 'TSPO (microglial activation)', 'PDE4B',
    'Phosphodiesterases (PDE3/4/5/10)', 'Glucocorticoid receptor', 'S1P receptors', 'TGF-β receptor I (ALK5)', 'Melanocortin receptors (ACTH)',
    'Albumin replacement (plasma exchange)', 'Stem-cell and regulatory T-cell mobilisation', 'PAR1 (activated protein C analogue)',
    'TYK2/JAK1', 'Galectin-3', 'GM-CSF receptor', 'Leukotriene receptor (CysLT1)'],
  'Protein handling and stress responses': ['eIF2B', 'PPP1R15A (integrated stress response)', 'Heat shock response (HSP70)', 'HSP90 (epichaperome)',
    'Autophagy', 'mTOR', 'ER stress', 'Protein misfolding', 'XPO1', 'PIKFYVE', 'SORT1', 'GBA1 (glucocerebrosidase)', 'Histone deacetylases',
    'Histone acetylation', 'SRC/ABL kinases', 'MEK1/2', 'GSK-3β', 'miRNA biogenesis (Dicer)', 'Alpha-synuclein', 'Glucosylceramide synthase',
    'Amyloid-β', 'GM1 ganglioside'],
  'Mitochondria and energy metabolism': ['Mitochondrial and energy metabolism', 'NAD+ metabolism', 'Fatty-acid oxidation (3-KAT)', 'PPAR-α', 'PPARγ',
    'PGK1', 'AMPK', 'Copper delivery (SOD1, mitochondria)', 'GLP-1 receptor', 'DPP-4 (GLP-1 breakdown)', 'SGLT2', 'HMG-CoA reductase (statins)'],
  'Oxidative stress': ['Oxidative stress', 'Lipid peroxidation', 'Nrf2', 'ALOX15 (15-lipoxygenase)', 'Iron chelation', 'Metal homeostasis', 'Urate'],
  'Axons, synapses and muscle': ['SARM1', 'MAP3K12 (DLK)', 'MAP4K4', 'RTN4 (Nogo-A)', 'MuSK', 'Fast skeletal muscle troponin', 'ROCK (Rho kinase)',
    'Tubulin', 'Microtubules', 'CAPN2', 'TRIM72', 'Synapse regeneration', 'SNAP-25 (acetylcholine release)', 'β2-adrenergic receptor'],
  'Growth factors and cell therapy': ['Stem-cell trophic and immune support', 'Neurotrophic factors (BDNF, GDNF, VEGF, HGF)', 'Cell replacement', 'GDNF',
    'HGF', 'VEGFA', 'VEGF receptors', 'TrkA (NGF receptor)', 'IGF-1 receptor', 'GH receptor', 'EPO receptor', 'G-CSF receptor', 'Astrocyte support',
    'S100B (astrocytes)', 'Akt pathway', 'CDNF', 'PDGF receptor'],
  'Neurotransmitter and hormone receptors': ['SIGMAR1 (sigma-1 receptor)',
    'Dopamine and serotonin receptors', 'Serotonin receptors', 'Serotonin transporter', '5-HT2A receptor', '5-HT1A receptor', 'TAAR1', 'Monoamine reuptake',
    'Adenosine A2A receptor', 'Acetylcholinesterase', 'Nicotinic receptors', 'Noradrenaline precursor', 'Noradrenaline transporter',
    'α1-adrenergic receptor', 'α2-adrenergic receptor', 'β3-adrenergic receptor', 'Mineralocorticoid receptor', 'Histamine H3 receptor',
    'Orexin receptors', 'Opioid receptors', 'GPR6', 'Chloride channels (gut)', 'Guanylate cyclase-C', 'NHE3 (gut sodium transport)', 'Osmotic laxative',
    'Cannabinoid receptors', 'Melatonin receptors', 'Muscarinic receptors', 'Estrogen receptor', 'Androgen receptor', 'GnRH receptor',
    'SRD5A (5-alpha-reductase)', 'Retinoic acid receptors', 'Protein kinase C'],
}
const PATHWAY_OF = new Map(Object.entries(PATHWAY_MEMBERS).flatMap(([pathway, targets]) => targets.map((t) => [t, pathway as Pathway])))

/** The pathway a target belongs to; targets not yet assigned count as "Other". */
export function pathwayOf(target: string): Pathway {
  return PATHWAY_OF.get(target) ?? 'Other'
}

// Labels that name a broad process or cell type rather than a molecule a drug
// is known to act on. Shown as "Mechanism" instead of "Target".
export const MECHANISMS = new Set([
  'Mitochondrial and energy metabolism', 'NAD+ metabolism', 'Oxidative stress', 'Lipid peroxidation', 'Iron chelation', 'Metal homeostasis', 'Urate',
  'ER stress', 'Autophagy', 'Protein misfolding', 'Heat shock response (HSP70)', 'Histone acetylation', 'Immune modulation', 'Immunosuppression',
  'Neuroinflammation', 'Microglial activation', 'Macrophage activation', 'Mast cells', 'Regulatory T cells', 'Albumin replacement (plasma exchange)',
  'Stem-cell and regulatory T-cell mobilisation', 'Stem-cell trophic and immune support', 'Cell replacement', 'Astrocyte support', 'Synapse regeneration',
  'Glutamate release', 'Gut microbiome', 'Blood-brain barrier', 'Dopamine replacement', 'Monoamine reuptake', 'Copper delivery (SOD1, mitochondria)',
  'Vitamin B12 (methylation)', 'Akt pathway', 'Undisclosed', 'Osmotic laxative', 'GABA synthesis (GAD)',
])

/**
 * Other names for the targets named in `text`. Matches a target given exactly,
 * or text that starts with the target's main name, so a free-text target such
 * as "SIGMAR1 (sigma-1 receptor) agonist" or "mTOR pathway" still gets the
 * synonyms of SIGMAR1 or mTOR.
 */
export function targetSynonyms(text: string): string[] {
  const exact = TARGET_SYNONYMS[text]
  const pathway = PATHWAY_OF.get(text)
  // A target's pathway name finds it too ("mitochondria and energy metabolism").
  if (exact || pathway) return [...(exact ?? []), ...(pathway ? [pathway] : [])]
  const lower = text.toLowerCase()
  const out: string[] = []
  for (const [name, synonyms] of Object.entries(TARGET_SYNONYMS)) {
    const head = name.split(' (')[0].toLowerCase()
    if (lower.startsWith(head) && !/[0-9a-z]/.test(lower.charAt(head.length))) out.push(name, ...synonyms)
  }
  return out
}
