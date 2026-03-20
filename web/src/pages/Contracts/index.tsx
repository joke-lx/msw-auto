/**
 * 契约列表页面
 * 显示所有 API 契约，支持发现、同步、删除等操作
 */

import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Tooltip,
  Statistic,
  Row,
  Col,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  DeleteOutlined,
  SyncOutlined,
  DownloadOutlined,
  CodeOutlined,
  PlusOutlined,
  FileTextOutlined,
  CloudOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useContractStore } from '@/stores/contractStore'
import type { Contract } from '@/types/contract'

const Contracts = () => {
  const { t } = useTranslation()
  const {
    contracts,
    loading,
    error,
    stats,
    fetchContracts,
    discoverContracts,
    deleteContract,
    syncContract,
    generateTypes,
    getStats,
    clearError,
  } = useContractStore()

  const [discoverModalOpen, setDiscoverModalOpen] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [downloadingTypes, setDownloadingTypes] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  useEffect(() => {
    getStats()
  }, [contracts, getStats])

  useEffect(() => {
    if (error) {
      message.error(error)
      clearError()
    }
  }, [error, clearError])

  const handleDiscover = async (values: any) => {
    try {
      await discoverContracts(values)
      message.success(t('contracts.discoverSuccess'))
      setDiscoverModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.discoverFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteContract(id)
      message.success(t('contracts.deleteSuccess'))
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.deleteFailed'))
    }
  }

  const handleBatchDelete = async () => {
    try {
      for (const id of selectedRowKeys) {
        await deleteContract(id as string)
      }
      setSelectedRowKeys([])
      message.success(t('contracts.batchDeleteSuccess'))
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.batchDeleteFailed'))
    }
  }

  const handleSync = async (id: string) => {
    try {
      await syncContract(id)
      message.success(t('contracts.syncSuccess'))
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.syncFailed'))
    }
  }

  const handleDownloadTypes = async (contract: Contract) => {
    setDownloadingTypes((prev) => ({ ...prev, [contract.id]: true }))
    try {
      await generateTypes(contract.id)
      // 直接触发下载
      const { contractApi } = await import('@/api/client')
      await contractApi.downloadTypes(contract.id)
      message.success(t('contracts.downloadTypesSuccess'))
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('contracts.downloadTypesFailed'))
    } finally {
      setDownloadingTypes((prev) => ({ ...prev, [contract.id]: false }))
    }
  }

  const getSourceIcon = (sourceType: Contract['sourceType']) => {
    return sourceType === 'live' ? <CloudOutlined /> : <FolderOutlined />
  }

  const getVersionTag = (version: string) => {
    const color = version === 'openapi3' ? 'blue' : 'green'
    const label = version === 'openapi3' ? 'OpenAPI 3.x' : 'Swagger 2.0'
    return <Tag color={color}>{label}</Tag>
  }

  const columns: ColumnsType<Contract> = [
    {
      title: t('contracts.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <Space>
          {getSourceIcon(record.sourceType)}
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: t('contracts.source'),
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 100,
      filters: [
        { text: t('contracts.sourceLive'), value: 'live' },
        { text: t('contracts.sourceFile'), value: 'file' },
      ],
      onFilter: (value, record) => record.sourceType === value,
      render: (sourceType) => (
        <Tag color={sourceType === 'live' ? 'cyan' : 'default'}>
          {sourceType === 'live' ? t('contracts.sourceLive') : t('contracts.sourceFile')}
        </Tag>
      ),
    },
    {
      title: t('contracts.version'),
      dataIndex: 'version',
      key: 'version',
      width: 140,
      render: (_, record) => getVersionTag(record.version),
    },
    {
      title: t('contracts.endpoints'),
      key: 'endpoints',
      width: 100,
      render: (_, record) => {
        const count = Object.keys(record.spec?.paths || {}).length
        return <Tag color="purple">{count} {t('contracts.endpoints')}</Tag>
      },
    },
    {
      title: t('contracts.lastSynced'),
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
      width: 180,
      sorter: (a, b) =>
        new Date(b.lastSyncedAt || b.updatedAt).getTime() -
        new Date(a.lastSyncedAt || a.updatedAt).getTime(),
      render: (date, record) => {
        const syncDate = date || record.updatedAt
        return new Date(syncDate).toLocaleString()
      },
    },
    {
      title: t('contracts.actions'),
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('contracts.sync')}>
            <Button
              type="text"
              icon={<SyncOutlined />}
              onClick={() => handleSync(record.id)}
              disabled={record.sourceType !== 'live'}
            />
          </Tooltip>
          <Tooltip title={t('contracts.downloadTypes')}>
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadTypes(record)}
              loading={downloadingTypes[record.id]}
            />
          </Tooltip>
          <Popconfirm
            title={t('contracts.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('contracts.totalContracts')}
              value={stats?.totalContracts || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('contracts.totalEndpoints')}
              value={stats?.totalEndpoints || 0}
              prefix={<CodeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('contracts.liveSources')}
              value={stats?.liveSources || 0}
              prefix={<CloudOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t('contracts.recentlySynced')}
              value={stats?.recentlySynced || 0}
              prefix={<SyncOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={t('contracts.title')}
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={t('contracts.batchDeleteConfirm')}
                onConfirm={handleBatchDelete}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button danger icon={<DeleteOutlined />}>
                  {t('contracts.batchDelete')} ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDiscoverModalOpen(true)}
            >
              {t('contracts.discover')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchContracts()} loading={loading}>
              {t('common.refresh')}
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={contracts}
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('contracts.total', { count: total }),
          }}
          onRow={(record) => ({
            onDoubleClick: () => {
              // 导航到详情页
              window.location.href = `/contracts/${record.id}`
            },
          })}
        />
      </Card>

      <Modal
        title={t('contracts.discoverTitle')}
        open={discoverModalOpen}
        onCancel={() => setDiscoverModalOpen(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleDiscover}>
          <Form.Item
            name="backendUrl"
            label={t('contracts.backendUrl')}
            tooltip={t('contracts.backendUrlTooltip')}
          >
            <Input
              placeholder="https://api.example.com"
              prefix={<CloudOutlined />}
            />
          </Form.Item>
          <Form.Item
            name="projectPath"
            label={t('contracts.projectPath')}
            tooltip={t('contracts.projectPathTooltip')}
          >
            <Input
              placeholder="/path/to/project"
              prefix={<FolderOutlined />}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setDiscoverModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t('contracts.discover')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Contracts
