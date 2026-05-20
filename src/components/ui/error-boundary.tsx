'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Short label for the failed section (e.g. "Grocery list") */
  sectionLabel?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HealthHub ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const label = this.props.sectionLabel ?? 'This section';

      return (
        <div
          className="flex flex-col gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6"
          role="alert"
        >
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-destructive">
              {label} could not be displayed
            </p>
            <p className="text-sm text-gray-600">
              Something unexpected happened in the browser. Your data is usually
              safe — try again, or refresh the page if the problem continues.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="min-h-[44px] rounded-md bg-primary-600 px-4 text-sm font-medium text-white"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
