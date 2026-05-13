// Lead pipeline stages, split into active (shown by default) and archived
// (hidden from kanban unless toggled, but kept for marketplace tracking).
//
// Colour values map to the 3MA brand palette (navy / gold / red, plus a
// success-green reserved for the "Won" stage). Archived rows use neutral
// greys so they read as out-of-funnel.

export const ACTIVE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost', 'FireCraft'];
export const ARCHIVED_STAGES = ['Not Pursuing', 'Closed/NA', 'Cannot Afford'];
export const ALL_STAGES = [...ACTIVE_STAGES, ...ARCHIVED_STAGES];

// Backward-compat alias so existing imports of STAGES keep working.
export const STAGES = ALL_STAGES;

export const isArchivedStage = (stage) => ARCHIVED_STAGES.includes(stage);

// Pill / dot / bar colours — 3MA brand palette.
export const stageColor = {
  New:           'var(--color-navy)',
  Contacted:     'var(--color-navy-hover)',
  Qualified:     'var(--color-gold)',
  Proposal:      'var(--color-gold-hover)',
  Won:           'var(--color-success)',
  Lost:          'var(--color-red)',
  FireCraft:     '#ff7043',           // distinctive orange for the co-op
  'Not Pursuing': 'var(--color-muted)',
  'Closed/NA':    '#616161',
  'Cannot Afford':'#795548',
};

// Subtle kanban-column header tints. Active stages map to the official
// brand callout tints; archived stages stay neutral grey.
export const stageHeaderBg = {
  New:           'var(--color-callout-navy-bg)',
  Contacted:     'var(--color-callout-navy-bg)',
  Qualified:     'var(--color-callout-gold-bg)',
  Proposal:      'var(--color-callout-gold-bg)',
  Won:           '#e6f3ec',                       // soft success green
  Lost:          'var(--color-callout-red-bg)',
  FireCraft:     'var(--color-callout-gold-bg)',
  'Not Pursuing': '#f5f5f5',
  'Closed/NA':    '#eeeeee',
  'Cannot Afford':'#efebe9',
};

// Stages whose pill background is light enough that the stage label
// needs dark (navy) text rather than white.
export const stageNeedsDarkText = (stage) =>
  stage === 'Qualified' || stage === 'Proposal' || stage === 'FireCraft';
