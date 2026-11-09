import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise;
function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => { gsiPromise = undefined; reject(new Error('Could not load Google sign-in.')); };
      document.head.appendChild(script);
    });
  }
  return gsiPromise;
}

export const googleSignInEnabled = Boolean(CLIENT_ID);

/**
 * Google's own "Continue with Google" button (Google Identity Services).
 * Google hands us a signed ID token; `onCredential(token)` sends it to the
 * backend, which verifies it. The frontend never trusts the token itself.
 */
export default function GoogleSignInButton({ onCredential, onError, text = 'continue_with' }) {
  const ref = useRef(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [failed, setFailed] = useState(false);
  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
        });
        const theme = document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline';
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme, size: 'large', text, shape: 'pill',
          width: Math.min(ref.current.offsetWidth || 360, 400),
        });
      })
      .catch((err) => { setFailed(true); errorRef.current?.(err); });
    return () => { cancelled = true; };
  }, [text]);

  if (!CLIENT_ID) return null;
  if (failed) return <p className="auth-foot">Google sign-in is unavailable right now.</p>;
  return <div ref={ref} className="google-btn" />;
}
