// Lead pipeline stages, split into active (shown by default) and archived
// (hidden from kanban unless toggled, but kept for marketplace tracking).

export const ACTIVE_STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost', 'FireCraft'];
export const ARCHIVED_STAGES = ['Not Pursuing', 'Closed/NA', 'Cannot Afford'];
export const ALL_STAGES = [...ACTIVE_STAGES, ...ARCHIVED_STAGES];

// Backward-compat alias so existing imports of STAGES keep working.
export const STAGES = ALL_STAGES;

export const isArchivedStage = (stage) => ARCHIVED_STAGES.includes(stage);

export const stageColor = {
  New: 'var(--info)',
  Contacted: 'var(--green-500)',
  Qualified: 'var(--warning)',
  Proposal: '#7b1fa2',
  Won: 'var(--green-700)',
  Lost: 'var(--danger)',
  FireCraft: '#ff7043',
  'Not Pursuing': '#9e9e9e',
  'Closed/NA': '#616161',
  'Cannot Afford': '#795548',
};

export const stageHeaderBg = {
  New: '#e3f2fd',
  Contacted: '#e8f5e9',
  Qualified: '#fff3e0',
  Proposal: '#f3e5f5',
  Won: '#e8f5e9',
  Lost: '#ffebee',
  FireCraft: '#fff3e0',
  'Not Pursuing': '#f5f5f5',
  'Closed/NA': '#eeeeee',
  'Cannot Afford': '#efebe9',
};
