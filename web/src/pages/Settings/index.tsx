import { Card, Form, Select, Input, Button, message, Divider, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppStore, ThemeMode } from '@/stores/appStore'

const { Option } = Select

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { theme: themeMode, language, setTheme, setLanguage } = useAppStore()
  const { token } = theme.useToken()
  const [form] = Form.useForm()

  const handleThemeChange = (value: ThemeMode) => {
    setTheme(value)
  }

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  const handleSave = () => {
    message.success(t('settings.saved'))
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>

      <Card title={t('settings.general')} style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Form.Item label={t('settings.theme')}>
            <Select value={themeMode} onChange={handleThemeChange} style={{ width: 200 }}>
              <Option value="light">{t('settings.themeLight')}</Option>
              <Option value="dark">{t('settings.themeDark')}</Option>
              <Option value="system">{t('settings.themeSystem')}</Option>
            </Select>
          </Form.Item>
          <Form.Item label={t('settings.language')}>
            <Select value={language} onChange={handleLanguageChange} style={{ width: 200 }}>
              <Option value="en">English</Option>
              <Option value="zh">中文</Option>
            </Select>
          </Form.Item>
        </Form>
      </Card>

      <Card title={t('settings.apiConfig')}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('settings.apiUrl')}>
            <Input placeholder="https://api.example.com" style={{ maxWidth: 400 }} />
          </Form.Item>
          <Form.Item label={t('settings.apiKey')}>
            <Input.Password placeholder="Enter your API key" style={{ maxWidth: 400 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleSave}>
              {t('settings.save')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Settings
