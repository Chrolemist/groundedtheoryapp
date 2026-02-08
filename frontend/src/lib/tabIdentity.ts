type TabIdentity = {
  tabId: string
  clientId: string
  instanceId: string
}

const TAB_ID_KEY = 'gt-tab-id'
const CLIENT_ID_KEY = 'gt-client-id'
const CHANNEL_NAME = 'gt-tab-identity'

let cachedIdentity: TabIdentity | null = null
let channel: BroadcastChannel | null = null
let initialized = false
let didReload = false

const isBrowser = () => typeof window !== 'undefined'

const generateId = () => {
  if (!isBrowser()) return 'server'
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

const buildIdentity = () => {
  if (!isBrowser()) {
    return { tabId: 'server', clientId: 'server', instanceId: 'server' }
  }
  const storedTabId = window.sessionStorage.getItem(TAB_ID_KEY)
  const storedClientId = window.sessionStorage.getItem(CLIENT_ID_KEY)
  const tabId = storedTabId || generateId()
  const clientId = storedClientId || generateId()
  const instanceId = generateId()
  window.sessionStorage.setItem(TAB_ID_KEY, tabId)
  window.sessionStorage.setItem(CLIENT_ID_KEY, clientId)
  return { tabId, clientId, instanceId }
}

const shouldYield = (current: string, incoming: string) => current > incoming

const reloadWithNewIdentity = () => {
  if (!isBrowser() || didReload) return
  didReload = true
  const nextTabId = generateId()
  const nextClientId = generateId()
  const nextInstanceId = generateId()
  window.sessionStorage.setItem(TAB_ID_KEY, nextTabId)
  window.sessionStorage.setItem(CLIENT_ID_KEY, nextClientId)
  cachedIdentity = { tabId: nextTabId, clientId: nextClientId, instanceId: nextInstanceId }
  channel?.postMessage({ type: 'announce', tabId: nextTabId, instanceId: nextInstanceId })
  window.location.reload()
}

const handleMessage = (event: MessageEvent) => {
  const data = event.data as { type?: string; tabId?: string; instanceId?: string } | undefined
  if (!data || !cachedIdentity) return
  if (typeof data.tabId !== 'string' || typeof data.instanceId !== 'string') return
  if (data.tabId !== cachedIdentity.tabId) return
  if (data.instanceId === cachedIdentity.instanceId) return
  if (!shouldYield(cachedIdentity.instanceId, data.instanceId)) return
  reloadWithNewIdentity()
}

const initChannel = () => {
  if (!isBrowser() || !('BroadcastChannel' in window)) return
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.addEventListener('message', handleMessage)
  if (cachedIdentity) {
    channel.postMessage({ type: 'hello', tabId: cachedIdentity.tabId, instanceId: cachedIdentity.instanceId })
  }
}

export const getTabIdentity = (): TabIdentity => {
  if (cachedIdentity) return cachedIdentity
  cachedIdentity = buildIdentity()
  if (!initialized) {
    initialized = true
    initChannel()
  }
  return cachedIdentity
}
