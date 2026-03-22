'use client';

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Focus timer error boundary caught an error:', error, errorInfo);
  }

  handleFactoryReset = () => {
    if (confirm("This will wipe the timer data and reset the experience. Are you sure?")) {
      try {
        const keysToRemove = [
          'pomo-settings-storage',
          'pomo-time-storage',
          'pomo-tasks-storage',
        ];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        return;
      }
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-900 text-white p-6 text-center font-sans">
          <h1 className="text-3xl font-bold mb-4">Something went wrong.</h1>
          <p className="mb-8 opacity-80 max-w-md">
            The focus timer encountered a critical error. This is often due to corrupted local data.
          </p>
          <button
            onClick={this.handleFactoryReset}
            className="bg-white text-red-900 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Factory Reset Timer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
