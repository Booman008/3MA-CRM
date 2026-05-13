import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal.jsx';
import { Field } from './Field.jsx';
import { S } from '../styles.js';
import { dedupeLicenseRows, firstLicenseType, normalizeLicenseRow, parseLicenseRows, serializeLicenseRows } from '../licenses.js';

function buildMergedNotes(primary, members) {
  const sections = [];
  const primaryNotes = (primary.notes || '').trim();
  if (primaryNotes) sections.push(primaryNotes);
  for (const member of members) {
    if (member.id === primary.id) continue;
    const note = (member.notes || '').trim();
    if (!note || note === primaryNotes) continue;
    sections.push(`--- Merged from ${member.businessName} ---\n${note}`);
  }
  return sections.join('\n\n').trim();
}

function getFieldDefault(primary, members, field) {
  const primaryValue = primary[field];
  if (primaryValue != null && String(primaryValue).trim() !== '') return primaryValue;
  const uniqueValues = [...new Set(
    members
      .map(member => member[field])
      .filter(value => value != null && String(value).trim() !== '')
      .map(value => String(value).trim())
  )];
  return uniqueValues.length === 1 ? uniqueValues[0] : (primaryValue ?? '');
}

function getConflicts(members, primaryId, fields) {
  const primary = members.find(member => member.id === primaryId);
  if (!primary) return {};
  const conflicts = {};
  for (const field of fields) {
    const values = [...new Set(
      members
        .map(member => member[field])
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value).trim())
    )];
    const primaryValue = primary[field] == null ? '' : String(primary[field]).trim();
    const alternates = values.filter(value => value !== primaryValue);
    if (alternates.length > 0) conflicts[field] = alternates;
  }
  return conflicts;
}

