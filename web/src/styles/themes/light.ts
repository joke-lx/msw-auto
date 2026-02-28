export const lightTheme = {
  colors: {
    primary: '#1677ff',
    primaryHover: '#4096ff',
    primaryActive: '#0958d9',
    background: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    surface: '#ffffff',
    surfaceHover: '#fafafa',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#e8e8e8',
    borderLight: '#f0f0f0',
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    info: '#1677ff',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
}

export type Theme = typeof lightTheme
