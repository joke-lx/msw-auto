import { Button } from 'antd'
import { BulbOutlined } from '@ant-design/icons'
import { useAppStore } from '@/stores/appStore'

const ThemeToggle = () => {
  const { theme, setTheme } = useAppStore()

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <Button
      type="text"
      icon={<BulbOutlined />}
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    />
  )
}

export default ThemeToggle
