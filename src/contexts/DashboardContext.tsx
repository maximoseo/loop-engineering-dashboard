import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { DataHealth, LoopState } from '../types.ts'
import { mockLoopState } from '../data/mockData.ts'
import { emptyDataHealth } from '../data/dataHealth.ts'
import { fetchLoopState } from '../data/liveData.ts'

const POLL_MS = 30_000

interface DashboardContextValue {
  state: LoopState
  health: DataHealth
  live: boolean
  lastUpdated: Date | null
  elapsed: number
  refreshing: boolean
  load: (manual?: boolean) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoopState>(mockLoopState)
  const [health, setHealth] = useState<DataHealth>(() => emptyDataHealth())
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const loadingRef = useRef(false)

  const load = useCallback(async (manual = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (manual) setRefreshing(true)
    try {
      const result = await fetchLoopState()
      setState(result.state)
      setHealth(result.health)
      setLive(result.live)
      setLastUpdated(new Date())
    } catch (error) {
      setLive(false)
      setHealth(emptyDataHealth(error instanceof Error ? error.message : String(error)))
    } finally {
      loadingRef.current = false
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  return (
    <DashboardContext.Provider value={{ state, health, live, lastUpdated, elapsed, refreshing, load }}>
      {children}
    </DashboardContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
