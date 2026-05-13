// Shared license-type catalog — single source of truth used by the
// Members form, Leads form, Settings tier-pricing matrix, and CSV importer.
//
// The list reflects Mississippi's medical-cannabis program license
// categories. Two compound categories help businesses that hold
// multiple licenses without forcing users to pick "Other" every time:
//
//   • Cultivator/Processor   — holds both cultivation and processing.
//   • Vertically Integrated  — holds Cultivation, Processing, Transport,
//                              and Dispensary licenses.
//
// Operators can also add their own categories on the Settings page;
// those custom types are merged in via `getAllLicenseTypes(settings)`
// so they appear in every dropdown automatically.

export const DEFAULT_LICENSE_TYPES = [
  'Dispensary',
  'Cultivator Facility',
  'Micro-Cultivation',
  'Processing Facility',
  'Micro-Processing',
  'Cultivator/Processor',
  'Vertically Integrated',
  'Transportation Entity',
  'Testing Facility',
  'Disposal Entity',
  'Practitioner',
  'Ancillary',
];

// Pull custom types out of the persisted settings object.
// Accepts either the explicit `customLicenseTypes` array (preferred) or
// falls back to inferring them from `tierPricing` keys (older saves).
export function extractCustomLicenseTypes(settings) {
  if (!settings) return [];
  if (Array.isArray(settings.customLicenseTypes)) {
    return settings.customLicenseTypes.filter(t => t && !DEFAULT_LICENSE_TYPES.includes(t));
  }
  const tp = settings.tierPricing && typeof settings.tierPricing === 'object' ? settings.tierPricing : {};
  return Object.keys(tp).filter(t => !DEFAULT_LICENSE_TYPES.includes(t));
}

export function getAllLicenseTypes(settings) {
  return [...DEFAULT_LICENSE_TYPES, ...extractCustomLicenseTypes(settings)];
}
