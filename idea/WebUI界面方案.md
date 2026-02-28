# Web UI 界面方案

## 一、UI 框架选型

### 1.1 技术栈

| 技术             | 版本 | 用途             |
| ---------------- | ---- | ---------------- |
| React            | 18.2 | UI 框架          |
| TypeScript       | 5.0  | 类型安全         |
| Vite             | 5.0  | 构建工具         |
| Ant Design       | 5.12 | UI 组件库        |
| React Router     | 6.20 | 路由             |
| Zustand          | 4.4  | 状态管理         |
| TanStack Query   | 5.0  | 数据获取         |
| Socket.io-client | 4.6  | WebSocket 客户端 |
| Monaco Editor    | 0.45 | 代码编辑器       |
| React Markdown   | 9.0  | Markdown 渲染    |
| Recharts         | 2.10 | 图表库           |

---

## 二、页面结构

### 2.1 路由配置

```typescript
// src/router/index.tsx
import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Dashboard from '../pages/Dashboard'
import APIExplorer from '../pages/APIExplorer'
import MockEditor from '../pages/MockEditor'
import Settings from '../pages/Settings'
import Documentation from '../pages/Documentation'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'explorer',
        element: <APIExplorer />,
      },
      {
        path: 'mocks/:id',
        element: <MockEditor />,
      },
      {
        path: 'mocks/new',
        element: <MockEditor />,
      },
      {
        path: 'docs',
        element: <Documentation />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
])
```

### 2.2 整体布局

```tsx
// src/components/Layout.tsx
import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, theme } from 'antd'
import {
  DashboardOutlined,
  ApiOutlined,
  EditOutlined,
  FileTextOutlined,
  SettingOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import ClaudeSidebar from './ClaudeSidebar'

const { Header, Sider, Content } = AntLayout

export default function Layout() {
  const location = useLocation()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>,
    },
    {
      key: '/explorer',
      icon: <ApiOutlined />,
      label: <Link to="/explorer">API 浏览器</Link>,
    },
    {
      key: '/mocks',
      icon: <EditOutlined />,
      label: <Link to="/mocks">Mock 管理</Link>,
    },
    {
      key: '/docs',
      icon: <FileTextOutlined />,
      label: <Link to="/docs">文档中心</Link>,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">设置</Link>,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark">
        <div
          className="logo"
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
          }}
        >
          🎭 Smart Mock
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              height: '100%',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                {
                  menuItems.find((item) => item.key === location.pathname)
                    ?.label.props.children
                }
              </h2>
            </div>
            <div>
              <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ marginLeft: 8 }}>Claude AI 助手</span>
            </div>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <Outlet />
            </div>
            <div style={{ width: 400 }}>
              <ClaudeSidebar />
            </div>
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
```

---

## 三、核心页面

### 3.1 仪表盘

```tsx
// src/pages/Dashboard.tsx
import React from 'react'
import { Row, Col, Card, Statistic, Table, Tag } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ApiOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useDashboardStats, useRecentRequests } from '../hooks/useDashboard'

export default function Dashboard() {
  const { stats, isLoading: statsLoading } = useDashboardStats()
  const { requests, isLoading: requestsLoading } = useRecentRequests()

  const requestColumns = [
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Mock',
      dataIndex: 'isMocked',
      key: 'isMocked',
      render: (isMocked: boolean) => (
        <Tag
          icon={isMocked ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={isMocked ? 'success' : 'default'}
        >
          {isMocked ? 'Mock' : '真实'}
        </Tag>
      ),
    },
    {
      title: '响应时间',
      dataIndex: 'responseTime',
      key: 'responseTime',
      render: (time: number) => `${time}ms`,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ]

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    }
    return colors[method] || 'default'
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'warning'
    if (status >= 400 && status < 500) return 'error'
    if (status >= 500) return 'error'
    return 'default'
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="总请求数"
              value={stats?.totalRequests || 0}
              prefix={<ApiOutlined />}
              suffix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="Mock 命中率"
              value={stats?.mockHitRate || 0}
              suffix="%"
              prefix={<RobotOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="活跃 Mock"
              value={stats?.activeMocks || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="平均响应时间"
              value={stats?.avgResponseTime || 0}
              suffix="ms"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="最近请求" extra={<a href="/explorer">查看全部</a>}>
            <Table
              columns={requestColumns}
              dataSource={requests}
              loading={requestsLoading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
```

