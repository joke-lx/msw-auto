import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

export interface Mock {
  id: string
  name: string
  method: HttpMethod
  path: string
  response: string
  status: number
  delay: number
  enabled: boolean
  headers?: Record<string, string>
  description?: string
}

export interface RequestLog {
  id: string
  method: string
  path: string
  status: number
  timestamp: number
  duration: number
}

interface MockState {
  mocks: Mock[]
  requestLogs: RequestLog[]
  globalEnabled: boolean
  addMock: (mock: Mock) => void
  updateMock: (id: string, mock: Partial<Mock>) => void
  deleteMock: (id: string) => void
  toggleMock: (id: string) => void
  toggleGlobal: () => void
  setGlobalEnabled: (enabled: boolean) => void
  addRequestLog: (log: RequestLog) => void
  clearRequestLogs: () => void
}

export const useMockStore = create<MockState>()(
  persist(
    (set) => ({
      mocks: [],
      requestLogs: [],
      globalEnabled: true,
      addMock: (mock) => set((state) => ({ mocks: [...state.mocks, mock] })),
      updateMock: (id, updatedMock) =>
        set((state) => ({
          mocks: state.mocks.map((mock) => (mock.id === id ? { ...mock, ...updatedMock } : mock)),
        })),
      deleteMock: (id) => set((state) => ({ mocks: state.mocks.filter((mock) => mock.id !== id) })),
      toggleMock: (id) =>
        set((state) => ({
          mocks: state.mocks.map((mock) => (mock.id === id ? { ...mock, enabled: !mock.enabled } : mock)),
        })),
      toggleGlobal: () => set((state) => ({ globalEnabled: !state.globalEnabled })),
      setGlobalEnabled: (enabled) => set({ globalEnabled: enabled }),
      addRequestLog: (log) =>
        set((state) => ({
          requestLogs: [log, ...state.requestLogs].slice(0, 100),
        })),
      clearRequestLogs: () => set({ requestLogs: [] }),
    }),
    {
      name: 'msw-auto-mock-storage',
    }
  )
)
