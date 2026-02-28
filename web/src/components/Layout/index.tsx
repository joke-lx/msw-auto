import { useState } from 'react'
import { Layout, Menu, Button, Dropdown, theme } from 'antd'
import {
  DashboardOutlined,
  ApiOutlined,
  CodeOutlined,
  SettingOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import ThemeToggle from './ThemeToggle'

const { Header, Sider, Content } = Layout

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { language, setLanguage } = useAppStore()
  const { token } = theme.useToken()

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('nav.dashboard'),
    },
    {
      key: '/explorer',
      icon: <ApiOutlined />,
      label: t('nav.explorer'),
    },
    {
      key: '/mocks',
      icon: <CodeOutlined />,
      label: t('nav.mocks'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('nav.settings'),
    },
    {
      key: '/docs',
      icon: <FileTextOutlined />,
      label: t('nav.documentation'),
    },
  ]

  const languageMenu = {
    items: [
      {
        key: 'en',
        label: 'English',
        onClick: () => {
          i18n.changeLanguage('en')
          setLanguage('en')
        },
      },
      {
        key: 'zh',
        label: '中文',
        onClick: () => {
          i18n.changeLanguage('zh')
          setLanguage('zh')
        },
      },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          {!collapsed && (
            <div style={{ color: token.colorPrimary, fontWeight: 600, fontSize: 18 }}>
              MSW Auto
            </div>
          )}
          {collapsed && (
            <div style={{ color: token.colorPrimary, fontWeight: 700, fontSize: 24 }}>M</div>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown menu={languageMenu} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />}>
                {language === 'zh' ? '中文' : 'English'}
              </Button>
            </Dropdown>
            <ThemeToggle />
          </div>
        </Header>
        <Content
          style={{
            padding: 24,
            minHeight: 280,
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