### 3.2 API 浏览器

```tsx
// src/pages/APIExplorer.tsx
import React, { useState } from 'react'
import { Table, Button, Space, Tag, Modal, message } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useRequests } from '../hooks/useRequests'
import RequestDetail from '../components/RequestDetail'
import MockCreator from '../components/MockCreator'

export default function APIExplorer() {
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [mockCreatorVisible, setMockCreatorVisible] = useState(false)
  const { requests, isLoading, refetch } = useRequests()

  const columns = [
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '参数',
      dataIndex: 'query',
      key: 'query',
      render: (query: any) => <span>{Object.keys(query || {}).length}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isMocked',
      key: 'isMocked',
      width: 100,
      render: (isMocked: boolean) => (
        <Tag color={isMocked ? 'success' : 'default'}>
          {isMocked ? 'Mock' : '真实'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedRequest(record)}
          >
            详情
          </Button>
          {!record.isMocked && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedRequest(record)
                setMockCreatorVisible(true)
              }}
            >
              生成 Mock
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    }
    return colors[method] || 'default'
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'warning'
    if (status >= 400 && status < 500) return 'error'
    return 'default'
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <h2>API 请求日志</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          创建 Mock
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={requests}
        loading={isLoading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="请求详情"
        open={!!selectedRequest}
        onCancel={() => setSelectedRequest(null)}
        footer={null}
        width={800}
      >
        {selectedRequest && <RequestDetail request={selectedRequest} />}
      </Modal>

      <Modal
        title="创建 Mock"
        open={mockCreatorVisible}
        onCancel={() => setMockCreatorVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedRequest && (
          <MockCreator
            request={selectedRequest}
            onSuccess={() => {
              setMockCreatorVisible(false)
              setSelectedRequest(null)
              refetch()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
```

### 3.3 Mock 编辑器

