import { Button, theme } from 'antd'
import { SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'

const ThemeToggle: React.FC = () => {
  const { theme: themeMode, setTheme } = useAppStore()
  const { token } = theme.useToken()

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    if (themeMode === 'light') {
      setTheme('dark')
    } else if (themeMode === 'dark') {
      setTheme('light')
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(isSystemDark ? 'light' : 'dark')
    }
  }

  return (
    <Button
      type="text"
      icon={isDark ? <SunOutlined /> : <MoonOutlined />}
      onClick={toggleTheme}
      style={{ fontSize: 18 }}
    />
  )
}

export default ThemeToggle
