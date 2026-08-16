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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Autenticación exitosa. Cerrando...</p>
    </div>
  );
}
