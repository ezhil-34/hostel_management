import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiRequestError } from '../lib/api';

const FIELDS = [
  { name: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe', autoComplete: 'name' },
  { name: 'rollNumber', label: 'Roll Number', type: 'text', placeholder: '21CS104' },
  { name: 'roomNo', label: 'Room Number', type: 'text', placeholder: 'B-302', optional: true },
  {
    name: 'phone',
    label: 'Phone Number',
    type: 'tel',
    placeholder: '+91 98765 43210',
    autoComplete: 'tel',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'john@student.edu',
    autoComplete: 'email',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'At least 8 characters',
    autoComplete: 'new-password',
  },
];

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    roomNo: '',
    phone: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      // Signing up logs you straight in — no second trip through /signin.
      const created = await signup(formData);
      toast.success(
        `Welcome, ${created.name.split(' ')[0]}`,
        'Your account is ready. Room and roll number changes need warden approval.',
      );
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
        toast.error('Could not create account', err.message);
      } else {
        const message = 'Could not reach the server. Is the backend running?';
        setError(message);
        toast.error('Could not create account', message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
            <p className="text-xs text-slate-500">Register for SmartHostel</p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {FIELDS.map(({ name, label, type, placeholder, autoComplete, optional }) => (
            <div key={name}>
              <label htmlFor={name} className="block text-xs font-semibold text-slate-600 mb-1">
                {label}
                {optional && <span className="font-normal text-slate-400"> (optional)</span>}
              </label>
              <input
                id={name}
                name={name}
                type={type}
                required={!optional}
                autoComplete={autoComplete}
                placeholder={placeholder}
                value={formData[name]}
                onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
                className={`w-full border rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 ${
                  fieldErrors[name]
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {fieldErrors[name] && <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-sm inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/signin" className="text-blue-600 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
