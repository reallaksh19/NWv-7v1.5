import React from 'react';

const ThemeToggle = ({
  theme = 'dark',
  onToggleTheme = null,
}) => {
  const isLight = theme === 'light';

  const toggleTheme = () => {
    if (typeof onToggleTheme !== 'function') return null;

    try {
      return onToggleTheme(isLight ? 'dark' : 'light');
    } catch (error) {
      console.warn('[ThemeToggle] onToggleTheme failed', {
        message: error?.message || String(error),
      });

      return null;
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="header__action-btn"
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0 8px',
        color: 'var(--text-primary)',
      }}
    >
      {isLight ? '🌙' : '☀️'}
    </button>
  );
};

export default ThemeToggle;
