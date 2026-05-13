import { useState } from 'react';
import { TOKEN_KEY } from '../api.js';
import { S } from '../styles.js';
import { Field } from '../components/Field.jsx';

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Login failed');
      localStorage.setItem(TOKEN_KEY, payload.token);
      onLogin(payload);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-hover) 100%)',
      padding: 32,
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    }}>
      {/* Soft gold glow accents */}
      <div style={{
        position: 'absolute', top: -120, right: -120,
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(235,171,34,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -160, left: -160,
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(235,171,34,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 440,
        background: '#fff',
        borderRadius: 10,
        boxShadow: 'var(--shadow-lg)',
        padding: '36px 36px 28px',
        borderTop: '4px solid var(--color-gold)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <img src="assets/logo-mark.png" alt="3MA"
               style={{ width: 52, height: 'auto' }}
               onError={(e) => { e.target.style.display = 'none'; }} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1rem',
              color: 'var(--color-navy)', letterSpacing: '0.04em',
            }}>3MA CRM</div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.6rem',
              color: 'var(--color-gold)', letterSpacing: '0.2em', marginTop: 4,
            }}>VOICE OF MS CANNABIS</div>
          </div>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.7rem',
          color: 'var(--color-navy)', margin: '0 0 8px',
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>Sign In</h1>
        <p style={{
          color: 'var(--color-muted)', margin: '0 0 22px',
          fontSize: '0.9rem', lineHeight: 1.55,
        }}>Access the protected membership, lead, and policy data system for 3MA staff and board members.</p>

        <form onSubmit={submit}>
          <Field label="Email Address">
            <input style={S.input} type="email" value={email}
                   onChange={e => setEmail(e.target.value)}
                   autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input style={S.input} type="password" value={password}
                   onChange={e => setPassword(e.target.value)}
                   autoComplete="current-password" required />
          </Field>
          {error && (
            <div style={{
              color: 'var(--color-red)', fontSize: '0.82rem', marginBottom: 14,
              padding: '8px 12px', background: 'var(--color-callout-red-bg)',
              borderLeft: '3px solid var(--color-red)', borderRadius: 4,
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading}
                  style={{
                    ...S.btn('primary'),
                    width: '100%',
                    justifyContent: 'center',
                    padding: '13px 18px',
                    fontSize: '0.78rem',
                  }}>
            {loading ? 'Signing In…' : 'Sign In to CRM'}
          </button>
        </form>

        <div style={{
          marginTop: 24, paddingTop: 18,
          borderTop: '1px solid var(--color-divider)',
          fontFamily: 'var(--font-heading)',
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em',
          color: 'var(--color-muted)', textAlign: 'center', textTransform: 'uppercase',
        }}>
          Mississippi Medical Marijuana Association · 501(c)(6)
        </div>
      </div>
    </div>
  );
}