```tsx
// src/pages/MockEditor.tsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  message,
  Space,
  Card,
  Tabs,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useMock, useUpdateMock, useCreateMock } from '../hooks/useMocks'
import { useClaudeGenerateMock } from '../hooks/useClaude'
import CodeEditor from '../components/CodeEditor'

const { TextArea } = Input

export default function MockEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id && id !== 'new'

  const { mock, isLoading } = useMock(id!)
  const { updateMock } = useUpdateMock()
  const { createMock } = useCreateMock()
  const { generateMock, isGenerating } = useClaudeGenerateMock()

  const [form] = Form.useForm()
  const [responseData, setResponseData] = useState<any>(null)

  useEffect(() => {
    if (mock && isEditMode) {
      form.setFieldsValue({
        method: mock.method,
        path: mock.path,
        status: mock.status,
        headers: JSON.stringify(mock.headers, null, 2),
        cookies: JSON.stringify(mock.cookies, null, 2),
        delay: mock.delay,
        enabled: mock.enabled,
        dynamic_response: mock.dynamic_response,
        description: mock.description,
        tags: mock.tags?.join(', ') || '',
      })
      setResponseData(mock.response)
    }
  }, [mock, isEditMode, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      const mockData = {
        method: values.method,
        path: values.path,
        status: values.status,
        response: responseData,
        headers: values.headers ? JSON.parse(values.headers) : undefined,
        cookies: values.cookies ? JSON.parse(values.cookies) : undefined,
        delay: values.delay,
        enabled: values.enabled,
        dynamic_response: values.dynamic_response,
        description: values.description,
        tags: values.tags
          ?.split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
      }

      if (isEditMode) {
        await updateMock(id!, mockData)
        message.success('Mock 更新成功')
      } else {
        await createMock(mockData)
        message.success('Mock 创建成功')
      }

      navigate('/mocks')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleAIGenerate = async () => {
    try {
      const values = form.getFieldsValue()
      const requestInfo = {
        method: values.method,
        path: values.path,
        description: values.description,
      }

      const generatedMock = await generateMock(requestInfo)

      setResponseData(generatedMock.response)
      form.setFieldsValue({
        status: generatedMock.status,
        headers: JSON.stringify(generatedMock.headers, null, 2),
      })

      message.success('AI 生成成功')
    } catch (error) {
      message.error('AI 生成失败')
    }
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Space>
          <Button
            onClick={handleAIGenerate}
            loading={isGenerating}
            icon={<RobotOutlined />}
          >
            AI 生成
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          method: 'GET',
          status: 200,
          delay: 0,
          enabled: true,
          dynamic_response: false,
        }}
      >
        <Card title="基本信息" style={{ marginBottom: 16 }}>
          <Form.Item
            label="HTTP 方法"
            name="method"
            rules={[{ required: true }]}
          >
            <Select style={{ width: 120 }}>
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
              <Select.Option value="PATCH">PATCH</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="API 路径"
            name="path"
            rules={[{ required: true, message: '请输入 API 路径' }]}
            extra="支持路径参数，如：/users/:id"
          >
            <Input placeholder="/api/users" />
          </Form.Item>

          <Form.Item label="状态码" name="status">
            <Input type="number" placeholder="200" style={{ width: 120 }} />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="描述这个 Mock 的用途" />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Input placeholder="users, list, rest (用逗号分隔)" />
          </Form.Item>
        </Card>

        <Card title="响应配置" style={{ marginBottom: 16 }}>
          <Tabs
            items={[
              {
                key: 'response',
                label: '响应体',
                children: (
                  <div>
                    <Button
                      size="small"
                      onClick={handleAIGenerate}
                      loading={isGenerating}
                      style={{ marginBottom: 8 }}
                    >
                      使用 AI 生成
                    </Button>
                    <CodeEditor
                      value={responseData}
                      onChange={setResponseData}
                      language="json"
                      height={300}
                    />
                  </div>
                ),
              },
              {
                key: 'headers',
                label: '响应头',
                children: (
                  <Form.Item name="headers" noStyle>
                    <TextArea
                      rows={10}
                      placeholder='{"Content-Type": "application/json"}'
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                ),
              },
              {
                key: 'cookies',
                label: 'Cookies',
                children: (
                  <Form.Item name="cookies" noStyle>
                    <TextArea
                      rows={10}
                      placeholder='{"token": "abc123"}'
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Card>

        <Card title="高级配置">
          <Form.Item label="延迟（毫秒）" name="delay">
            <Input type="number" placeholder="0" style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="动态响应"
            name="dynamic_response"
            valuePropName="checked"
            extra="启用后，响应体将支持模板变量"
          >
            <Switch />
          </Form.Item>
        </Card>
      </Form>
    </div>
  )
}
```

---

## 四、核心组件

### 4.1 Claude 侧边栏

