'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches render errors and shows
 * a friendly recovery UI instead of a white screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render error caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#EF44441A] flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Algo salió mal
            </h2>
            <p className="text-sm text-muted-foreground">
              Se produjo un error inesperado. Intentá recargar la página.
              Si el problema persiste, contactá al soporte.
            </p>
            {this.state.error && (
              <details className="text-left bg-muted rounded-lg p-3 text-xs font-mono text-muted-foreground">
                <summary className="cursor-pointer font-medium mb-1">Detalles técnicos</summary>
                <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={this.handleReset} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
              <Button onClick={() => window.location.reload()} size="sm">
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to programmatically trigger the error boundary.
 * Usage: const throwError = useErrorHandler(); throwError(new Error('msg'));
 */
export function useErrorHandler() {
  const [, setState] = React.useState();
  return (error: Error) => {
    setState(() => { throw error; });
  };
}
