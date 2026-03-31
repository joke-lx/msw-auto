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
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { contractApi } from '@/api/client'
import { useContractStore } from '@/stores/contractStore'
import { useTranslation } from 'react-i18next'

const { Title, Text } = Typography

interface VerificationResult {
  method: string
  path: string
  status: 'matched' | 'missing' | 'typeMismatch' | 'methodMismatch'
  detail: string
  file?: string
}

interface ValidationResponse {
  contractId: string
  status: 'done' | 'error'
  results: VerificationResult[]
  summary: {
    total: number
    matched: number
    missing: number
    typeMismatch: number
    methodMismatch: number
  }
  warnings: { file: string; framework: string; message: string }[]
}

const ValidationPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const contractId = searchParams.get('contractId')

  const { selectedContract, fetchContractById } = useContractStore()

  const [frontendPath, setFrontendPath] = useState('')
  const [loading, setLoading] = useState(false)
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
      case 'typeMismatch':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'methodMismatch':
        return <WarningOutlined style={{ color: '#faad14' }} />
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
      case 'typeMismatch':
      case 'methodMismatch':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'matched':
        return t('validation.matched')
      case 'missing':
        return t('validation.missing')
      case 'typeMismatch':
        return t('validation.typeMismatch')
      case 'methodMismatch':
        return t('validation.methodMismatch')
      default:
        return status
    }
  }

  const columns: ColumnsType<VerificationResult> = [
    {
      title: t('validation.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Space>
          {getStatusIcon(status)}
          <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
        </Space>
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
      title: t('validation.detail'),
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: t('validation.file'),
      dataIndex: 'file',
      key: 'file',
      ellipsis: true,
      render: (file: string) =>
        file ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {file}
          </Text>
        ) : (
          '-'
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
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('validation.matched')}
                  value={validationResult.summary.matched}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('validation.missing')}
                  value={validationResult.summary.missing}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('validation.warnings')}
                  value={validationResult.summary.typeMismatch + validationResult.summary.methodMismatch}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {validationResult.warnings.length > 0 && (
            <Alert
              message={t('validation.warningsTitle')}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {validationResult.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>
                      <Text type="secondary">{w.file}</Text> — {w.message}
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

          <Card title={t('validation.results')}>
            <Table
              rowKey={(record) => `${record.method}-${record.path}`}
              columns={columns}
              dataSource={validationResult.results}
              pagination={{ pageSize: 20 }}
              size="small"
              locale={{ emptyText: t('validation.noResults') }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default ValidationPage
