import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth/utils';

/**
 * Helper centralizado para manejar errores en API routes.
 *
 * Comportamiento:
 * - Si `error` es una instancia de `AuthError`, devuelve su `message`
 *   y `statusCode` (son mensajes pensados para el usuario: "No autenticado",
 *   "Acceso denegado", etc.).
 * - Para cualquier otro error, devuelve un mensaje genérico al cliente:
 *   "Error interno del servidor" con status 500. NUNCA expone `error.message`
 *   ni stack traces al cliente.
 *
 * Logging:
 * - En desarrollo (NODE_ENV !== 'production'): loguea el error completo
 *   (incluye stack) para facilitar el debugging.
 * - En producción: loguea solo `error.message` (sin stack, sin propiedades
 *   internas que puedan filtrar datos sensibles).
 *
 * @param error El error capturado (unknown — usar unknown en catch blocks)
 * @param operation Etiqueta corta para el log, ej: "POST /api/reservas"
 * @returns NextResponse lista para retornar al cliente
 */
export function handleApiError(error: unknown, operation: string): NextResponse {
  // AuthError: los mensajes son user-facing (401, 403, etc.)
  if (error instanceof AuthError) {
    if (process.env.NODE_ENV === 'production') {
      // En prod: solo el mensaje, sin stack ni props internas
      console.error(`[${operation}] AuthError:`, error.message);
    } else {
      // En dev: el error completo con stack
      console.error(`[${operation}] AuthError:`, error);
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  // Error genérico: nunca exponer detalles al cliente
  if (process.env.NODE_ENV === 'production') {
    // En prod: solo el mensaje de error (sin stack, sin props internas)
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${operation}]`, message);
  } else {
    // En dev: el error completo para debugging
    console.error(`[${operation}]`, error);
  }

  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}
