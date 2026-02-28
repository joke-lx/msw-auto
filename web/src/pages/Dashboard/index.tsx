import { Card, Row, Col, Statistic, Table, Tag, theme } from 'antd'
import { useTranslation } from 'react-i18next'
import { useMockStore } from '@/stores/mockStore'

const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const { mocks, requestLogs } = useMockStore()
  const { token } = theme.useToken()

  const activeMocks = mocks.filter((mock) => mock.enabled).length
  const totalRequests = requestLogs.length

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
            <Statistic
              title="Disabled"
              value={mocks.length - activeMocks}
              valueStyle={{ color: token.colorTextSecondary }}
            />
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
