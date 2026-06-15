const EMPTY_LICENSE_ROW = {
  number: '',
  type: '',
  county: '',
  name: '',
  status: 'Active',
};

function normalizeLicenseRow(row) {
  return {
    number: String(row?.number || '').trim(),
    type: String(row?.type || '').trim(),
    county: String(row?.county || '').trim(),
    name: String(row?.name || '').trim(),
    status: row?.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function parseLicenseRows(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeLicenseRow);
    }
  } catch {}

  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((number) => normalizeLicenseRow({ number }));
}

function hasLicenseData(row) {
  const normalized = normalizeLicenseRow(row);
  return Boolean(normalized.number || normalized.type || normalized.county || normalized.name);
}

function licenseIdentity(row) {
  const normalized = normalizeLicenseRow(row);
  return normalized.number ? normalized.number.toUpperCase() : null;
}

function collectUniqueLicenseNumbers(records) {
  const numbers = new Set();
  for (const record of records || []) {
    for (const row of parseLicenseRows(record.licenseNo)) {
      const identity = licenseIdentity(row);
      if (identity) numbers.add(identity);
    }
  }
  return numbers;
}

function expandRecordsForCsv(records, recordType) {
  const rows = [];
  for (const record of records || []) {
    const parsedRows = parseLicenseRows(record.licenseNo).filter(hasLicenseData);
    const licenseRows = parsedRows.length > 0 ? parsedRows : [{ ...EMPTY_LICENSE_ROW }];
    for (const license of licenseRows) {
      rows.push({ recordType, record, license: normalizeLicenseRow(license) });
    }
  }
  return rows;
}

module.exports = {
  EMPTY_LICENSE_ROW,
  normalizeLicenseRow,
  parseLicenseRows,
  licenseIdentity,
  collectUniqueLicenseNumbers,
  expandRecordsForCsv,
};
