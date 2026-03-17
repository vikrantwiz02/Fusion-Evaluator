import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { loginWithGoogle } from '../LabManager/api';
import { Chrome } from 'lucide-react';
import Insti_logo from '../../public/Insti_logo.svg';

export default function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Google sign-in did not return a credential.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const user = await loginWithGoogle(credentialResponse.credential);
      onLogin(user);
    } catch (err) {
      let errorMessage = 'Unable to sign in with Google.';
      if (err.response?.data?.error) {
        errorMessage = typeof err.response.data.error === 'string' ? err.response.data.error : 'Backend error occurred.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-[#d9e1ec] bg-white p-6 shadow-[0_18px_45px_-30px_rgba(15,33,56,0.35)] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <img src={Insti_logo} alt="Fusion Logo" className="h-10 w-10 rounded-lg border border-[#e3e8f0] p-1.5" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#59708a]">Fusion Evaluator</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#12253d]">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#51657d]">
            Sign in with your institute Google account to continue.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-[#d9e1ec] bg-[#f9fbfe] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2c435e]">
              <Chrome className="h-4 w-4" />
              Google OAuth
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in was cancelled or failed.')}
                theme="outline"
                shape="pill"
                text="signin_with"
                width="320"
              />
            </div>

            {loading && <p className="mt-3 text-center text-sm text-[#5a7088]">Verifying your Google account...</p>}
          </div>

          <div className="mt-5 border-t border-[#e5ebf3] pt-4 text-xs leading-relaxed text-[#647a92]">
            Access is granted only to approved admin emails or assigned lead emails.
          </div>
        </section>
      </div>
    </div>
  );
}