export function MergeMembersModal({ members, onClose, onConfirm }) {
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.businessName.localeCompare(b.businessName)), [members]);
  const [primaryId, setPrimaryId] = useState(sortedMembers[0]?.id || null);
  const [mergedForm, setMergedForm] = useState(null);
  const [licenseRows, setLicenseRows] = useState([]);
  const [selectedLicenseIds, setSelectedLicenseIds] = useState([]);
  const fieldNames = ['businessName', 'ownerName', 'phone', 'email', 'county', 'membershipTier', 'joinDate', 'renewalDate', 'duesAmount', 'notes'];

  useEffect(() => {
    const primary = sortedMembers.find(member => member.id === primaryId) || sortedMembers[0];
    if (!primary) return;
    const mergedLicenses = dedupeLicenseRows(sortedMembers.flatMap(member => parseLicenseRows(member.licenseNo)))
      .map((row, index) => ({ ...normalizeLicenseRow(row), _rowId: `merge-${index}` }));
    setLicenseRows(mergedLicenses);
    setSelectedLicenseIds([]);
    setMergedForm({
      businessName: getFieldDefault(primary, sortedMembers, 'businessName'),
      ownerName: getFieldDefault(primary, sortedMembers, 'ownerName'),
      phone: getFieldDefault(primary, sortedMembers, 'phone'),
      email: getFieldDefault(primary, sortedMembers, 'email'),
      county: getFieldDefault(primary, sortedMembers, 'county'),
      membershipTier: getFieldDefault(primary, sortedMembers, 'membershipTier'),
      joinDate: getFieldDefault(primary, sortedMembers, 'joinDate'),
      renewalDate: getFieldDefault(primary, sortedMembers, 'renewalDate'),
      duesAmount: primary.duesAmount ?? '',
      notes: buildMergedNotes(primary, sortedMembers),
    });
  }, [sortedMembers, primaryId]);

  const primary = sortedMembers.find(member => member.id === primaryId) || null;
  const conflicts = useMemo(() => getConflicts(sortedMembers, primaryId, fieldNames), [sortedMembers, primaryId]);

  if (!primary || !mergedForm) return null;

  const toggleLicense = (rowId) => {
    setSelectedLicenseIds(prev => prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]);
  };

  const removeSelectedLicenses = () => {
    setLicenseRows(prev => prev.filter(row => !selectedLicenseIds.includes(row._rowId)));
    setSelectedLicenseIds([]);
  };

  const setField = (field, value) => setMergedForm(prev => ({ ...prev, [field]: value }));

  const submit = () => {
    const normalizedRows = licenseRows.map(({ _rowId, ...row }) => row);
    const licenseNo = serializeLicenseRows(normalizedRows);
    onConfirm({
      primaryId,
      memberIds: sortedMembers.map(member => member.id),
      mergedMember: {
        ...mergedForm,
        county: mergedForm.county || (normalizedRows.find(row => row.county) || {}).county || null,
        licenseNo,
        licenseType: firstLicenseType(licenseNo),
        duesAmount: mergedForm.duesAmount === '' ? null : Number(mergedForm.duesAmount),
      },
    });
  };

  return (
    <Modal title="Merge Members" onClose={onClose}>
      <div style={{ color: 'var(--color-muted)', fontSize: '.88rem', marginBottom: 16 }}>
        Choose the surviving record, review merged fields, and confirm. Non-primary member rows will be deleted.
      </div>

      <div style={{ ...S.formRow, paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--color-divider)' }}>
        <label style={S.label}>Primary Record</label>
        <div style={{ display: 'grid', gap: 8 }}>
          {sortedMembers.map(member => (
            <label key={member.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="radio" name="primary-member" checked={primaryId === member.id} onChange={() => setPrimaryId(member.id)} style={{ marginTop: 3, accentColor: 'var(--color-gold)' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-navy)' }}>{member.businessName}</div>
                <div style={{ color: 'var(--color-muted)', fontSize: '.8rem' }}>
                  {member.ownerName || 'No owner'} {member.county ? `· ${member.county}` : ''} {member.renewalDate ? `· Renewal ${member.renewalDate}` : ''}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={S.formGrid}>
        <Field label="Business Name">
          <input style={S.input} value={mergedForm.businessName} onChange={e => setField('businessName', e.target.value)} />
          {conflicts.businessName && <div style={{ fontSize: '.76rem', color: 'var(--color-muted)', marginTop: 4 }}>Other values: {conflicts.businessName.join(' · ')}</div>}
        </Field>
        <Field label="Owner Name">
          <input style={S.input} value={mergedForm.ownerName} onChange={e => setField('ownerName', e.target.value)} />
          {conflicts.ownerName && <div style={{ fontSize: '.76rem', color: 'var(--color-muted)', marginTop: 4 }}>Other values: {conflicts.ownerName.join(' · ')}</div>}
        </Field>
        <Field label="Phone">
          <input style={S.input} value={mergedForm.phone} onChange={e => setField('phone', e.target.value)} />
        </Field>
        <Field label="Email">
          <input style={S.input} value={mergedForm.email} onChange={e => setField('email', e.target.value)} />
        </Field>
        <Field label="County">
          <input style={S.input} value={mergedForm.county} onChange={e => setField('county', e.target.value)} />
          {conflicts.county && <div style={{ fontSize: '.76rem', color: 'var(--color-muted)', marginTop: 4 }}>Other values: {conflicts.county.join(' · ')}</div>}
        </Field>
        <Field label="Membership Tier">
          <input style={S.input} value={mergedForm.membershipTier} onChange={e => setField('membershipTier', e.target.value)} />
        </Field>
        <Field label="Join Date">
          <input style={S.input} type="date" value={mergedForm.joinDate} onChange={e => setField('joinDate', e.target.value)} />
        </Field>
        <Field label="Renewal Date">
          <input style={S.input} type="date" value={mergedForm.renewalDate} onChange={e => setField('renewalDate', e.target.value)} />
        </Field>
        <Field label="Dues Amount ($)">
          <input style={S.input} type="number" step="0.01" value={mergedForm.duesAmount} onChange={e => setField('duesAmount', e.target.value)} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={mergedForm.notes} onChange={e => setField('notes', e.target.value)} />
        {conflicts.notes && <div style={{ fontSize: '.76rem', color: 'var(--color-muted)', marginTop: 4 }}>Merged notes include non-primary record notes where present.</div>}
      </Field>

      <div style={{ ...S.formRow, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={S.label}>Merged Licenses</label>
          {selectedLicenseIds.length > 0 && (
            <button type="button" style={S.btn('danger')} onClick={removeSelectedLicenses}>
              Delete Selected Licenses ({selectedLicenseIds.length})
            </button>
          )}
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: '.82rem', marginBottom: 8 }}>
          Exact duplicate licenses are deduped automatically. Uncheck any remaining license rows you do not want to keep.
        </div>
        {licenseRows.length === 0 ? (
          <div style={{ color: 'var(--color-muted)', fontSize: '.85rem' }}>No licenses remain in this merge.</div>
        ) : (
          <div style={{ border: '1px solid var(--color-divider)', borderRadius: 8, overflow: 'hidden' }}>
            {licenseRows.map(row => (
              <label key={row._rowId} style={{ display: 'grid', gridTemplateColumns: '24px 1.2fr 1fr .9fr 1.1fr .8fr', gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedLicenseIds.includes(row._rowId)} onChange={() => toggleLicense(row._rowId)} style={{ accentColor: 'var(--color-gold)' }} />
                <span>{row.number || '—'}</span>
                <span>{row.type || '—'}</span>
                <span>{row.county || '—'}</span>
                <span>{row.name || '—'}</span>
                <span>{row.status}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button style={S.btn('secondary')} onClick={onClose}>Cancel</button>
        <button style={S.btn()} onClick={submit} disabled={licenseRows.length === 0 && !mergedForm.businessName}>
          Confirm Merge
        </button>
      </div>
    </Modal>
  );
}
