'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useHotelStore } from '@/lib/store';
import { useContactEmail } from '@/hooks/useContactEmail';

interface Props {
  moduleName: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

// Componente función chico solo para poder usar el hook useContactEmail()
// dentro de un class component (ModuleErrorBoundary necesita ser clase por
// componentDidCatch). Si no hay email de contacto configurado, no se
// muestra el botón — antes tenía "soporte@hospeda.com" hardcodeado.
function ReportarErrorLink({ subject, body }: { subject: string; body: string }) {
  const contactEmail = useContactEmail();
  if (!contactEmail) return null;
  const href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <a href={href} className="inline-flex">
      <Button variant="ghost" size="sm">
        Reportar error
      </Button>
    </a>
  );
}

/**
 * Specialized error boundary that isolates crashes to a single module.
 * If a module throws during render, the rest of the app keeps working
 * and the user gets compact recovery actions inside the module area.
 */
export class ModuleErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  handleGoDashboard = () => {
    useHotelStore.getState().setModulo('dashboard');
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      const reportBody = `Error ID: ${this.state.errorId}\n\nMensaje: ${this.state.error?.message ?? 'Sin mensaje'}\n\nMódulo: ${this.props.moduleName}`;
      const reportSubject = `Error en ${this.props.moduleName}`;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#EF44441A] flex items-center justify-center animate-in fade-in zoom-in-50 duration-300">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Error en {this.props.moduleName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Se produjo un error al cargar este módulo. Podés reintentar o volver al dashboard.
              </p>
            </div>
            {this.state.error && (
              <details className="text-left bg-[#F1F5F980] rounded-lg p-3 text-xs font-mono text-muted-foreground border border-border">
                <summary className="cursor-pointer font-medium mb-1 hover:text-foreground transition-colors">
                  Detalles técnicos ({this.state.errorId})
                </summary>
                <pre className="whitespace-pre-wrap break-all mt-2 max-h-32 overflow-y-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
              <Button
                onClick={this.handleGoDashboard}
                size="sm"
                className="bg-primary hover:bg-[#0F766EE6]"
              >
                <LayoutDashboard className="w-4 h-4 mr-1" />
                Ir al Dashboard
              </Button>
              <ReportarErrorLink subject={reportSubject} body={reportBody} />
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
