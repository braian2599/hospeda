'use client';

import { Suspense } from 'react';
import AuthCard from '../login/AuthCard';

function RegisterContent() {
  return <AuthCard defaultMode="signup" />;
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
