import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  Phone,
  MapPin,
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle2,
  LogIn,
  UserPlus,
} from 'lucide-react';
import './AuthPage.css';

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['', 'active-weak', 'active-fair', 'active-good', 'active-strong'];
  return { level: score, label: labels[score], cls: classes[score] };
}

// ─── Friendly Firebase error messages ─────────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/invalid-credential':    'Incorrect email or password.',
    'auth/email-already-in-use':  'This email is already registered. Try logging in.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/too-many-requests':     'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed':'Network error. Please check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PasswordInput({ id, value, onChange, placeholder, label, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="auth-input-wrap">
        <Lock className="input-icon" size={16} />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="auth-input"
          placeholder={placeholder || 'Password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete || 'current-password'}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label="Toggle password visibility"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function StrengthMeter({ password }) {
  const { level, label, cls } = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: '-0.5rem' }}>
      <div className="pw-strength">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`pw-strength-bar ${i <= level ? cls : ''}`} />
        ))}
      </div>
      <div className="pw-strength-label">{label}</div>
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className="auth-error" role="alert">
      <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
      {msg}
    </div>
  );
}

// ─── VIEW 1: Login ────────────────────────────────────────────────────────────

function LoginView({ onForgotPassword, onRegister }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthContext listener detects the user and App.jsx redirects to /tables
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-view">
      <p className="auth-title">Welcome back</p>
      <p className="auth-subtitle">Sign in to manage your venue</p>

      <form className="auth-form" onSubmit={handleLogin} noValidate>
        <ErrorMsg msg={error} />

        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <div className="auth-input-wrap">
            <Mail className="input-icon" size={16} />
            <input
              id="login-email"
              type="email"
              className="auth-input"
              placeholder="owner@yourclub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <PasswordInput
          id="login-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        <div className="auth-forgot">
          <button type="button" onClick={onForgotPassword}>Forgot password?</button>
        </div>

        <button id="login-submit-btn" type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : <LogIn size={16} />}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="auth-divider">or</div>

      <div className="auth-switch">
        New here?
        <button type="button" onClick={onRegister}>Create your club →</button>
      </div>
    </div>
  );
}

// ─── VIEW 2: Forgot Password ──────────────────────────────────────────────────

function ForgotPasswordView({ onBack }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-view auth-email-sent">
        <div className="auth-email-icon"><Mail size={32} /></div>
        <h2>Reset link sent!</h2>
        <p>
          We've sent a <strong>password reset link</strong> to<br />
          <strong>{email}</strong>.<br /><br />
          Open that email and click the link inside to set a new password.
          <br /><br />
          {/* <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>
            ⚠ Not seeing it? Check your <strong>Spam / Junk</strong> folder.
            The email comes from <em>noreply@…firebaseapp.com</em>.
          </span> */}
        </p>
        <button className="auth-btn-primary" onClick={onBack} style={{ maxWidth: 260, margin: '0 auto' }}>
          <ArrowLeft size={15} /> Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <button className="auth-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <p className="auth-title">Reset your password</p>
      <p className="auth-subtitle">
        Enter the email linked to your account and we'll send you a reset link.
      </p>

      <form className="auth-form" onSubmit={handleReset} noValidate>
        <ErrorMsg msg={error} />

        <div className="auth-field">
          <label htmlFor="reset-email">Email address</label>
          <div className="auth-input-wrap">
            <Mail className="input-icon" size={16} />
            <input
              id="reset-email"
              type="email"
              className="auth-input"
              placeholder="owner@yourclub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <button id="reset-submit-btn" type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? <span className="auth-spinner" /> : <Send size={15} />}
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}

// ─── VIEW 3: Create Club (Register) ──────────────────────────────────────────

