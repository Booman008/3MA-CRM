import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { Field } from '../components/Field.jsx';

const DEFAULT_LICENSE_TYPES = ['Retail', 'Grower/Processor', 'Dispensary', 'Transport', 'Testing Lab', 'Micro', 'Practitioner', 'Other'];
const DEFAULT_TIERS = ['Affiliate', 'Member', 'Board Member', 'Corporate Sponsor'];

export function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [userName, setUserName] = useState('');
  const [userTitle, setUserTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [tierPricing, setTierPricing] = useState({});
  const [customLicenseTypes, setCustomLicenseTypes] = useState([]);
  const [newLicenseType, setNewLicenseType] = useState('');

  useEffect(() => {
    api('/settings').then(s => {
      setSettings(s);
      setUserName(s.userName || '');
      setUserTitle(s.userTitle || '');
      setOrganizationName(s.organizationName || '');
      const tp = typeof s.tierPricing === 'object' ? s.tierPricing : {};
      setTierPricing(tp);
      const allLicTypes = Object.keys(tp);
      setCustomLicenseTypes(allLicTypes.filter(t => !DEFAULT_LICENSE_TYPES.includes(t)));
    }).finally(() => setLoading(false));
  }, []);

  const allLicenseTypes = [...DEFAULT_LICENSE_TYPES, ...customLicenseTypes.filter(t => !DEFAULT_LICENSE_TYPES.includes(t))];

  const setPrice = (licenseType, tier, value) => {
    setTierPricing(prev => {
      const updated = { ...prev };
      if (!updated[licenseType]) updated[licenseType] = {};
      updated[licenseType] = { ...updated[licenseType], [tier]: value };
      return updated;
    });
  };

  const getPrice = (licenseType, tier) => tierPricing[licenseType]?.[tier] ?? '';

  const addLicenseType = () => {
    const trimmed = newLicenseType.trim();
    if (!trimmed || allLicenseTypes.includes(trimmed)) return;
    setCustomLicenseTypes(prev => [...prev, trimmed]);
    setNewLicenseType('');
  };

  const removeLicenseType = (type) => {
    setCustomLicenseTypes(prev => prev.filter(t => t !== type));
    setTierPricing(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api('/settings', {
        method: 'PUT',
        body: { userName, userTitle, organizationName, tierPricing },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={S.emptyState}>Loading settings...</div>;

  const sectionStyle = { ...S.card, marginBottom: 24 };
  const sectionTitle = { fontSize: '1.05rem', fontWeight: 700, color: 'var(--green-800)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Settings</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: '.9rem' }}>Settings saved!</span>}
          <button style={S.btn()} onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitle}>Your Profile</div>
        <div style={S.formGrid}>
          <Field label="Your Name">
            <input style={S.input} value={userName} onChange={e => setUserName(e.target.value)} placeholder="e.g. John Smith" />
          </Field>
          <Field label="Your Title">
            <input style={S.input} value={userTitle} onChange={e => setUserTitle(e.target.value)} placeholder="e.g. Executive Director" />
          </Field>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitle}>Organization</div>
        <div style={{ maxWidth: 400 }}>
          <Field label="Organization Name">
            <input style={S.input} value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="e.g. 3MA" />
          </Field>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitle}>Default Membership Tier Pricing by License Type</div>
        <p style={{ fontSize: '.85rem', color: 'var(--text-light)', marginBottom: 16 }}>
          Set the default annual dues for each license type and membership tier. These values will be used as defaults when adding new members.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Field label="Add Custom License Type">
              <input style={S.input} value={newLicenseType} onChange={e => setNewLicenseType(e.target.value)}
                placeholder="e.g. Cultivation" onKeyDown={e => { if (e.key === 'Enter') addLicenseType(); }} />
            </Field>
          </div>
          <button style={{ ...S.btn(), marginBottom: 14 }} onClick={addLicenseType} disabled={!newLicenseType.trim()}>Add</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 160 }}>License Type</th>
                {DEFAULT_TIERS.map(tier => (
                  <th key={tier} style={{ ...S.th, minWidth: 120, textAlign: 'center' }}>
                    <span style={S.badge(tier === 'Corporate Sponsor' ? '#7b1fa2' : tier === 'Board Member' ? 'var(--warning)' : tier === 'Member' ? 'var(--green-600)' : 'var(--info)')}>{tier}</span>
                  </th>
                ))}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {allLicenseTypes.map(licType => {
                const isCustom = !DEFAULT_LICENSE_TYPES.includes(licType);
                return (
                  <tr key={licType} style={{ background: isCustom ? 'var(--green-50)' : 'transparent' }}>
                    <td style={{ ...S.td, fontWeight: 600, fontSize: '.88rem' }}>
                      {licType}
                      {isCustom && <span style={{ fontSize: '.72rem', color: 'var(--text-light)', marginLeft: 6 }}>(custom)</span>}
                    </td>
                    {DEFAULT_TIERS.map(tier => (
                      <td key={tier} style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '.85rem', pointerEvents: 'none' }}>$</span>
                          <input
                            type="number" step="0.01" min="0"
                            style={{ ...S.input, width: 110, textAlign: 'right', paddingLeft: 22 }}
                            value={getPrice(licType, tier)}
                            onChange={e => setPrice(licType, tier, e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                    ))}
                    <td style={S.td}>
                      {isCustom && (
                        <button onClick={() => removeLicenseType(licType)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.8rem', padding: '4px 8px' }}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
        {saved && <span style={{ color: 'var(--green-600)', fontWeight: 500, fontSize: '.9rem' }}>Settings saved!</span>}
        <button style={S.btn()} onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
