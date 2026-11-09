import { useQuery } from '@tanstack/react-query'
import { cardsApi } from '@/services/planning'

export const useCards = () => useQuery({ queryKey: ['cards'], queryFn: cardsApi.list })
