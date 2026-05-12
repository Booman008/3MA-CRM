import { S } from '../styles.js';

export function Field({ label, children }) {
  return <div style={S.formRow}><label style={S.label}>{label}</label>{children}</div>;
}
