import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { S } from '../styles.js';
import { Field } from '../components/Field.jsx';
import { DEFAULT_LICENSE_TYPES, extractCustomLicenseTypes } from '../licenseTypes.js';
import { setCachedSettings, refreshSettings } from '../useSettings.js';

const DEFAULT_TIERS = ['Affiliate', 'Member', 'Board Member', 'Corporate Sponsor'];

// Brand-aligned tier badge colours — gold leads, red rationed to alerts only.
const tierBadgeBg = {
  Affiliate:           'var(--color-navy)',
  Member:              'var(--color-navy-hover)',
  'Board Member':      'var(--color-gold)',
  'Corporate Sponsor': 'var(--color-gold-hover)',
};
const tierBadgeText = (tier) =>
  tier === 'Board Member' || tier === 'Corporate Sponsor' ? 'var(--color-navy)' : '#fff';

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
      const tp = typeof s.tierPricing === 'object' && s.tierPricing !== null ? s.tierPricing : {};
      setTierPricing(tp);
      setCustomLicenseTypes(extractCustomLicenseTypes(s));
      // Seed the cross-page settings cache so Members / Leads see the same data.
      setCachedSettings(s);
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
      const updated = await api('/settings', {
        method: 'PUT',
        body: { userName, userTitle, organizationName, tierPricing, customLicenseTypes },
      });
      setSettings(updated);
      // Refresh the cross-page cache so the Members and Leads dropdowns
      // pick up any new custom license types immediately.
      setCachedSettings(updated);
      // Belt-and-braces: re-fetch from the server in the background.
      refreshSettings().catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={S.emptyState}>Loading settings...</div>;

  const sectionStyle = { ...S.card, marginBottom: 24 };
  const sectionTitle = {
    fontFamily: 'var(--font-heading)', fontSize: '0.82rem', fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--color-navy)', marginBottom: 16, paddingBottom: 10,
    borderBottom: '1px solid var(--color-divider)',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={S.pageTitle}>Settings</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '.9rem' }}>Settings saved!</span>}
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
        <p style={{ fontSize: '.85rem', color: 'var(--color-muted)', marginBottom: 16 }}>
          Set the default annual dues for each license type and membership tier.
          Custom license types added below become available in the Members and Leads
          dropdowns immediately after saving.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Field label="Add Custom License Type">
              <input style={S.input} value={newLicenseType} onChange={e => setNewLicenseType(e.target.value)}
                placeholder="e.g. Delivery Service" onKeyDown={e => { if (e.key === 'Enter') addLicenseType(); }} />
            </Field>
          </div>
          <button style={{ ...S.btn(), marginBottom: 14 }} onClick={addLicenseType} disabled={!newLicenseType.trim()}>Add</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 200 }}>License Type</th>
                {DEFAULT_TIERS.map(tier => (
                  <th key={tier} style={{ ...S.th, minWidth: 130, textAlign: 'center' }}>
                    <span style={{ ...S.badge(tierBadgeBg[tier] || 'var(--color-navy)'), color: tierBadgeText(tier) }}>{tier}</span>
                  </th>
                ))}
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {allLicenseTypes.map(licType => {
                const isCustom = !DEFAULT_LICENSE_TYPES.includes(licType);
                return (
                  <tr key={licType} style={{ background: isCustom ? 'var(--color-callout-gold-bg)' : 'transparent' }}>
                    <td style={{ ...S.td, fontWeight: 600, fontSize: '.88rem', color: 'var(--color-navy)' }}>
                      {licType}
                      {isCustom && <span style={{ fontSize: '.66rem', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-gold-hover)', marginLeft: 8, fontWeight: 800 }}>Custom</span>}
                    </td>
                    {DEFAULT_TIERS.map(tier => (
                      <td key={tier} style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)', fontSize: '.85rem', pointerEvents: 'none' }}>$</span>
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
                          style={{
                            background: 'none', border: 'none', color: 'var(--color-red)', cursor: 'pointer',
                            fontFamily: 'var(--font-heading)', fontSize: '.66rem', fontWeight: 800,
                            letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 8px',
                          }}>
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
        {saved && <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '.9rem' }}>Settings saved!</span>}
        <button style={S.btn()} onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
