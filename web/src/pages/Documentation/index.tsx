import { Card, Table, Button, Tag, Space, message, Modal, Typography, Spin } from 'antd'
import { CopyOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore } from '@/stores/mockStore'
import { useState, useEffect } from 'react'

const { Text } = Typography

const Documentation: React.FC = () => {
  const { t } = useTranslation()
  const { mocks } = useMockStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [previewDoc, setPreviewDoc] = useState<string | null>(null)

  // 从服务器加载 mocks
  useEffect(() => {
    fetch('/api/mocks')
      .then((res) => res.json())
      .then((data) => {
        // 更新 store
        data.forEach((mock: any) => {
          if (!mocks.find((m) => m.id === mock.id)) {
            useMockStore.getState().addMock(mock)
          }
        })
      })
      .catch(console.error)
  }, [])

  // 生成文档
  const handleGenerateDoc = async (mockId: string) => {
    setLoading(mockId)
    try {
      const res = await fetch(`/api/ai/docs/${mockId}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.documentation) {
        setDocs((prev) => ({ ...prev, [mockId]: data.documentation }))
        message.success('文档生成成功')
      }
    } catch (error) {
      console.error(error)
      message.error('文档生成失败')
    } finally {
      setLoading(null)
    }
  }

  // 复制文档
  const handleCopyDoc = async (mockId: string) => {
    const doc = docs[mockId]
    if (!doc) {
      message.warning('请先生成文档')
      return
    }

    try {
      await navigator.clipboard.writeText(doc)
      message.success('已复制到剪贴板')
    } catch (error) {
      console.error(error)
      message.error('复制失败')
    }
  }

  // 预览文档
  const handlePreview = (mockId: string) => {
    const doc = docs[mockId]
    if (doc) {
      setPreviewDoc(doc)
    } else {
      message.warning('请先生成文档')
    }
  }

  const columns = [
    {
      title: t('explorer.method'),
      dataIndex: 'method',
      key: 'method',
      width: 100,
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
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
    },
    {
      title: '文档',
      key: 'documentation',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleGenerateDoc(record.id)}
            loading={loading === record.id}
          >
            {docs[record.id] ? 'Regenerate' : 'Generate'}
          </Button>
          {docs[record.id] && (
            <>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyDoc(record.id)}
              >
                Copy
              </Button>
              <Button
                size="small"
                onClick={() => handlePreview(record.id)}
              >
                Preview
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>{t('documentation.title')}</h1>

      <Card>
        {mocks.length > 0 ? (
          <Table
            dataSource={mocks}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">暂无 Mock 数据，请先创建 Mock</Text>
          </div>
        )}
      </Card>

      {/* 文档预览弹窗 */}
      <Modal
        title="API 文档预览"
        open={!!previewDoc}
        onCancel={() => setPreviewDoc(null)}
        width={800}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => {
            if (previewDoc) {
              navigator.clipboard.writeText(previewDoc)
              message.success('已复制')
            }
          }}>
            复制文档
          </Button>,
          <Button key="close" type="primary" onClick={() => setPreviewDoc(null)}>
            关闭
          </Button>,
        ]}
      >
        <pre style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 4,
          maxHeight: 500,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {previewDoc}
        </pre>
      </Modal>
    </div>
  )
}

export default Documentation
