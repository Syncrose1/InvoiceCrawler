import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the dev console; in production this would feed a telemetry hook.
    console.error('Renderer error boundary caught:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-full w-full flex items-center justify-center p-12">
        <div className="ice-card frost-overlay p-10 max-w-lg text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ice-danger/10 border border-ice-danger/30 flex items-center justify-center">
            <AlertOctagon className="w-6 h-6 text-ice-danger" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Well, that wasn't supposed to happen.</h2>
          <p className="text-sm text-ice-text-muted mb-2">
            Something went sideways inside the app. Have a quick reload — most things sort
            themselves out, and your profiles and settings are safe.
          </p>
          <pre className="mt-4 mb-5 text-[11px] text-ice-danger/80 bg-ice-bg/60 border border-ice-border rounded-lg p-3 text-left overflow-auto max-h-32">
            {this.state.error.message}
          </pre>
          <div className="flex items-center justify-center gap-2">
            <button onClick={this.reset} className="ice-button flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
            <button onClick={() => location.reload()} className="ice-button-primary">
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
