import { NextResponse } from 'next/server';

// GET /api/payments/pending — Redirige al app cuando el pago está pendiente
export async function GET() {
  return NextResponse.redirect('/app?payment=pending');
}