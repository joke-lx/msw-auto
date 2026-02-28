import { useState } from 'react'
import { Card, Input, Select, Tag, Table, Button, Space, theme } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore, HttpMethod } from '@/stores/mockStore'

const { Option } = Select

const APIExplorer: React.FC = () => {
  const { t } = useTranslation()
  const { mocks, requestLogs } = useMockStore()
  const { token } = theme.useToken()
  const [searchText, setSearchText] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')

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
      title: t('mocks.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => <span>{status}</span>,
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
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? token.colorSuccess : token.colorTextSecondary}>
          {enabled ? t('common.enabled') : t('common.disabled')}
        </Tag>
      ),
    },
  ]

  const filteredMocks = mocks.filter((mock) => {
    const matchesSearch =
      mock.path.toLowerCase().includes(searchText.toLowerCase()) ||
      mock.name.toLowerCase().includes(searchText.toLowerCase())
    const matchesMethod = methodFilter === 'all' || mock.method === methodFilter
    return matchesSearch && matchesMethod
  })

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('explorer.title')}</h1>
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
        </Space>
        {filteredMocks.length > 0 ? (
          <Table
            dataSource={filteredMocks}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: token.colorTextSecondary }}>
            {t('explorer.noApis')}
          </div>
        )}
      </Card>
    </div>
  )
}

export default APIExplorer
