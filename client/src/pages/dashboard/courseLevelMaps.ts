// Pure data tables describing course-level relationships.
// Extracted from dashboard.tsx (Phase 1 of dashboard refactor).
// These have no React/state dependencies and are safe to import anywhere.

export const l1ToL2Map: Record<string, string> = {
  'L1_PPA120': 'L2_PPA120',
  'L1_PPA121': 'L2_PPA121',
  'L1_PPA122': 'L2_PPA122',
  'L1_PPA124': 'L2_PPA124',
};

export const previousLevelMap: Record<string, string[]> = {
  'L2_PPA120': ['L1_PPA120'],
  'L2_PPA121': ['L1_PPA121'],
  'L2_PPA122': ['L1_PPA122'],
  'L2_PPA124': ['L1_PPA124'],
  'L3_PPA235': ['L2_PPA235'],
  'L3_PPA303': ['L2_PPA303'],
  'L3_PPA319': ['L2_PPA319'],
};

// Derived inverse of previousLevelMap: for each earlier course, which later
// courses depend on it. Computed once at module load instead of every render.
export const laterLevelMap: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  Object.entries(previousLevelMap).forEach(([later, earlierIds]) => {
    earlierIds.forEach((eid) => {
      if (!out[eid]) out[eid] = [];
      out[eid].push(later);
    });
  });
  return out;
})();