```tsx
// src/components/ClaudeSidebar.tsx
import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Space, Avatar, Tag, Divider } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useClaudeChat, useClaudeConnection } from '../hooks/useClaude'
import MarkdownContent from './MarkdownContent'

const { TextArea } = Input

export default function ClaudeSidebar() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { isConnected, checkConnection } = useClaudeConnection()
  const { chat } = useClaudeChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkConnection()

    // 欢迎消息
    setMessages([
      {
        role: 'assistant',
        content:
          '你好！我是你的 AI Mock 助手。我可以帮你：\n\n' +
          '1. 📊 生成 Mock 数据\n' +
          '2. ✏️ 修改现有 Mock\n' +
          '3. 📄 生成 API 文档\n' +
          '4. 💡 提供优化建议\n\n' +
          '有什么可以帮你的吗？',
      },
    ])
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || !isConnected) return

    const userMessage = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await chat(messages, userMessage.content)
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `抱歉，我遇到了一些问题：${error instanceof Error ? error.message : '未知错误'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const quickActions = [
    { label: '生成 Mock 数据', prompt: '请生成一个用户列表的 Mock 数据' },
    { label: '改进 Mock', prompt: '请改进当前 Mock 的数据结构' },
    { label: '生成文档', prompt: '请生成这个 API 的完整文档' },
  ]

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          <span>Claude AI 助手</span>
          <Tag color={isConnected ? 'success' : 'error'}>
            {isConnected ? '已连接' : '未连接'}
          </Tag>
        </Space>
      }
      extra={
        isConnected && (
          <Button size="small" onClick={checkConnection}>
            刷新
          </Button>
        )
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 200px)',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {messages.map((message, index) => (
            <div key={index} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <Avatar
                  size={24}
                  icon={
                    message.role === 'user' ? (
                      <UserOutlined />
                    ) : (
                      <RobotOutlined />
                    )
                  }
                  style={{
                    backgroundColor:
                      message.role === 'user' ? '#1890ff' : '#52c41a',
                    marginRight: 8,
                  }}
                />
                <span style={{ fontSize: 12, color: '#999' }}>
                  {message.role === 'user' ? '用户' : 'Claude'}
                </span>
              </div>
              <div
                style={{
                  background: message.role === 'user' ? '#e6f7ff' : '#f6ffed',
                  padding: 12,
                  borderRadius: 8,
                  marginLeft: 32,
                }}
              >
                <MarkdownContent content={message.content} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ textAlign: 'center', color: '#999' }}>
              <LoadingOutlined spin /> 思考中...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <Divider />

        <Space direction="vertical" style={{ width: '100%', marginBottom: 8 }}>
          {quickActions.map((action, index) => (
            <Button
              key={index}
              size="small"
              onClick={() => setInput(action.prompt)}
            >
              {action.label}
            </Button>
          ))}
        </Space>

        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题或指令..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={!isConnected}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isConnected}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </Card>
  )
}
```

### 4.2 API 面板

```tsx
// src/components/APIPanel.tsx
import React from 'react'
import { Card, Descriptions, Tag, Button, Space, Tabs, message } from 'antd'
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { generateMarkdownDocumentation } from '../utils/formatters'
import CodeEditor from './CodeEditor'

interface APIPanelProps {
  request: any
  mock?: any
}

