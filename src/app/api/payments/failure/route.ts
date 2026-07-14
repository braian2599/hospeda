import { NextResponse } from 'next/server';

// GET /api/payments/failure — Redirige al app después de un pago fallido
export async function GET() {
  return NextResponse.redirect('/app?payment=failure');
}