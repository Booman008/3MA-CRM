import { S } from '../styles.js';

export function Field({ label, children }) {
  return <div className="crm-form-row" style={S.formRow}><label style={S.label}>{label}</label>{children}</div>;
}
