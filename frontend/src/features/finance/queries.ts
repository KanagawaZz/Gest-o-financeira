import { useQuery } from '@tanstack/react-query'
import { accountsApi, categoriesApi } from '@/services/finance'

export const keys = {
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  transactions: ['transactions'] as const,
}

export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: categoriesApi.list })
export const useAccounts = () => useQuery({ queryKey: keys.accounts, queryFn: accountsApi.list })
