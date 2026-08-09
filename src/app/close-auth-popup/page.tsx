'use client';

import { useEffect } from 'react';

export default function CloseAuthPopup() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'auth-success' }, window.location.origin);
    }
    window.close();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
      <p className="text-white/60 text-sm">Autenticación exitosa. Cerrando...</p>
    </div>
  );
}
