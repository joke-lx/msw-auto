/**
 * 前端验证页面
 * 验证前端代码中的 API 调用是否符合 OpenAPI 契约
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Input,
  Table,
  Tag,
  Typography,
  Alert,
  Result,
  Spin,
  Descriptions,
  Statistic,
  Row,
  Col,
  Tabs,
  Tooltip,
  Badge,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  FolderOpenOutlined,
  ApiOutlined,
  FileSearchOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { contractApi } from '@/api/client'
import { useContractStore } from '@/stores/contractStore'
import { useTranslation } from 'react-i18next'

const { Title, Text } = Typography

// ============ 类型定义 ============

interface MatchedCall {
  method: string
  path: string
  normalizedPath: string
  specPath: string
  file: string
  library: string
  line: number
}

interface MissingCall {
  method: string
  path: string
  normalizedPath: string
  file: string
  library: string
  line: number
}

interface MethodMismatchCall {
  method: string
  path: string
  frontendMethod: string
  specMethods: string[]
  file: string
  library: string
  line: number
}

interface FieldMismatchCall {
  method: string
  path: string
  missingFields: string[]
  extraFields: string[]
  file: string
  library: string
  line: number
}

interface UncoveredEndpoint {
  method: string
  path: string
  operationId?: string
}

interface UnknownCall {
  method: string
  rawPath: string
  file: string
  library: string
  line: number
  reason: string
}

interface ValidationSummary {
  total: number
  matched: number
  missing: number
  methodMismatch: number
  fieldMismatch: number
  uncovered: number
  unknown: number
}

interface ValidationMeta {
  filesScanned: number
  duration: number
  detectedLibraries: string[]
}

interface ValidationResponse {
  contractId: string
  status: 'done' | 'error'
  matched: MatchedCall[]
  missing: MissingCall[]
  methodMismatch: MethodMismatchCall[]
  fieldMismatch: FieldMismatchCall[]
  uncovered: UncoveredEndpoint[]
  unknown: UnknownCall[]
  summary: ValidationSummary
  meta: ValidationMeta
  errors: { file: string; message: string }[]
  warnings: { file: string; library: string; message: string }[]
}

// ============ 组件 ============

const ValidationPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const contractId = searchParams.get('contractId')

  const { selectedContract, fetchContractById } = useContractStore()

  const [frontendPath, setFrontendPath] = useState('')
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contractId) {
      fetchContractById(contractId)
    }
  }, [contractId])

  const handleValidate = async () => {
    if (!frontendPath.trim()) {
      setError(t('validation.pathRequired'))
      return
    }

    if (!contractId) {
      setError(t('validation.noContract'))
      return
    }

    setError(null)
    setValidating(true)
    setValidationResult(null)

    try {
      const result = await contractApi.validate(contractId, frontendPath.trim())
      setValidationResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('validation.failed'))
    } finally {
      setValidating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'matched':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'missing':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'methodMismatch':
      case 'fieldMismatch':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'uncovered':
        return <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
      case 'unknown':
        return <QuestionCircleOutlined style={{ color: '#1890ff' }} />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'success'
      case 'missing':
        return 'error'
      case 'methodMismatch':
      case 'fieldMismatch':
        return 'warning'
      case 'uncovered':
        return 'default'
      case 'unknown':
        return 'processing'
      default:
        return 'default'
    }
  }

  // ============ 表格列定义 ============

  const matchedColumns: ColumnsType<MatchedCall> = [
    {
      title: t('validation.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: () => (
        <Tag color="success">{t('validation.matched')}</Tag>
      ),
    },
    {
      title: t('validation.method'),
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: t('validation.path'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: 'Spec Path',
      dataIndex: 'specPath',
      key: 'specPath',
      render: (specPath: string) => (
        <Text type="secondary" code>
          {specPath}
        </Text>
      ),
    },
    {
      title: t('validation.library'),
      dataIndex: 'library',
      key: 'library',
      width: 120,
      render: (lib: string) => <Tag>{lib}</Tag>,
    },
    {
      title: t('validation.file'),
      dataIndex: 'file',
      key: 'file',
      ellipsis: true,
      render: (file: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {file}
        </Text>
      ),
    },
  ]

  const missingColumns: ColumnsType<MissingCall> = [
    {
      title: t('validation.status'),
      key: 'status',
      width: 80,
      render: () => (
        <Tag color="error">{t('validation.missing')}</Tag>
      ),
    },
    {
      title: t('validation.method'),
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: t('validation.path'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: t('validation.library'),
      dataIndex: 'library',
      key: 'library',
      width: 120,
      render: (lib: string) => <Tag>{lib}</Tag>,
    },
    {
      title: t('validation.file'),
      dataIndex: 'file',
      key: 'file',
      ellipsis: true,
      render: (file: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {file}
        </Text>
      ),
    },
  ]

  const methodMismatchColumns: ColumnsType<MethodMismatchCall> = [
    {
      title: t('validation.status'),
      key: 'status',
      width: 120,
      render: () => (
        <Tag color="warning">{t('validation.methodMismatch')}</Tag>
      ),
    },
    {
      title: t('validation.path'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: 'Called',
      dataIndex: 'frontendMethod',
      key: 'frontendMethod',
      width: 80,
      render: (method: string) => <Tag color="orange">{method}</Tag>,
    },
    {
      title: 'Expected',
      dataIndex: 'specMethods',
      key: 'specMethods',
      width: 150,
      render: (methods: string[]) => (
        <Space>
          {methods.map((m) => (
            <Tag key={m}>{m}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('validation.library'),
      dataIndex: 'library',
      key: 'library',
      width: 120,
      render: (lib: string) => <Tag>{lib}</Tag>,
    },
  ]

  const uncoveredColumns: ColumnsType<UncoveredEndpoint> = [
    {
      title: t('validation.status'),
      key: 'status',
      width: 100,
      render: () => (
        <Tag color="default">{t('validation.uncovered')}</Tag>
      ),
    },
    {
      title: t('validation.method'),
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: t('validation.path'),
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: 'OperationId',
      dataIndex: 'operationId',
      key: 'operationId',
      ellipsis: true,
      render: (id?: string) => (
        <Text type="secondary">{id || '-'}</Text>
      ),
    },
  ]

  const unknownColumns: ColumnsType<UnknownCall> = [
    {
      title: t('validation.status'),
      key: 'status',
      width: 100,
      render: () => (
        <Tag color="processing">{t('validation.unknown')}</Tag>
      ),
    },
    {
      title: t('validation.method'),
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: 'Raw Path',
      dataIndex: 'rawPath',
      key: 'rawPath',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => (
        <Tooltip title={reason}>
          <Text type="secondary" style={{ cursor: 'help' }}>
            {reason.substring(0, 50)}
            {reason.length > 50 ? '...' : ''}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t('validation.library'),
      dataIndex: 'library',
      key: 'library',
      width: 120,
      render: (lib: string) => <Tag>{lib}</Tag>,
    },
    {
      title: t('validation.file'),
      dataIndex: 'file',
      key: 'file',
      ellipsis: true,
      render: (file: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {file}
        </Text>
      ),
    },
  ]

  if (!contractId) {
    return (
      <Card>
        <Result
          status="warning"
          title={t('validation.noContract')}
          extra={
            <Button type="primary" onClick={() => navigate('/contracts')}>
              {t('validation.goToContracts')}
            </Button>
          }
        />
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
              onClick={() => navigate(`/contracts/${contractId}`)}
            />
            <Title level={4} style={{ margin: 0 }}>
              {t('validation.title')}
            </Title>
          </Space>
        }
      >
        {selectedContract && (
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t('validation.contractName')}>
              {selectedContract.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('validation.contractId')}>
              <Text code copyable>{contractId}</Text>
            </Descriptions.Item>
          </Descriptions>
        )}

        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Input
              size="large"
              placeholder={t('validation.pathPlaceholder')}
              prefix={<FolderOpenOutlined />}
              value={frontendPath}
              onChange={(e) => setFrontendPath(e.target.value)}
              onPressEnter={handleValidate}
              disabled={validating}
            />
          </div>

          <Space>
            <Button
              type="primary"
              icon={validating ? <LoadingOutlined /> : <PlayCircleOutlined />}
              onClick={handleValidate}
              loading={validating}
              disabled={!frontendPath.trim()}
            >
              {validating ? t('validation.validating') : t('validation.start')}
            </Button>
          </Space>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}
        </Space>
      </Card>

      {validationResult && (
        <>
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginTop: 16, marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('validation.total')}
                  value={validationResult.summary.total}
                  prefix={<ApiOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={t('validation.matched')}
                  value={validationResult.summary.matched}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={t('validation.missing')}
                  value={validationResult.summary.missing}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={t('validation.warnings')}
                  value={validationResult.summary.methodMismatch + validationResult.summary.fieldMismatch}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('validation.uncovered')}
                  value={validationResult.summary.uncovered}
                  prefix={<QuestionCircleOutlined />}
                  valueStyle={{ color: '#8c8c8c' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 元信息 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
              <Text type="secondary">
                <FileSearchOutlined /> {t('validation.filesScanned')}: {validationResult.meta.filesScanned}
              </Text>
              <Text type="secondary">
                {t('validation.duration')}: {validationResult.meta.duration}ms
              </Text>
              <Text type="secondary">
                {t('validation.detectedLibraries')}:
                <Space>
                  {validationResult.meta.detectedLibraries.map((lib) => (
                    <Tag key={lib} icon={<ApiOutlined />}>{lib}</Tag>
                  ))}
                </Space>
              </Text>
            </Space>
          </Card>

          {/* 错误信息 */}
          {validationResult.errors.length > 0 && (
            <Alert
              message={t('validation.errorsTitle')}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      <Text type="danger">{e.file}</Text> — {e.message}
                    </li>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <li>
                      <Text type="secondary">
                        ...{validationResult.errors.length - 5} {t('validation.moreErrors')}
                      </Text>
                    </li>
                  )}
                </ul>
              }
              type="error"
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 警告信息 */}
          {validationResult.warnings.length > 0 && (
            <Alert
              message={t('validation.warningsTitle')}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>
                      <Text type="warning">{w.file}</Text> — [{w.library}] {w.message}
                    </li>
                  ))}
                  {validationResult.warnings.length > 5 && (
                    <li>
                      <Text type="secondary">
                        ...{validationResult.warnings.length - 5} {t('validation.moreWarnings')}
                      </Text>
                    </li>
                  )}
                </ul>
              }
              type="warning"
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 详情表格 */}
          <Card>
            <Tabs
              defaultActiveKey="matched"
              items={[
                {
                  key: 'matched',
                  label: (
                    <span>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      {t('validation.matched')} ({validationResult.matched.length})
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey={(record) => `${record.method}-${record.path}`}
                      columns={matchedColumns}
                      dataSource={validationResult.matched}
                      pagination={{ pageSize: 20 }}
                      size="small"
                      locale={{ emptyText: t('validation.noResults') }}
                    />
                  ),
                },
                {
                  key: 'missing',
                  label: (
                    <span>
                      <Badge status="error" />
                      {t('validation.missing')} ({validationResult.missing.length})
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey={(record) => `${record.method}-${record.path}`}
                      columns={missingColumns}
                      dataSource={validationResult.missing}
                      pagination={{ pageSize: 20 }}
                      size="small"
                      locale={{ emptyText: t('validation.noResults') }}
                    />
                  ),
                },
                {
                  key: 'methodMismatch',
                  label: (
                    <span>
                      <Badge status="warning" />
                      {t('validation.methodMismatch')} ({validationResult.methodMismatch.length})
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey={(record) => `${record.method}-${record.path}`}
                      columns={methodMismatchColumns}
                      dataSource={validationResult.methodMismatch}
                      pagination={{ pageSize: 20 }}
                      size="small"
                      locale={{ emptyText: t('validation.noResults') }}
                    />
                  ),
                },
                {
                  key: 'uncovered',
                  label: (
                    <span>
                      <Badge status="default" />
                      {t('validation.uncovered')} ({validationResult.uncovered.length})
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey={(record) => `${record.method}-${record.path}`}
                      columns={uncoveredColumns}
                      dataSource={validationResult.uncovered}
                      pagination={{ pageSize: 20 }}
                      size="small"
                      locale={{ emptyText: t('validation.noResults') }}
                    />
                  ),
                },
                {
                  key: 'unknown',
                  label: (
                    <span>
                      <Badge status="processing" />
                      {t('validation.unknown')} ({validationResult.unknown.length})
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey={(record) => `${record.method}-${record.rawPath}-${record.line}`}
                      columns={unknownColumns}
                      dataSource={validationResult.unknown}
                      pagination={{ pageSize: 20 }}
                      size="small"
                      locale={{ emptyText: t('validation.noResults') }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default ValidationPage
