import { NextResponse } from 'next/server';

// GET /api/payments/success — Redirige al app después de un pago exitoso
export async function GET() {
  return NextResponse.redirect('/app?payment=success');
}