export default function APIPanel({ request, mock }: APIPanelProps) {
  const [markdown, setMarkdown] = React.useState('')

  const handleGenerateDoc = () => {
    const doc = generateMarkdownDocumentation(request, mock)
    setMarkdown(doc)
  }

  const handleCopyDoc = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      message.success('已复制到剪贴板')
    } catch (error) {
      message.error('复制失败')
    }
  }

  const handleDownloadDoc = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${request.path.replace(/\//g, '-')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!request) {
    return <Card>选择一个请求查看详情</Card>
  }

  return (
    <Card
      title="API 详情"
      extra={
        <Space>
          <Button icon={<CopyOutlined />} onClick={handleGenerateDoc}>
            生成文档
          </Button>
          {markdown && (
            <>
              <Button icon={<CopyOutlined />} onClick={handleCopyDoc}>
                复制
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadDoc}>
                下载
              </Button>
            </>
          )}
        </Space>
      }
    >
      <Tabs
        items={[
          {
            key: 'info',
            label: '请求信息',
            children: (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="方法">
                  <Tag color={getMethodColor(request.method)}>
                    {request.method}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="路径">
                  {request.path}
                </Descriptions.Item>
                <Descriptions.Item label="完整 URL">
                  {request.url}
                </Descriptions.Item>

                {request.query && Object.keys(request.query).length > 0 && (
                  <Descriptions.Item label="查询参数">
                    <CodeEditor
                      value={JSON.stringify(request.query, null, 2)}
                      language="json"
                      height={100}
                      readOnly
                    />
                  </Descriptions.Item>
                )}

                <Descriptions.Item label="请求头">
                  <CodeEditor
                    value={JSON.stringify(request.headers, null, 2)}
                    language="json"
                    height={100}
                    readOnly
                  />
                </Descriptions.Item>

                {request.body && (
                  <Descriptions.Item label="请求体">
                    <CodeEditor
                      value={JSON.stringify(request.body, null, 2)}
                      language="json"
                      height={150}
                      readOnly
                    />
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          },
          {
            key: 'response',
            label: '响应',
            children: (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="状态码">
                  <Tag color={getStatusColor(request.responseStatus)}>
                    {request.responseStatus}
                  </Tag>
                </Descriptions.Item>

                {mock && (
                  <>
                    <Descriptions.Item label="延迟">
                      {mock.delay}ms
                    </Descriptions.Item>
                    <Descriptions.Item label="类型">
                      <Tag color={mock.enabled ? 'success' : 'default'}>
                        {mock.enabled ? 'Mock' : '真实'}
                      </Tag>
                    </Descriptions.Item>
                  </>
                )}

                {request.responseBody && (
                  <Descriptions.Item label="响应体">
                    <CodeEditor
                      value={JSON.stringify(request.responseBody, null, 2)}
                      language="json"
                      height={200}
                      readOnly
                    />
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          },
          {
            key: 'markdown',
            label: 'Markdown 文档',
            children: markdown ? (
              <CodeEditor
                value={markdown}
                language="markdown"
                height={400}
                onChange={setMarkdown}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                点击"生成文档"按钮生成 API 文档
              </div>
            ),
          },
        ]}
      />
    </Card>
  )

  function getMethodColor(method: string) {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    }
    return colors[method] || 'default'
  }

  function getStatusColor(status: number) {
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'warning'
    if (status >= 400 && status < 500) return 'error'
    return 'default'
  }
}
```

---

## 五、样式主题

### 5.1 主题配置

```typescript
// src/theme/index.ts
import { theme } from 'antd'

const { defaultAlgorithm, darkAlgorithm } = theme

export const appTheme = {
  algorithm: defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
  },
  components: {
    Layout: {
      headerBg: '#001529',
      siderBg: '#001529',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#1890ff',
    },
  },
}
```

### 5.2 全局样式

```css
/* src/styles/global.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  background: #f0f2f5;
}

.ant-layout {
  min-height: 100vh;
}

.ant-layout-sider {
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.ant-layout-header {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Markdown 样式 */
.markdown-content {
  line-height: 1.6;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.markdown-content pre {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.markdown-content code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.markdown-content pre code {
  background: transparent;
  padding: 0;
}
```

---

## 六、总结

Web UI 界面方案提供了：

✅ **现代化界面**：基于 Ant Design 的专业 UI
✅ **完整的页面**：仪表盘、API 浏览器、Mock 编辑器等
✅ **Claude 集成**：侧边栏实时对话
✅ **响应式设计**：适配各种屏幕尺寸
✅ **实时更新**：WebSocket 实时通信
✅ **代码编辑**：Monaco Editor 支持
✅ **文档生成**：一键生成 Markdown 文档

核心组件：

- **仪表盘**：统计数据和最近请求
- **API 浏览器**：查看和搜索请求日志
- **Mock 编辑器**：创建和编辑 Mock
- **Claude 侧边栏**：AI 智能助手
- **API 面板**：详细的请求/响应信息
- **代码编辑器**：语法高亮的代码编辑

关键优势：

- **用户友好**：直观的操作界面
- **功能完整**：覆盖所有使用场景
- **实时性**：WebSocket 实时更新
- **扩展性**：易于添加新功能
