import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  theme,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useMockStore, Mock, HttpMethod } from '@/stores/mockStore'

const { Option } = Select
const { TextArea } = Input

const MockEditor: React.FC = () => {
  const { t } = useTranslation()
  const { mocks, addMock, updateMock, deleteMock, toggleMock } = useMockStore()
  const { token } = theme.useToken()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMock, setEditingMock] = useState<Mock | null>(null)
  const [form] = Form.useForm()

  const handleCreate = () => {
    setEditingMock(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (record: Mock) => {
    setEditingMock(record)
    form.setFieldsValue(record)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: t('mocks.delete'),
      content: 'Are you sure you want to delete this mock?',
      onOk: () => {
        deleteMock(id)
        message.success('Mock deleted')
      },
    })
  }

  const handleDuplicate = (record: Mock) => {
    const newMock: Mock = {
      ...record,
      id: `mock-${Date.now()}`,
      name: `${record.name} (copy)`,
    }
    addMock(newMock)
    message.success('Mock duplicated')
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingMock) {
        updateMock(editingMock.id, values)
        message.success('Mock updated')
      } else {
        const newMock: Mock = {
          ...values,
          id: `mock-${Date.now()}`,
        }
        addMock(newMock)
        message.success('Mock created')
      }
      setIsModalOpen(false)
    })
  }

  const columns = [
    {
      title: t('mocks.name'),
      dataIndex: 'name',
      key: 'name',
    },
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
    },
    {
      title: t('mocks.delay'),
      dataIndex: 'delay',
      key: 'delay',
      width: 80,
      render: (delay: number) => `${delay}ms`,
    },
    {
      title: t('common.enabled'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: Mock) => (
        <Switch
          checked={enabled}
          onChange={() => toggleMock(record.id)}
          size="small"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Mock) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => handleDuplicate(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1>{t('mocks.title')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t('mocks.create')}
        </Button>
      </div>
      <Card>
        {mocks.length > 0 ? (
          <Table
            dataSource={mocks}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: token.colorTextSecondary }}>
            {t('mocks.noMocks')}
          </div>
        )}
      </Card>

      <Modal
        title={editingMock ? t('mocks.edit') : t('mocks.create')}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('mocks.name')}
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Get User List" />
          </Form.Item>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item
              name="method"
              label={t('mocks.method')}
              rules={[{ required: true }]}
              initialValue="GET"
            >
              <Select style={{ width: 120 }}>
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
                <Option value="PATCH">PATCH</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="path"
              label={t('mocks.path')}
              rules={[{ required: true, message: 'Please enter a path' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g., /api/users" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="status" label={t('mocks.status')} initialValue={200}>
              <InputNumber min={100} max={599} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="delay" label={t('mocks.delay')} initialValue={0}>
              <InputNumber min={0} max={30000} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item
            name="response"
            label={t('mocks.response')}
            rules={[{ required: true, message: 'Please enter response body' }]}
          >
            <TextArea
              rows={8}
              placeholder='{"message": "Hello World"}'
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default MockEditor
