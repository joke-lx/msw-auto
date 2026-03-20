/**
 * 契约详情页面
 * 显示契约的完整信息，包括端点列表、Schema 可视化、Mock 生成等
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Descriptions,
  Typography,
  Alert,
  Modal,
  Input,
  message,
  Row,
  Col,
  Statistic,
  Empty,
  Tree,
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CodeOutlined,
  ApiOutlined,
  FileTextOutlined,
  CopyOutlined,
  CheckOutlined,
  ThunderboltOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useContractStore } from '@/stores/contractStore'
import type { EndpointInfo, MockGenerationResult } from '@/types/contract'
import { useTranslation } from 'react-i18next'
// 使用简单的 JSON 显示组件代替 react-json-view
const JsonViewer = ({ src }: { src: any }) => {
  const jsonStr = JSON.stringify(src, null, 2)
  return (
    <pre
      style={{
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 4,
        overflow: 'auto',
        maxHeight: 500,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {jsonStr}
    </pre>
  )
}

const { Title, Paragraph, Text } = Typography

const ContractDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    selectedContract,
    loading,
    error,
    fetchContractById,
    syncContract,
    generateMocks,
    extractEndpoints,
    clearError,
  } = useContractStore()

  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointInfo | null>(null)
  const [mockModalOpen, setMockModalOpen] = useState(false)
  const [generatedMocks, setGeneratedMocks] = useState<MockGenerationResult[]>([])
  const [copied, setCopied] = useState(false)
  const [schemaSearch, setSchemaSearch] = useState('')

  useEffect(() => {
    if (id) {
      loadContract()
    }
  }, [id])

  useEffect(() => {
    if (selectedContract) {
      setEndpoints(extractEndpoints(selectedContract))
    }
  }, [selectedContract, extractEndpoints])

  useEffect(() => {
    if (error) {
      message.error(error)
      clearError()
    }
  }, [error, clearError])

  const loadContract = async () => {
    if (!id) return
    const contract = await fetchContractById(id)
    if (contract) {
      extractEndpoints(contract)
    }
  }

  const handleSync = async () => {
    if (!id) return
    try {
      await syncContract(id)
      message.success(t('contracts.syncSuccess'))
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.syncFailed'))
    }
  }

  const handleGenerateMock = async () => {
    if (!id || !selectedEndpoint) return
    try {
      const mocks = await generateMocks(id, selectedEndpoint.path, selectedEndpoint.method)
      setGeneratedMocks(mocks)
      setMockModalOpen(true)
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.generateMockFailed'))
    }
  }

  const handleCopyMock = (mock: any) => {
    const json = JSON.stringify(mock, null, 2)
    navigator.clipboard.writeText(json)
    setCopied(true)
    message.success(t('contracts.copied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
      OPTIONS: 'default',
      HEAD: 'default',
    }
    return colors[method] || 'default'
  }

  const endpointColumns: ColumnsType<EndpointInfo> = [
    {
      title: t('contracts.method'),
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: t('contracts.path'),
      dataIndex: 'path',
      key: 'path',
      render: (path) => <Text code>{path}</Text>,
    },
    {
      title: t('contracts.summary'),
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (summary) => summary || '-',
    },
    {
      title: t('contracts.tags'),
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags?.map((tag: string) => <Tag key={tag}>{tag}</Tag>) || '-',
    },
    {
      title: t('contracts.hasResponse'),
      dataIndex: 'hasResponse',
      key: 'hasResponse',
      width: 120,
      render: (hasResponse) => (
        <Tag color={hasResponse ? 'success' : 'warning'}>
          {hasResponse ? t('contracts.yes') : t('contracts.no')}
        </Tag>
      ),
    },
    {
      title: t('contracts.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => {
            setSelectedEndpoint(record)
            handleGenerateMock()
          }}
          disabled={!record.hasResponse}
        >
          {t('contracts.generateMock')}
        </Button>
      ),
    },
  ]

  const renderSchemaTree = () => {
    if (!selectedContract?.spec) return null

    return (
      <Input
        placeholder={t('contracts.searchSchema')}
        prefix={<SearchOutlined />}
        value={schemaSearch}
        onChange={(e) => setSchemaSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />
    )
  }

  const renderSchemaProperties = (schema: any): any[] => {
    if (!schema?.properties) return []
    return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
      title: (
        <Space>
          <Text code>{name}</Text>
          <Text type="secondary">{prop.type}</Text>
          {schema.required?.includes(name) && <Text type="danger">*</Text>}
        </Space>
      ),
      key: name,
    }))
  }

  const renderInfo = () => {
    if (!selectedContract) return null
    const info = selectedContract.spec.info

    return (
      <Card title={t('contracts.info')}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label={t('contracts.title')}>
            {info?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.version')}>
            {info?.version || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.description')} span={2}>
            <Paragraph ellipsis={{ rows: 3 }}>
              {info?.description || '-'}
            </Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.sourceType')}>
            <Tag color={selectedContract.sourceType === 'live' ? 'cyan' : 'default'}>
              {selectedContract.sourceType === 'live'
                ? t('contracts.sourceLive')
                : t('contracts.sourceFile')}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.sourceUrl')}>
            {selectedContract.sourceUrl || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.createdAt')}>
            {new Date(selectedContract.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label={t('contracts.updatedAt')}>
            {new Date(selectedContract.updatedAt).toLocaleString()}
          </Descriptions.Item>
          {selectedContract.lastSyncedAt && (
            <Descriptions.Item label={t('contracts.lastSyncedAt')} span={2}>
              {new Date(selectedContract.lastSyncedAt).toLocaleString()}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )
  }

  const renderStats = () => {
    if (!selectedContract) return null
    const totalEndpoints = endpoints.length
    const hasResponseCount = endpoints.filter((e) => e.hasResponse).length
    const coverage = totalEndpoints > 0 ? (hasResponseCount / totalEndpoints) * 100 : 0

    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('contracts.totalEndpoints')}
              value={totalEndpoints}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('contracts.hasResponse')}
              value={hasResponseCount}
              prefix={<CheckOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('contracts.coverage')}
              value={coverage}
              precision={1}
              suffix="%"
              valueStyle={{ color: coverage > 80 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
    )
  }

  const tabItems = [
    {
      key: 'endpoints',
      label: (
        <span>
          <ApiOutlined />
          {t('contracts.endpoints')}
        </span>
      ),
      children: (
        <Table
          rowKey={(record) => `${record.method}-${record.path}`}
          columns={endpointColumns}
          dataSource={endpoints}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      ),
    },
    {
      key: 'schemas',
      label: (
        <span>
          <FileTextOutlined />
          {t('contracts.schemas')}
        </span>
      ),
      children: (
        <div>
          {renderSchemaTree()}
          {Object.keys(
            selectedContract?.spec?.components?.schemas ||
            selectedContract?.spec?.definitions || {}
          ).length === 0 ? (
            <Empty description={t('contracts.noSchemas')} />
          ) : (
            <Tree
              treeData={Object.entries(
                selectedContract?.spec?.components?.schemas ||
                selectedContract?.spec?.definitions || {}
              ).map(([name, schema]: [string, any]) => ({
                title: name,
                key: name,
                children: renderSchemaProperties(schema),
              }))}
              showLine
              defaultExpandAll
            />
          )}
        </div>
      ),
    },
    {
      key: 'raw',
      label: (
        <span>
          <CodeOutlined />
          {t('contracts.rawSpec')}
        </span>
      ),
      children: (
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          <JsonViewer src={selectedContract?.spec || {}} />
        </div>
      ),
    },
  ]

  if (!selectedContract) {
    return (
      <Card>
        <Empty description={t('contracts.notFound')} />
        <Button type="primary" onClick={() => navigate('/contracts')}>
          {t('contracts.backToList')}
        </Button>
      </Card>
    )
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/contracts')}
            />
            <Title level={4} style={{ margin: 0 }}>
              {selectedContract.name}
            </Title>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleSync} loading={loading}>
              {t('contracts.sync')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const { contractApi } = require('@/api/client')
                contractApi.downloadTypes(selectedContract.id)
              }}
            >
              {t('contracts.downloadTypes')}
            </Button>
          </Space>
        }
      >
        {renderInfo()}
      </Card>

      {renderStats()}

      <Card style={{ marginTop: 16 }}>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={t('contracts.generatedMock')}
        open={mockModalOpen}
        onCancel={() => setMockModalOpen(false)}
        width={800}
        footer={
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => copied || handleCopyMock(generatedMocks[0]?.mock)}
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
            {copied ? t('contracts.copied') : t('contracts.copy')}
          </Button>
        }
      >
        {generatedMocks.map((result, index) => (
          <div key={index}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Tag color={getMethodColor(result.method)}>{result.method}</Tag>
                <Text code>{result.endpoint}</Text>
              </div>
              <JsonViewer src={result.mock.response} />
              {result.variants && (
                <Alert
                  message={t('contracts.variantsAvailable')}
                  description={
                    <Space>
                      {result.variants.empty !== undefined && (
                        <Tag>{t('contracts.emptyVariant')}</Tag>
                      )}
                      {result.variants.error && <Tag>{t('contracts.errorVariant')}</Tag>}
                    </Space>
                  }
                  type="info"
                />
              )}
            </Space>
          </div>
        ))}
      </Modal>
    </div>
  )
}

export default ContractDetail
