import { NextResponse, type NextRequest } from 'next/server';

// GET /api/payments/success — Redirige al app después de un pago exitoso
export async function GET(request: NextRequest) {
  // La dirección tiene que ser completa: con una relativa ("/app?...")
  // Next.js tira error y la persona veía una pantalla de error al volver.
  return NextResponse.redirect(new URL('/app?payment=success', request.url));
}