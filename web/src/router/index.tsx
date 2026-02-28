import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import Dashboard from './pages/Dashboard'
import APIExplorer from './pages/APIExplorer'
import MockEditor from './pages/MockEditor'
import Settings from './pages/Settings'
import Documentation from './pages/Documentation'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'explorer',
        element: <APIExplorer />,
      },
      {
        path: 'mocks',
        element: <MockEditor />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'docs',
        element: <Documentation />,
      },
    ],
  },
])

export default router
