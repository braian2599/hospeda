'use client';

import { Suspense } from 'react';
import AuthCard from './AuthCard';

export default function LoginContent() {
  return <AuthCard defaultMode="login" />;
}
