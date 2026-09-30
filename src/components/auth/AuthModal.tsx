import React, { useState } from 'react';
import { 
  LogIn, 
  UserPlus, 
  X, 
  AlertCircle, 
  KeyRound, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ShieldCheck, 
  Sparkles,
  Delete,
  Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'PIN_LOGIN' | 'PIN_REGISTER' | 'EMAIL_LOGIN' | 'EMAIL_REGISTER';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    loginWithUsernameAndPin, 
    registerWithUsernameAndPin, 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle 
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('PIN_LOGIN');
  
  // PIN Form State
  const [username, setUsername] = useState('cashier');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('waiter');

  // Email Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickStaffPresets = [
    { label: '👑 Owner', user: 'owner', defaultPin: '1234', role: 'Owner' },
    { label: '💼 Manager', user: 'manager', defaultPin: '5678', role: 'Manager' },
    { label: '💰 Cashier', user: 'cashier', defaultPin: '1111', role: 'Billing' },
    { label: '🍽️ Waiter', user: 'waiter', defaultPin: '0000', role: 'Orders' },
  ];

  const handleNumPadPress = (digit: string) => {
    if (mode === 'PIN_LOGIN') {
      if (pin.length < 6) {
        setPin((prev) => prev + digit);
      }
    } else if (mode === 'PIN_REGISTER') {
      if (pin.length < 4) {
        setPin((prev) => prev + digit);
      } else if (confirmPin.length < 4) {
        setConfirmPin((prev) => prev + digit);
      }
    }
  };

  const handleNumPadBackspace = () => {
    if (mode === 'PIN_LOGIN') {
      setPin((prev) => prev.slice(0, -1));
    } else if (mode === 'PIN_REGISTER') {
      if (confirmPin.length > 0) {
        setConfirmPin((prev) => prev.slice(0, -1));
      } else {
        setPin((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleNumPadClear = () => {
    setPin('');
    setConfirmPin('');
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'PIN_LOGIN') {
        if (!username.trim()) {
          setError('Please enter your staff username.');
          setLoading(false);
          return;
        }
        if (!pin.trim()) {
          setError('Please enter your PIN.');
          setLoading(false);
          return;
        }
        await loginWithUsernameAndPin(username, pin);
        onClose();
      } else if (mode === 'PIN_REGISTER') {
        if (!fullName.trim()) {
          setError('Please provide staff full name.');
          setLoading(false);
          return;
        }
        if (!username.trim()) {
          setError('Please enter an alphanumeric username.');
          setLoading(false);
          return;
        }
        if (pin.length < 4) {
          setError('PIN must be at least 4 digits.');
          setLoading(false);
          return;
        }
        if (pin !== confirmPin) {
          setError('PINs do not match. Please re-enter.');
          setLoading(false);
          return;
        }
        await registerWithUsernameAndPin(username, pin, fullName, selectedRole);
        setSuccessMsg(`Staff account "${username}" registered and logged in!`);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'EMAIL_REGISTER') {
        if (!fullName.trim()) {
          setError('Please provide a full name.');
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password, fullName, selectedRole);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check email/password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-auto text-slate-100">
        
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700/80 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white leading-tight">
                {mode === 'PIN_LOGIN' && 'Staff PIN Login'}
                {mode === 'PIN_REGISTER' && 'Register Staff & PIN'}
                {mode === 'EMAIL_LOGIN' && 'Admin Email Sign In'}
                {mode === 'EMAIL_REGISTER' && 'Create Admin Account'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Sri Saravana Bhavan • POS Access Control
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: PIN Mode vs Email Mode */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('PIN_LOGIN');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'PIN_LOGIN' || mode === 'PIN_REGISTER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Username & PIN</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('EMAIL_LOGIN');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'EMAIL_LOGIN' || mode === 'EMAIL_REGISTER'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email / Google</span>
          </button>
        </div>

        {/* Error or Success Alert */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE: USERNAME & PIN (LOGIN OR REGISTER) */}
        {(mode === 'PIN_LOGIN' || mode === 'PIN_REGISTER') && (
          <div className="p-4 sm:p-5 space-y-3.5">
            
            {/* Quick Staff Fast-Select (for PIN Login) */}
            {mode === 'PIN_LOGIN' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Quick Staff Terminal Select
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {quickStaffPresets.map((st) => (
                    <button
                      key={st.user}
                      type="button"
                      onClick={() => {
                        setUsername(st.user);
                        setPin(st.defaultPin);
                        setError(null);
                      }}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                        username.toLowerCase() === st.user.toLowerCase()
                          ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-[11px] truncate">{st.label}</div>
                      <div className="text-[9px] text-slate-400 font-mono">PIN: {st.defaultPin}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Registration specific fields */}
            {mode === 'PIN_REGISTER' && (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Staff Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Staff Role *
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                    >
                      <option value="waiter">🍽️ Waiter (Orders/KOT)</option>
                      <option value="manager">💼 Manager (Billing/Reports)</option>
                      <option value="owner">👑 Owner (Full Access)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ramesh"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Username field for Login */}
            {mode === 'PIN_LOGIN' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Username or Staff Code *
                </label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. cashier, manager, waiter"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* PIN Input Display */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {mode === 'PIN_REGISTER' ? 'Enter 4-Digit PIN *' : 'Secret Staff PIN *'}
                </label>
                <span className="text-[10px] text-amber-400 font-mono">
                  {pin.length} / {mode === 'PIN_REGISTER' ? '4' : '4-6'} digits
                </span>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-center font-mono tracking-widest text-base focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Confirm PIN (Register Mode) */}
            {mode === 'PIN_REGISTER' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Confirm 4-Digit PIN *
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">{confirmPin.length} / 4</span>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-center font-mono tracking-widest text-base focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Touch NumPad for Rapid POS Terminals */}
            <div className="pt-1">
              <div className="grid grid-cols-3 gap-1.5 max-w-[280px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumPadPress(num)}
                    className="h-10 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 rounded-lg font-mono text-sm font-bold text-white transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleNumPadClear}
                  className="h-10 bg-slate-800/60 hover:bg-red-900/60 text-slate-400 hover:text-red-200 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center justify-center"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleNumPadPress('0')}
                  className="h-10 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 rounded-lg font-mono text-sm font-bold text-white transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleNumPadBackspace}
                  className="h-10 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center"
                  title="Backspace"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="button"
              onClick={() => handlePinSubmit()}
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {loading 
                  ? 'Verifying...' 
                  : mode === 'PIN_REGISTER' 
                    ? 'Register & Activate PIN' 
                    : 'Sign In with Username & PIN'}
              </span>
            </button>

            {/* Switch between PIN Login and PIN Register */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'PIN_LOGIN' ? 'PIN_REGISTER' : 'PIN_LOGIN');
                  setError(null);
                  setSuccessMsg(null);
                  setPin('');
                  setConfirmPin('');
                }}
                className="text-slate-400 hover:text-amber-300 text-[11px] underline cursor-pointer"
              >
                {mode === 'PIN_LOGIN' 
                  ? 'New staff member? Register Username & PIN' 
                  : 'Already registered? Return to PIN Login'}
              </button>
            </div>
          </div>
        )}

        {/* MODE: EMAIL & GOOGLE AUTH */}
        {(mode === 'EMAIL_LOGIN' || mode === 'EMAIL_REGISTER') && (
          <form onSubmit={handleEmailSubmit} className="p-4 sm:p-5 space-y-3 text-xs">
            {mode === 'EMAIL_REGISTER' && (
              <div>
                <label className="block font-bold text-slate-400 mb-1">STAFF FULL NAME *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anandha Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-400 mb-1">EMAIL ADDRESS *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@hotelpos.internal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1">PASSWORD *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-colors"
            >
              {loading ? 'Processing...' : mode === 'EMAIL_REGISTER' ? 'Register Admin Account' : 'Sign In with Email'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'EMAIL_LOGIN' ? 'EMAIL_REGISTER' : 'EMAIL_LOGIN');
                  setError(null);
                }}
                className="text-slate-400 hover:text-amber-300 text-xs underline cursor-pointer"
              >
                {mode === 'EMAIL_LOGIN' ? 'Need an email account? Register here' : 'Already have an email account? Sign in'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
