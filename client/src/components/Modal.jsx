import { S } from '../styles.js';

export function Modal({ title, onClose, children }) {
  return (
    <div className="crm-modal-overlay" style={S.overlay} onClick={onClose}>
      <div className="crm-modal" style={S.modal} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={S.modalTitle}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
