import { Card, Form, Select, Input, Button, message, Divider, theme, Space, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppStore, ThemeMode } from '@/stores/appStore'
import { useState, useEffect } from 'react'
import { CheckCircleOutlined, DisconnectOutlined } from '@ant-design/icons'

const { Option } = Select
const { TextArea } = Input

interface LLMConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  hasApiKey: boolean
  enabled: boolean
}

const PROVIDER_OPTIONS = {
  anthropic: {
    key: 'anthropic',
    label: 'Anthropic',
    labelEn: 'Anthropic (Claude)',
    labelZh: 'Anthropic (Claude)',
    tag: 'Claude',
    defaultUrl: 'https://api.anthropic.com',
    models: [
      { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet-20241022', labelZh: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'claude-3-5-haiku-20241022', labelZh: 'Claude 3.5 Haiku' },
      { value: 'claude-3-opus-20240229', label: 'claude-3-opus-20240229', labelZh: 'Claude 3 Opus' },
    ],
  },
  openai: {
    key: 'openai',
    label: 'OpenAI',
    labelEn: 'OpenAI (GPT)',
    labelZh: 'OpenAI (GPT)',
    tag: 'GPT',
    defaultUrl: 'https://api.openai.com/v1',
    models: [
      { value: 'gpt-4o', label: 'gpt-4o', labelZh: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini', labelZh: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'gpt-4-turbo', labelZh: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', labelZh: 'GPT-3.5 Turbo' },
    ],
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    labelEn: 'Custom',
    labelZh: '自定义',
    tag: 'API',
    defaultUrl: '',
    models: [],
  },
}

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { theme: themeMode, language, setTheme, setLanguage } = useAppStore()
  const { token } = theme.useToken()
  const [form] = Form.useForm()
  const [llmForm] = Form.useForm()

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'anthropic',
    apiKey: '',
    baseUrl: '',
    model: '',
    hasApiKey: false,
    enabled: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('') // Track actual API key input
  const [showApiKey, setShowApiKey] = useState(false) // Control visibility

  const isZh = language === 'zh'

  // Load LLM config on mount and when language changes
  useEffect(() => {
    fetchLLMConfig()
  }, [language])

  const fetchLLMConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/llm/config')
      if (res.ok) {
        const data = await res.json()
        setLlmConfig(data)
        const providerModels = PROVIDER_OPTIONS[data.provider as keyof typeof PROVIDER_OPTIONS]?.models || []
        const defaultModel = providerModels[0]?.value || ''

        llmForm.setFieldsValue({
          provider: data.provider || 'anthropic',
          baseUrl: data.baseUrl || PROVIDER_OPTIONS[data.provider as keyof typeof PROVIDER_OPTIONS]?.defaultUrl || '',
          model: data.model || defaultModel,
        })

        // Don't reset API key input if user is typing
        if (!apiKeyInput) {
          setApiKeyInput(data.hasApiKey ? '***' : '')
          llmForm.setFieldValue('apiKey', data.hasApiKey ? '***' : '')
        }
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleThemeChange = (value: ThemeMode) => {
    setTheme(value)
  }

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value)
    setLanguage(value)
  }

  const handleGeneralSave = () => {
    message.success(t('settings.saved'))
  }

  const handleProviderChange = (value: string) => {
    const providerConfig = PROVIDER_OPTIONS[value as keyof typeof PROVIDER_OPTIONS]
    const firstModel = providerConfig?.models[0]?.value || ''

    llmForm.setFieldValue('model', firstModel)
    llmForm.setFieldValue('baseUrl', providerConfig?.defaultUrl || '')
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setApiKeyInput(value)
    // Also update form value for validation
    llmForm.setFieldValue('apiKey', value)
  }

  const handleLLMSave = async () => {
    try {
      const values = await llmForm.validateFields()
      setSaving(true)

      // Store current API key input before save
      const currentApiKeyInput = apiKeyInput

      // Don't send masked API key
      const payload = { ...values }
      if (apiKeyInput === '***') {
        delete payload.apiKey
      } else {
        payload.apiKey = apiKeyInput
      }

      const res = await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        message.success(data.message || (isZh ? '配置已保存' : 'Configuration saved'))

        // If user entered a new API key, show it briefly then mask it
        if (currentApiKeyInput && currentApiKeyInput !== '***') {
          // Keep the input visible for a moment to confirm
          setTimeout(() => {
            setApiKeyInput('***')
            llmForm.setFieldValue('apiKey', '***')
          }, 1500)
        } else {
          // Just reload the config
          await fetchLLMConfig()
        }
      } else {
        const error = await res.json()
        message.error(error.error || (isZh ? '保存失败' : 'Failed to save'))
      }
    } catch (error) {
      console.error('Failed to save LLM config:', error)
      message.error(isZh ? '保存失败' : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getProviderLabel = (key: string) => {
    const provider = PROVIDER_OPTIONS[key as keyof typeof PROVIDER_OPTIONS]
    if (!provider) return key
    return isZh ? provider.labelZh : provider.labelEn
  }

  const getModelLabel = (model: any) => {
    return isZh ? (model.labelZh || model.label) : model.label
  }

  const currentProvider = PROVIDER_OPTIONS[llmForm.getFieldValue('provider') as keyof typeof PROVIDER_OPTIONS]
  const currentModels = currentProvider?.models || []

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('settings.title')}</h1>

      {/* General Settings */}
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

      {/* LLM Configuration */}
      <Card
        title={
          <Space>
            <span>{isZh ? 'LLM 配置' : 'LLM Configuration'}</span>
            {llmConfig.enabled ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                {isZh ? '已连接' : 'Connected'}
              </Tag>
            ) : llmConfig.hasApiKey ? (
              <Tag color="warning">{isZh ? '需要重连' : 'Reconnect'}</Tag>
            ) : (
              <Tag icon={<DisconnectOutlined />} color="default">
                {isZh ? '未配置' : 'Not Configured'}
              </Tag>
            )}
          </Space>
        }
        loading={loading}
      >
        <Form form={llmForm} layout="vertical">
          <Form.Item
            label={isZh ? '提供商' : 'Provider'}
            name="provider"
            rules={[{ required: true, message: isZh ? '请选择提供商' : 'Please select a provider' }]}
          >
            <Select onChange={handleProviderChange} style={{ maxWidth: 400 }}>
              {Object.values(PROVIDER_OPTIONS).map((p) => (
                <Option key={p.key} value={p.key}>
                  <Space>
                    <span>{isZh ? p.labelZh : p.labelEn}</span>
                    <Tag>{p.tag}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={isZh ? 'API 密钥' : 'API Key'}
            name="apiKey"
            rules={[{ required: !llmConfig.hasApiKey, message: isZh ? '请输入 API 密钥' : 'Please enter your API key' }]}
            tooltip={llmConfig.hasApiKey ? (isZh ? '已配置 API 密钥，输入新密钥可更新' : 'API key is configured. Enter a new key to update.') : ''}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Input.Password
                value={apiKeyInput}
                onChange={handleApiKeyChange}
                placeholder={llmConfig.hasApiKey ? (isZh ? '输入新密钥更新' : 'Enter new key to update') : (isZh ? '请输入 API 密钥' : 'Enter your API key')}
                style={{ flex: 1, maxWidth: 320 }}
                visibilityToggle={{
                  visible: showApiKey,
                  onVisibleChange: setShowApiKey,
                }}
              />
              <Button
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (isZh ? '隐藏' : 'Hide') : (isZh ? '显示' : 'Show')}
              </Button>
            </div>
          </Form.Item>

          <Form.Item
            label="Base URL"
            name="baseUrl"
            tooltip={isZh ? '每个提供商都有默认 URL，仅在自定义端点时修改' : 'Default URL is provided for each provider. Change only if using a custom endpoint.'}
          >
            <Input placeholder="https://api.example.com" style={{ maxWidth: 400 }} />
          </Form.Item>

          <Form.Item
            label={isZh ? '模型' : 'Model'}
            name="model"
            rules={[{ required: true, message: isZh ? '请选择或输入模型' : 'Please select or enter a model' }]}
          >
            {currentModels.length > 0 ? (
              <Select
                placeholder={isZh ? '选择模型' : 'Select a model'}
                style={{ maxWidth: 400 }}
                showSearch
                allowClear
              >
                {currentModels.map((model) => (
                  <Option key={model.value} value={model.value}>
                    {getModelLabel(model)}
                  </Option>
                ))}
              </Select>
            ) : (
              <Input
                placeholder={isZh ? '输入模型名称 (如: gpt-4, claude-3-opus)' : 'Enter model name (e.g., gpt-4, claude-3-opus)'}
                style={{ maxWidth: 400 }}
              />
            )}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleLLMSave} loading={saving}>
                {isZh ? '保存 LLM 配置' : 'Save LLM Configuration'}
              </Button>
              <Button onClick={fetchLLMConfig}>{isZh ? '重新加载' : 'Reload'}</Button>
            </Space>
          </Form.Item>

          {llmConfig.hasApiKey && !llmConfig.enabled && (
            <div style={{ marginTop: 16 }}>
              <Tag color="warning" style={{ padding: '8px 16px' }}>
                {isZh ? '配置已保存！正在重新连接...' : 'Configuration saved! Reconnecting...'}
              </Tag>
            </div>
          )}
        </Form>

        <Divider orientation="left">{isZh ? '帮助' : 'Help'}</Divider>
        <div style={{ color: token.colorTextSecondary, fontSize: 14 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Anthropic (Claude):</strong> {isZh ? '获取 API 密钥' : 'Get your API key from'}{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
              console.anthropic.com
            </a>
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong>OpenAI (GPT):</strong> {isZh ? '获取 API 密钥' : 'Get your API key from'}{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
              platform.openai.com
            </a>
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>{isZh ? '自定义' : 'Custom'}:</strong> {isZh ? '使用任何兼容 OpenAI 的 API，提供 Base URL 和 API 密钥' : 'Use any OpenAI-compatible API by providing the base URL and API key.'}
          </p>
        </div>
      </Card>
    </div>
  )
}

export default Settings
