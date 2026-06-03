import React, { StrictMode } from 'react'

// Polyfill for process.env that some libraries like recharts might need in Vite
if (typeof process === 'undefined') {
  window.process = { env: { NODE_ENV: 'development' } };
}

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: 'red', fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}>
          <h2>Algo se rompió en React:</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>{this.state.error && this.state.error.toString()}</summary>
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
