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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #f4f7f2 0%, #e8efe5 100%)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, boxShadow: '0 20px 50px rgba(13,59,13,.12)', padding: 32, border: '1px solid rgba(13,59,13,.08)' }}>
        <div style={{ fontSize: '.8rem', fontWeight: 700, letterSpacing: 1.2, color: 'var(--green-600)', textTransform: 'uppercase', marginBottom: 10 }}>3MA CRM</div>
        <h1 style={{ fontSize: '2rem', color: 'var(--green-900)', marginBottom: 10 }}>Sign in</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: 24, lineHeight: 1.5 }}>Use your account to access the hosted CRM and protected membership data.</p>

        <form onSubmit={submit}>
          <Field label="Email">
            <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password">
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <div style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: 14 }}>{error}</div>}
          <button type="submit" style={{ ...S.btn(), width: '100%', justifyContent: 'center', padding: '11px 18px' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
