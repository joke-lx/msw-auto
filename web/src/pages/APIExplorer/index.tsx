import { useState, useEffect, useRef } from 'react'
import { Card, Input, Select, Tag, Table, Button, Space, theme, message, Badge } from 'antd'
import { SearchOutlined, ReloadOutlined, ThunderboltOutlined, PlusOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore, HttpMethod } from '@/stores/mockStore'
import { useNavigate } from 'react-router-dom'

const { Option } = Select

const APIExplorer: React.FC = () => {
  const { t } = useTranslation()
  const { mocks } = useMockStore()
  const { token } = theme.useToken()
  const navigate = useNavigate()

  const [searchText, setSearchText] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Fetch all requests (including 404s)
  const fetchAllRequests = async () => {
    setLoading(true)
    try {
      console.log('[APIExplorer] Fetching all requests...')
      // Fetch both mocks and request logs
      const [mocksRes, logsRes] = await Promise.all([
        fetch('/api/mocks'),
        fetch('/api/requests?limit=100')
      ])

      const mocksData = mocksRes.ok ? await mocksRes.json() : []
      const logsData = logsRes.ok ? await logsRes.json() : []

      console.log('[APIExplorer] Mocks data:', mocksData.length, 'items')
      console.log('[APIExplorer] Logs data:', logsData.length, 'items')

      // Combine and deduplicate by method + path
      const requestMap = new Map<string, any>()

      // Add mocks first
      mocksData.forEach((mock: any) => {
        const key = `${mock.method}:${mock.path}`
        requestMap.set(key, {
          id: mock.id,
          method: mock.method,
          path: mock.path,
          status: mock.status || 200,
          delay: mock.delay || 0,
          enabled: mock.enabled,
          is_mocked: true,
          mock_id: mock.id,
          timestamp: mock.updated_at,
        })
      })

      console.log('[APIExplorer] After adding mocks, map size:', requestMap.size)

      // Add/merge with request logs
      logsData.forEach((log: any) => {
        const key = `${log.method}:${log.path}`
        const existing = requestMap.get(key)

        // Only add if not already in mocks, or update with latest info
        if (!existing) {
          requestMap.set(key, {
            id: log.id,
            method: log.method,
            path: log.path,
            status: log.response_status || 404,
            delay: 0,
            enabled: false,
            is_mocked: log.is_mocked,
            mock_id: log.mock_id,
            timestamp: log.timestamp,
          })
        }
      })

      const finalArray = Array.from(requestMap.values())
      console.log('[APIExplorer] Final merged data:', finalArray.length, 'items')
      console.log('[APIExplorer] Final data:', finalArray)
      setAllRequests(finalArray)
    } catch (error) {
      console.error('[APIExplorer] Failed to fetch requests:', error)
      message.error('加载失败')
    } finally {
      setLoading(false)
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
          console.log('[APIExplorer] WebSocket message received:', data)
          if (data.type === 'REQUEST') {
            console.log('[APIExplorer] REQUEST event, fetching all requests...')
            fetchAllRequests() // Refresh when new request comes in
          }
        } catch (e) {
          console.log('[APIExplorer] Failed to parse WebSocket message:', e)
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
    fetchAllRequests()

    // Start WebSocket connection
    connectWebSocket()

    return () => {
      clearTimeout(reconnectTimer)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Create Mock from request
  const handleCreateMock = async (record: any) => {
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: record.method,
          path: record.path,
          description: `Auto-generated from ${record.method} ${record.path}`,
        }),
      })

      let mockData
      if (res.ok) {
        mockData = await res.json()
      } else {
        // Fallback to basic mock
        mockData = {
          name: record.path,
          method: record.method,
          path: record.path,
          status: 200,
          response: { message: 'Success', data: {} },
          enabled: true,
        }
      }

      const saveRes = await fetch('/api/mocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockData),
      })

      if (saveRes.ok) {
        const savedMock = await saveRes.json()
        message.success('Mock 创建成功')
        fetchAllRequests() // Refresh list
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
      width: 100,
      render: (method: HttpMethod) => {
        const colorMap: Record<HttpMethod, string> = {
          GET: 'green',
          POST: 'blue',
          PUT: 'orange',
          DELETE: 'red',
          PATCH: 'purple',
          OPTIONS: 'default',
          HEAD: 'default',
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number, record: any) => {
        if (record.is_mocked) {
          return <Tag color="success">Mocked ({status})</Tag>
        }
        return <Tag color={status === 404 ? 'error' : 'warning'}>{status}</Tag>
      },
    },
    {
      title: t('mocks.delay'),
      dataIndex: 'delay',
      key: 'delay',
      width: 100,
      render: (delay: number) => `${delay}ms`,
    },
    {
      title: t('common.enabled'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record: any) => {
        if (record.is_mocked) {
          return <Tag color={enabled ? token.colorSuccess : token.colorTextSecondary}>
            {enabled ? t('common.enabled') : t('common.disabled')}
          </Tag>
        }
        return <Tag color="default">未配置</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          {!record.is_mocked || !record.enabled ? (
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleCreateMock(record)}
            >
              AI 生成
            </Button>
          ) : (
            <Button
              size="small"
              onClick={() => navigate(`/mocks?id=${record.id}`)}
            >
              编辑
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const filteredRequests = allRequests.filter((request) => {
    const matchesSearch =
      request.path.toLowerCase().includes(searchText.toLowerCase())
    const matchesMethod = methodFilter === 'all' || request.method === methodFilter
    return matchesSearch && matchesMethod
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{t('explorer.title')}</h1>
        <Space>
          <Badge status={wsConnected ? 'processing' : 'error'} text={wsConnected ? '实时' : '断开'}>
            {wsConnected ? <WifiOutlined /> : <DisconnectOutlined />}
          </Badge>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAllRequests}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder={t('explorer.search')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            value={methodFilter}
            onChange={setMethodFilter}
            style={{ width: 120 }}
          >
            <Option value="all">{t('explorer.filter')}</Option>
            <Option value="GET">GET</Option>
            <Option value="POST">POST</Option>
            <Option value="PUT">PUT</Option>
            <Option value="DELETE">DELETE</Option>
            <Option value="PATCH">PATCH</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAllRequests}
            loading={loading}
          >
            刷新
          </Button>
        </Space>

        {filteredRequests.length > 0 ? (
          <Table
            dataSource={filteredRequests}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: token.colorTextSecondary }}>
            {loading ? '加载中...' : (searchText || methodFilter !== 'all' ? '没有找到匹配的 API' : '暂无 API，发起请求后自动显示')}
          </div>
        )}

        {!loading && filteredRequests.length === 0 && !searchText && methodFilter === 'all' && (
          <div style={{ marginTop: 24, padding: 24, background: token.colorBgLayout, borderRadius: 8 }}>
            <h3 style={{ marginBottom: 16 }}>💡 提示</h3>
            <p style={{ marginBottom: 8 }}>
              <strong>自动拦截模式已开启</strong>
            </p>
            <p style={{ color: token.colorTextSecondary, marginBottom: 0 }}>
              访问任意 API 接口（如 <code>http://localhost:3001/api/posts</code>），
              系统会自动记录请求。然后点击"AI 生成"按钮即可创建 Mock。
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

export default APIExplorer
