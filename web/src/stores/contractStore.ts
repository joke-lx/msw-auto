/**
 * 契约管理 Store
 * 使用 Zustand 进行状态管理
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Contract, EndpointInfo, MockGenerationResult, TypeGenerationResult, ContractStats } from '@/types/contract'
import { contractApi } from '@/api/client'

interface ContractState {
  contracts: Contract[]
  selectedContract: Contract | null
  loading: boolean
  error: string | null

  // 统计数据
  stats: ContractStats | null

  // 操作方法
  fetchContracts: () => Promise<void>
  fetchContractById: (id: string) => Promise<Contract | null>
  createContract: (data: any) => Promise<Contract>
  deleteContract: (id: string) => Promise<void>
  discoverContracts: (options: { projectPath?: string; backendUrl?: string; port?: number; swaggerPath?: string }) => Promise<Contract[]>
  syncContract: (id: string) => Promise<Contract | null>

  // 选择契约
  selectContract: (contract: Contract | null) => void

  // Mock 生成
  generateMocks: (contractId: string, endpoint?: string, method?: string) => Promise<MockGenerationResult[]>

  // 类型生成
  generateTypes: (contractId: string) => Promise<TypeGenerationResult>

  // 工具方法
  extractEndpoints: (contract: Contract) => EndpointInfo[]
  getStats: () => Promise<void>

  // 清除错误
  clearError: () => void
}

export const useContractStore = create<ContractState>()(
  persist(
    (set, get) => ({
      contracts: [],
      selectedContract: null,
      loading: false,
      error: null,
      stats: null,

      fetchContracts: async () => {
        set({ loading: true, error: null })
        try {
          const contracts = await contractApi.getAll()
          set({ contracts, loading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch contracts',
            loading: false,
          })
        }
      },

      fetchContractById: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const contract = await contractApi.getById(id)
          set({ selectedContract: contract, loading: false })
          return contract
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch contract',
            loading: false,
          })
          return null
        }
      },

      createContract: async (data) => {
        set({ loading: true, error: null })
        try {
          const contract = await contractApi.create(data)
          set((state) => ({
            contracts: [...state.contracts, contract],
            loading: false,
          }))
          return contract
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create contract',
            loading: false,
          })
          throw error
        }
      },

      deleteContract: async (id) => {
        set({ loading: true, error: null })
        try {
          await contractApi.delete(id)
          set((state) => ({
            contracts: state.contracts.filter((c) => c.id !== id),
            selectedContract: state.selectedContract?.id === id ? null : state.selectedContract,
            loading: false,
          }))
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete contract',
            loading: false,
          })
          throw error
        }
      },

      discoverContracts: async (options) => {
        set({ loading: true, error: null })
        try {
          const result = await contractApi.discover(options)
          const contracts = result.contracts || []
          set((state) => ({
            // 合并现有契约和新发现的契约（去重）
            contracts: [
              ...state.contracts.filter((c) => !contracts.find((nc: Contract) => nc.id === c.id)),
              ...contracts,
            ],
            loading: false,
          }))
          return contracts
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to discover contracts',
            loading: false,
          })
          throw error
        }
      },

      syncContract: async (id) => {
        set({ loading: true, error: null })
        try {
          const contract = await contractApi.sync(id)
          set((state) => ({
            contracts: state.contracts.map((c) => (c.id === id ? contract : c)),
            selectedContract: state.selectedContract?.id === id ? contract : state.selectedContract,
            loading: false,
          }))
          return contract
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sync contract',
            loading: false,
          })
          return null
        }
      },

      selectContract: (contract) => {
        set({ selectedContract: contract })
      },

      generateMocks: async (contractId, endpoint, method) => {
        try {
          const result = await contractApi.getMocks(contractId, endpoint, method)
          return result.mocks || []
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to generate mocks')
        }
      },

      generateTypes: async (contractId) => {
        try {
          return await contractApi.getTypes(contractId)
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to generate types')
        }
      },

      extractEndpoints: (contract) => {
        const endpoints: EndpointInfo[] = []
        const paths = contract.spec?.paths || {}

        for (const [path, methods] of Object.entries(paths)) {
          const methodsObj = methods as Record<string, any>
          for (const [method, operation] of Object.entries(methodsObj)) {
            if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
              endpoints.push({
                path,
                method: method.toUpperCase(),
                summary: operation?.summary,
                description: operation?.description,
                operationId: operation?.operationId,
                tags: operation?.tags,
                hasResponse: !!operation?.responses?.['200'],
              })
            }
          }
        }

        return endpoints
      },

      getStats: async () => {
        const state = get()
        const contracts = state.contracts

        let totalEndpoints = 0
        let liveSources = 0
        let fileSources = 0
        let recentlySynced = 0

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

        for (const contract of contracts) {
          const endpoints = state.extractEndpoints(contract)
          totalEndpoints += endpoints.length

          if (contract.sourceType === 'live') liveSources++
          else fileSources++

          if (contract.lastSyncedAt && new Date(contract.lastSyncedAt).getTime() > oneDayAgo) {
            recentlySynced++
          }
        }

        const stats: ContractStats = {
          totalContracts: contracts.length,
          totalEndpoints,
          liveSources,
          fileSources,
          recentlySynced,
        }

        set({ stats })
      },

      clearError: () => {
        set({ error: null })
      },
    }),
    {
      name: 'msw-auto-contract-storage',
      partialize: (state) => ({
        contracts: state.contracts,
        selectedContract: state.selectedContract?.id,
      }),
    }
  )
)