function RegisterView({ onBack }) {
  const [form, setForm] = useState({
    ownerName:       '',
    clubName:        '',
    phone:           '',
    city:            '',
    email:           '',
    password:        '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    const { ownerName, clubName, phone, city, email, password, confirmPassword } = form;

    if (!ownerName || !clubName || !phone || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid  = cred.user.uid;

      // 2. Save club profile. clubId === uid for data isolation.
      await setDoc(doc(db, 'clubs', uid), {
        clubId:    uid,
        ownerId:   uid,
        clubName,
        ownerName,
        email,
        phone,
        city,
        createdAt: serverTimestamp(),
      });

      // 3. Auth state listener in AuthContext fires automatically,
      //    sets currentUser, and App.jsx's PublicRoute redirects to /tables.
      //    No extra navigation needed here.
    } catch (err) {
      setError(friendlyError(err.code));
      setLoading(false);
    }
  }

  const strength = getPasswordStrength(form.password);

  return (
    <div className="auth-view">
      <button className="auth-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <p className="auth-title">Create your club</p>
      <p className="auth-subtitle">Set up your venue on Pocket 6 in seconds</p>

      <form className="auth-form" onSubmit={handleRegister} noValidate>
        <ErrorMsg msg={error} />

        {/* Row 1: Owner Name + Club Name */}
        <div className="auth-grid-2">
          <div className="auth-field">
            <label htmlFor="reg-owner">Owner Name *</label>
            <div className="auth-input-wrap">
              <User className="input-icon" size={16} />
              <input
                id="reg-owner"
                type="text"
                className="auth-input"
                placeholder="Your name"
                value={form.ownerName}
                onChange={update('ownerName')}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-club">Club / Venue Name *</label>
            <div className="auth-input-wrap">
              <Building2 className="input-icon" size={16} />
              <input
                id="reg-club"
                type="text"
                className="auth-input"
                placeholder="Venue name"
                value={form.clubName}
                onChange={update('clubName')}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Phone + City */}
        <div className="auth-grid-2">
          <div className="auth-field">
            <label htmlFor="reg-phone">Phone Number *</label>
            <div className="auth-input-wrap">
              <Phone className="input-icon" size={16} />
              <input
                id="reg-phone"
                type="tel"
                className="auth-input"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={update('phone')}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-city">City</label>
            <div className="auth-input-wrap">
              <MapPin className="input-icon" size={16} />
              <input
                id="reg-city"
                type="text"
                className="auth-input"
                placeholder="Mumbai, Delhi…"
                value={form.city}
                onChange={update('city')}
              />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="auth-field">
          <label htmlFor="reg-email">Email Address *</label>
          <div className="auth-input-wrap">
            <Mail className="input-icon" size={16} />
            <input
              id="reg-email"
              type="email"
              className="auth-input"
              placeholder="owner@yourclub.com"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div className="auth-field">
          <label htmlFor="reg-password">Password *</label>
          <div className="auth-input-wrap">
            <Lock className="input-icon" size={16} />
            <input
              id="reg-password"
              type="password"
              className="auth-input"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
            />
          </div>
        </div>
        {form.password && <StrengthMeter password={form.password} />}

        {/* Confirm Password */}
        <div className="auth-field">
          <label htmlFor="reg-confirm">Confirm Password *</label>
          <div className="auth-input-wrap">
            <Lock className="input-icon" size={16} />
            <input
              id="reg-confirm"
              type="password"
              className="auth-input"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          id="register-submit-btn"
          type="submit"
          className="auth-btn-primary"
          disabled={loading || strength.level < 1}
        >
          {loading ? <span className="auth-spinner" /> : <UserPlus size={16} />}
          {loading ? 'Creating club…' : 'Create Club & Sign In'}
        </button>
      </form>
    </div>
  );
}

// ─── Main Auth Page ───────────────────────────────────────────────────────────

export default function AuthPage() {
  const [view, setView] = useState('login');

  return (
    <div className="auth-root">
      {/* Animated background */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-grid" />

      {/* Card */}
      <div className={`auth-card ${view === 'register' ? 'scrollable' : ''}`}>
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="8" />
              <line x1="12" y1="16" x2="12" y2="22" />
            </svg>
          </div>
          <h1>Pocket 6</h1>
          {/* <p>Venue Management System</p> */}
        </div>

        {view === 'login'    && <LoginView    onForgotPassword={() => setView('forgot')} onRegister={() => setView('register')} />}
        {view === 'forgot'   && <ForgotPasswordView onBack={() => setView('login')} />}
        {view === 'register' && <RegisterView onBack={() => setView('login')} />}
      </div>
    </div>
  );
}
