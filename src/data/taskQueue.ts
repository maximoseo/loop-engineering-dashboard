import type { LoopTaskEvent, LoopTaskHandoff } from '../types.ts'
import { getAccessToken } from '../lib/supabase.ts'

export interface TaskQueueResponse {
  ok: boolean
  tasks: LoopTaskHandoff[]
  events?: LoopTaskEvent[]
  message?: string
}

export async function fetchTaskQueue(taskId?: string): Promise<TaskQueueResponse> {
  const path = taskId ? `/api/loop-task?taskId=${encodeURIComponent(taskId)}` : '/api/loop-task?includeTasks=true'
  const token = await getAccessToken()
  const response = await fetch(path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
  const json = (await response.json()) as TaskQueueResponse
  if (!response.ok || !json.ok) {
    throw new Error(json.message || `Task queue HTTP ${response.status}`)
  }
  return json
}
