import { Card, Row, Col, Statistic, Table, Tag, Switch, theme, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore } from '@/stores/mockStore'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const { mocks, requestLogs, globalEnabled, setGlobalEnabled } = useMockStore()
  const { token } = theme.useToken()
  const navigate = useNavigate()

  const activeMocks = mocks.filter((mock) => mock.enabled).length
  const totalRequests = requestLogs.length

  // 同步全局开关状态
  useEffect(() => {
    fetch('/api/global-toggle')
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled !== globalEnabled) {
          setGlobalEnabled(data.enabled)
        }
      })
      .catch(console.error)
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
      width: 120,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => handleCreateMock(record)}
        >
          Create Mock
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('dashboard.title')}</h1>
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
