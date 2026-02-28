import { Card, Typography, Space, theme } from 'antd'
import { useTranslation } from 'react-i18next'

const { Title, Paragraph, Text } = Typography

const Documentation: React.FC = () => {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('documentation.title')}</h1>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title={t('documentation.gettingStarted')}>
          <Typography>
            <Paragraph>
              Welcome to <Text strong>MSW Auto</Text>, an intelligent automated Mock server built on top of MSW
              (Mock Service Worker).
            </Paragraph>
            <Paragraph>
              This documentation will help you get started with installing, configuring, and using MSW Auto.
            </Paragraph>
          </Typography>
        </Card>

        <Card title={t('documentation.installation')}>
          <Typography>
            <Paragraph>
              Install MSW Auto using npm or yarn:
            </Paragraph>
            <pre
              style={{
                background: token.colorBgContainer,
                padding: 16,
                borderRadius: token.borderRadius,
                overflow: 'auto',
              }}
            >
              <code>npm install msw-auto</code>
            </pre>
            <Paragraph style={{ marginTop: 16 }}>
              Or using pnpm:
            </Paragraph>
            <pre
              style={{
                background: token.colorBgContainer,
                padding: 16,
                borderRadius: token.borderRadius,
                overflow: 'auto',
              }}
            >
              <code>pnpm add msw-auto</code>
            </pre>
          </Typography>
        </Card>

        <Card title={t('documentation.configuration')}>
          <Typography>
            <Paragraph>
              Initialize MSW Auto in your project:
            </Paragraph>
            <pre
              style={{
                background: token.colorBgContainer,
                padding: 16,
                borderRadius: token.borderRadius,
                overflow: 'auto',
              }}
            >
              <code>npx msw-auto init</code>
            </pre>
            <Paragraph style={{ marginTop: 16 }}>
              Start the web UI for managing your mocks:
            </Paragraph>
            <pre
              style={{
                background: token.colorBgContainer,
                padding: 16,
                borderRadius: token.borderRadius,
                overflow: 'auto',
              }}
            >
              <code>npx msw-auto web</code>
            </pre>
          </Typography>
        </Card>

        <Card title={t('documentation.examples')}>
          <Typography>
            <Paragraph>
              Create a simple mock handler:
            </Paragraph>
            <pre
              style={{
                background: token.colorBgContainer,
                padding: 16,
                borderRadius: token.borderRadius,
                overflow: 'auto',
              }}
            >
              <code>{`import { http, HttpResponse } from 'msw-auto'

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Doe' }
    ])
  })
]`}</code>
            </pre>
          </Typography>
        </Card>
      </Space>
    </div>
  )
}

export default Documentation
