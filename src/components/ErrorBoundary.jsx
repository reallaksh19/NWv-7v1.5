import React from 'react';

function areArraysDifferent(a = [], b = []) {
  if (a.length !== b.length) return true;
  return a.some((value, index) => !Object.is(value, b[index]));
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    const label = this.props.label || 'unknown';

    this.setState({ errorInfo });

    console.error('[ErrorBoundary]', {
      label,
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  componentDidUpdate(prevProps) {
    if (
      this.state.hasError &&
      areArraysDifferent(prevProps.resetKeys || [], this.props.resetKeys || [])
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.label || 'Page';
    const errorMessage = this.state.error?.message || 'Unknown error';

    return (
      <div
        className="error-boundary"
        role="alert"
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: '#9CA5B0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>

        <strong style={{ color: '#D0D7DE' }}>
          {label} encountered an error
        </strong>

        <p style={{ fontSize: '0.82rem', marginTop: '8px' }}>
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: '12px',
            padding: '6px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(48,54,61,0.65)',
            background: 'rgba(18,23,30,0.6)',
            color: '#D0D7DE',
            cursor: 'pointer',
            fontSize: '0.82rem',
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
