export const LICENSE_STATUS_OPTIONS = ['Active', 'Inactive'];

export const EMPTY_LICENSE_ROW = {
  number: '',
  type: '',
  county: '',
  name: '',
  status: 'Active',
};

export function normalizeLicenseRow(row) {
  return {
    number: String(row?.number || '').trim(),
    type: String(row?.type || '').trim(),
    county: String(row?.county || '').trim(),
    name: String(row?.name || '').trim(),
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

export function parseLicenseRows(value) {
  if (!value) return [{ ...EMPTY_LICENSE_ROW }];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeLicenseRow);
    }
  } catch {}
  const parts = String(value).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) return parts.map(number => normalizeLicenseRow({ number }));
  return [{ ...EMPTY_LICENSE_ROW }];
}

export function serializeLicenseRows(rows) {
  const normalized = (rows || [])
    .map(normalizeLicenseRow)
    .filter(row => row.number || row.type || row.county || row.name);
  return normalized.length ? JSON.stringify(normalized) : null;
}

export function parseLicenseNumbers(value) {
  return parseLicenseRows(value).map(row => row.number).filter(Boolean);
}

export function parseLicenseTypes(value) {
  return parseLicenseRows(value).map(row => row.type).filter(Boolean);
}

export function parseLicenseCounties(value) {
  const out = [];
  for (const row of parseLicenseRows(value)) {
    if (row.county && !out.includes(row.county)) out.push(row.county);
  }
  return out;
}

export function firstLicenseType(value) {
  return parseLicenseRows(value).find(row => row.type)?.type || null;
}

export function hasRealLicenseRows(rows) {
  return (rows || []).some(row => {
    const normalized = normalizeLicenseRow(row);
    return normalized.number || normalized.type || normalized.county || normalized.name;
  });
}
