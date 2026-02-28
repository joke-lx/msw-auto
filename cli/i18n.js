/**
 * CLI Internationalization (i18n)
 * Supports Chinese and English
 */

const translations = {
  en: {
    banner: {
      title: 'MSW Auto',
      subtitle: 'Intelligent Mock Server',
    },
    menu: {
      title: 'MSW Auto - Choose an action:',
      startServer: 'Start Mock Server',
      startWeb: 'Start Web UI',
      configureLlm: 'Configure LLM',
      showConfig: 'Show Config',
      exit: 'Exit',
      portSelect: 'Select server port:',
      webPortSelect: 'Select web port:',
      providerSelect: 'Select LLM provider:',
      starting: 'Starting...',
      success: 'Success!',
      failed: 'Failed',
      goodbye: 'Goodbye!',
    },
    providers: {
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI',
      custom: 'Custom',
    },
    ports: {
      default: 'default',
    },
    commands: {
      init: 'Initialize MSW',
      server: 'Start Mock server',
      web: 'Start Web UI',
      generate: 'AI generate Mock',
      import: 'Import from Postman/Swagger',
      config: 'Show LLM configuration',
      setting: 'Configure LLM (--provider, --apikey, --baseurl)',
      model: 'Switch LLM model',
      interactive: 'Start interactive menu',
    },
    config: {
      title: 'LLM Configuration',
      provider: 'Provider',
      baseUrl: 'Base URL',
      model: 'Model',
      apiKey: 'API Key',
      notSet: 'Not set',
      warning: 'Warning',
      runSetting: 'Run: msw-auto setting --apikey YOUR_API_KEY',
    },
    setting: {
      success: 'Configuration saved successfully!',
      error: 'Failed to save configuration',
    },
  },
  zh: {
    banner: {
      title: 'MSW Auto',
      subtitle: '智能 Mock 服务器',
    },
    menu: {
      title: 'MSW Auto - 请选择操作：',
      startServer: '启动 Mock 服务器',
      startWeb: '启动 Web UI',
      configureLlm: '配置 LLM',
      showConfig: '查看配置',
      exit: '退出',
      portSelect: '选择服务器端口：',
      webPortSelect: '选择 Web 端口：',
      providerSelect: '选择 LLM 提供商：',
      starting: '正在启动...',
      success: '成功！',
      failed: '失败',
      goodbye: '再见！',
    },
    providers: {
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI',
      custom: '自定义',
    },
    ports: {
      default: '默认',
    },
    commands: {
      init: '初始化 MSW',
      server: '启动 Mock 服务器',
      web: '启动 Web UI',
      generate: 'AI 生成 Mock',
      import: '从 Postman/Swagger 导入',
      config: '查看 LLM 配置',
      setting: '配置 LLM (--provider, --apikey, --baseurl)',
      model: '切换 LLM 模型',
      interactive: '启动交互菜单',
    },
    config: {
      title: 'LLM 配置',
      provider: '提供商',
      baseUrl: 'Base URL',
      model: '模型',
      apiKey: 'API 密钥',
      notSet: '未设置',
      warning: '警告',
      runSetting: '请运行：msw-auto setting --apikey 您的API密钥',
    },
    setting: {
      success: '配置保存成功！',
      error: '保存配置失败',
    },
  },
}

// Get language from environment or default to English
function getLanguage() {
  const lang = process.env.MSW_AUTO_LANG || 'en'
  if (lang === 'zh' || lang === 'cn') return 'zh'
  return 'en'
}

let currentLang = getLanguage()

export function setLanguage(lang) {
  if (lang === 'zh' || lang === 'cn') {
    currentLang = 'zh'
  } else {
    currentLang = 'en'
  }
  // Also set environment variable for subprocesses
  process.env.MSW_AUTO_LANG = currentLang
}

export function t(key) {
  const keys = key.split('.')
  let value = translations[currentLang]

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k]
    } else {
      return key
    }
  }

  return value || key
}

export function getCurrentLang() {
  return currentLang
}
