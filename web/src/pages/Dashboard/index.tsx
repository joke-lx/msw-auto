import { Card, Row, Col, Statistic, Table, Tag, Switch, theme, Button, message, Badge } from 'antd'
import { PlusOutlined, ThunderboltOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore } from '@/stores/mockStore'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'

const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const { mocks, globalEnabled, setGlobalEnabled } = useMockStore()
  const { token } = theme.useToken()
  const navigate = useNavigate()

  // Local state for request logs (loaded from server)
  const [requestLogs, setRequestLogs] = useState<any[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const activeMocks = mocks.filter((mock) => mock.enabled).length
  const totalRequests = requestLogs.length

  // Load request logs from server
  const fetchRequestLogs = async () => {
    try {
      const res = await fetch('/api/requests?limit=50')
      if (res.ok) {
        const logs = await res.json()
        setRequestLogs(logs)
      }
    } catch (error) {
      console.error('Failed to load request logs:', error)
    }
  }

  // Set up WebSocket for real-time updates
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout

    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001/ws')
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        console.log('[WebSocket] Connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'REQUEST') {
            // Add new request log to the list
            setRequestLogs((prev) => [data.data, ...prev].slice(0, 50))
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      }

      ws.onerror = () => {
        console.log('[WebSocket] Error')
        setWsConnected(false)
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setWsConnected(false)
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connectWebSocket, 3000)
      }
    }

    // Initial load
    fetchRequestLogs()

    // Start WebSocket connection
    connectWebSocket()

    return () => {
      clearTimeout(reconnectTimer)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const handleGlobalToggle = async (checked: boolean) => {
    try {
      const res = await fetch('/api/global-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      })
      const data = await res.json()
      setGlobalEnabled(data.enabled)
      message.success(data.enabled ? 'Mock 功能已开启' : 'Mock 功能已关闭')
    } catch (error) {
      console.error(error)
      message.error('操作失败')
    }
  }

  // 从请求日志创建 Mock
  const handleCreateMock = async (record: any) => {
    try {
      // 先尝试使用 AI 生成响应数据
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: record.method,
          path: record.path,
          description: `Auto-generated from request log`,
        }),
      })

      let mockData
      if (res.ok) {
        mockData = await res.json()
      } else {
        // AI 生成失败，使用默认数据
        mockData = {
          name: record.path,
          method: record.method,
          path: record.path,
          status: record.status || 200,
          response: record.response_body || { message: 'Mock data' },
          enabled: true,
        }
      }

      // 保存到服务器
      const saveRes = await fetch('/api/mocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      })

      if (saveRes.ok) {
        const savedMock = await saveRes.json()
        message.success('Mock 创建成功')
        navigate(`/mocks?id=${savedMock.id}`)
      } else {
        message.error('创建失败')
      }
    } catch (error) {
      console.error(error)
      message.error('创建失败')
    }
  }

  const columns = [
    {
      title: t('explorer.method'),
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => {
        const colorMap: Record<string, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red',
          PATCH: 'purple',
        }
        return <Tag color={colorMap[method] || 'default'}>{method}</Tag>
      },
    },
    {
      title: t('explorer.path'),
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: t('explorer.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => {
        let color = 'default'
        if (status >= 200 && status < 300) color = 'success'
        else if (status >= 400 && status < 500) color = 'warning'
        else if (status >= 500) color = 'error'
        return <Tag color={color}>{status}</Tag>
      },
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${duration}ms`,
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => {
        // Show "Create Mock" button only for 404 responses
        if (record.status === 404) {
          return (
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleCreateMock(record)}
            >
              AI 生成
            </Button>
          )
        }
        // For successful requests, show a simpler button
        return (
          <Button
            type="default"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleCreateMock(record)}
          >
            Mock
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{t('dashboard.title')}</h1>
        <Badge status={wsConnected ? 'processing' : 'error'} text={wsConnected ? '实时连接中' : '连接断开'}>
          {wsConnected ? <WifiOutlined /> : <DisconnectOutlined />}
        </Badge>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalRequests')}
              value={totalRequests}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.activeMocks')}
              value={activeMocks}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Mocks"
              value={mocks.length}
              valueStyle={{ color: token.colorInfo }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Mock Global</span>
              <Switch
                checked={globalEnabled}
                onChange={handleGlobalToggle}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
            </div>
          </Card>
        </Col>
      </Row>
      <Card title={t('dashboard.recentRequests')} style={{ marginTop: 24 }}>
        {requestLogs.length > 0 ? (
          <Table
            dataSource={requestLogs}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: token.colorTextSecondary }}>
            {t('dashboard.noRequests')}
          </div>
        )}
      </Card>
    </div>
  )
}

export default Dashboard
