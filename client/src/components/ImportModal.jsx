import { useState } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { Modal } from './Modal.jsx';
import { parseCSV, parseFlexibleDate } from '../format.js';

const FIELD_ALIASES = {
  licenseNo: ['license no.', 'license no', 'license number', 'license #', 'license'],
  businessName: ['business name', 'business', 'name', 'company', 'entity'],
  dba: ['dba'],
  licenseType: ['business type', 'license type', 'type'],
  status: ['status'],
  county: ['county'],
  renewalDate: ['expiration', 'expiration date', 'renewal', 'renewal date'],
  joinDate: ['license issue date', 'issue date', 'join date'],
  ownerName: ['owner name', 'owner', 'owners'],
  physicalAddress: ['physical address', 'address'],
  mailingAddress: ['mailing address'],
  phone: ['phone number', 'phone'],
  email: ['email address', 'email'],
  lastTouch: ['last touch'],
  facebook: ['facebook'],
};

function buildHeaderMap(headerRow) {
  const norm = headerRow.map(h => h.trim().toLowerCase());
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = norm.findIndex(h => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

function rowToRecord(row, headerMap) {
  const get = (k) => {
    const i = headerMap[k];
    if (i == null) return '';
    return (row[i] || '').trim();
  };
  const license = get('licenseNo');
  const businessName = get('businessName') || license;
  const noteParts = [];
  const physical = get('physicalAddress');
  const mailing = get('mailingAddress');
  if (physical) noteParts.push(`Physical: ${physical}`);
  if (mailing && mailing !== physical) noteParts.push(`Mailing: ${mailing}`);
  const dba = get('dba');
  if (dba) noteParts.push(`DBA: ${dba}`);
  const lastTouch = get('lastTouch');
  if (lastTouch) noteParts.push(`Last Touch: ${lastTouch}`);
  return {
    status: get('status') || '(blank)',
    businessName,
    licenseNo: license ? JSON.stringify([{ number: license, type: get('licenseType') || '' }]) : null,
    licenseType: get('licenseType') || null,
    county: get('county') || null,
    ownerName: get('ownerName') || null,
    phone: get('phone') || null,
    email: get('email') || null,
    joinDate: parseFlexibleDate(get('joinDate')),
    renewalDate: parseFlexibleDate(get('renewalDate')),
    notes: noteParts.length ? noteParts.join('\n') : null,
  };
}

const ROUTE_OPTIONS = [
  { value: 'member', label: 'Import as Members' },
  { value: 'lead', label: 'Import as Leads' },
  { value: 'skip', label: 'Skip' },
];

function defaultRoute(status) {
  const s = (status || '').toLowerCase();
  if (s === 'member') return 'member';
  if (s.includes('possible') || s.includes('pipeline')) return 'lead';
  return 'skip';
}

export function ImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('pick');
  const [filename, setFilename] = useState('');
  const [records, setRecords] = useState([]);
  const [headerMap, setHeaderMap] = useState({});
  const [routes, setRoutes] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (file) => {
    setError('');
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result));
        if (rows.length < 2) { setError('CSV has no data rows.'); return; }
        const map = buildHeaderMap(rows[0]);
        if (map.businessName == null && map.licenseNo == null) {
          setError('Could not find Business Name or License No. column.');
          return;
        }
        const recs = rows.slice(1).map(r => rowToRecord(r, map)).filter(r => r.businessName);
        const statusList = [...new Set(recs.map(r => r.status))];
        const initial = {};
        for (const s of statusList) initial[s] = defaultRoute(s);
        setHeaderMap(map);
        setRecords(recs);
        setRoutes(initial);
        setStep('review');
      } catch (e) {
        setError(`Failed to parse CSV: ${e.message}`);
      }
    };
    reader.readAsText(file);
  };

  const grouped = {};
  for (const r of records) {
    if (!grouped[r.status]) grouped[r.status] = [];
    grouped[r.status].push(r);
  }
  const statuses = Object.keys(grouped).sort();

  const memberCount = records.filter(r => routes[r.status] === 'member').length;
  const leadCount = records.filter(r => routes[r.status] === 'lead').length;
  const skipCount = records.length - memberCount - leadCount;

  const doImport = async () => {
    setBusy(true);
    setError('');
    try {
      const memberRows = records
        .filter(r => routes[r.status] === 'member')
        .map(({ status, ...rest }) => rest);
      const leadRows = records
        .filter(r => routes[r.status] === 'lead')
        .map(({ status, ...rest }) => ({
          ...rest,
          notes: rest.notes ? `Source: ${status}\n${rest.notes}` : `Source: ${status}`,
          stage: 'New',
        }));
      const out = { members: 0, leads: 0 };
      if (memberRows.length) {
        const res = await api('/members/bulk', { method: 'POST', body: { rows: memberRows } });
        out.members = res.inserted || 0;
      }
      if (leadRows.length) {
        const res = await api('/leads/bulk', { method: 'POST', body: { rows: leadRows } });
        out.leads = res.inserted || 0;
      }
      setResult(out);
      setStep('done');
      if (onImported) onImported(out);
    } catch (e) {
      setError(`Import failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Mass Import from CSV" onClose={onClose}>
      {step === 'pick' && (
        <div>
          <p style={{ color: 'var(--text-light)', fontSize: '.9rem', marginBottom: 16 }}>
            Upload your master sheet CSV. The importer will read the <strong>Status</strong> column and let you choose
            where each status routes (Members, Leads, or Skip).
          </p>
          <input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {error && <div style={{ color: 'var(--danger)', marginTop: 12, fontSize: '.88rem' }}>{error}</div>}
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ marginBottom: 12, fontSize: '.88rem', color: 'var(--text-light)' }}>
            <strong>{filename}</strong> — {records.length} row{records.length !== 1 ? 's' : ''} parsed.
          </div>
          <table style={{ ...S.table, marginBottom: 16 }}>
            <thead><tr>
              <th style={S.th}>Status</th><th style={S.th}>Count</th><th style={S.th}>Route to</th>
            </tr></thead>
            <tbody>
              {statuses.map(s => (
                <tr key={s}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{s}</td>
                  <td style={S.td}>{grouped[s].length}</td>
                  <td style={S.td}>
                    <select style={S.select} value={routes[s]} onChange={e => setRoutes({ ...routes, [s]: e.target.value })}>
                      {ROUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ background: 'var(--green-50, #f1f8e9)', padding: '10px 14px', borderRadius: 6, fontSize: '.88rem', marginBottom: 12 }}>
            Will import <strong>{memberCount}</strong> as members, <strong>{leadCount}</strong> as leads.
            Skipping <strong>{skipCount}</strong>.
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: '.88rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={S.btn('secondary')} onClick={() => setStep('pick')} disabled={busy}>Back</button>
            <button style={S.btn()} onClick={doImport} disabled={busy || (memberCount + leadCount === 0)}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div>
          <p style={{ fontSize: '.95rem', marginBottom: 12 }}>
            Imported <strong>{result?.members || 0}</strong> member{result?.members === 1 ? '' : 's'} and{' '}
            <strong>{result?.leads || 0}</strong> lead{result?.leads === 1 ? '' : 's'}.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={S.btn()} onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
