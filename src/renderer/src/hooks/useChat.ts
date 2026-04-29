import { useEffect } from 'react'
import { useChatStore } from '../store/chat.store'
import { useTopicsStore } from '../store/topics.store'
import type { StreamToken, StreamDone, StreamError } from '../types'

export function useChat(): void {
  const { appendToken, finalizeStream, errorStream } = useChatStore()
  const setActiveConversationId = useTopicsStore((s) => s.setActiveConversationId)

  useEffect(() => {
    const cleanToken = window.api.chat.onToken((payload: StreamToken) => {
      appendToken(payload.requestId, payload.token)
    })
    const cleanDone = window.api.chat.onDone((payload: StreamDone) => {
      finalizeStream(
        payload.requestId,
        payload.messageId,
        payload.sources,
        payload.conversationId,
        setActiveConversationId
      )
    })
    const cleanError = window.api.chat.onError((payload: StreamError) => {
      errorStream(payload.requestId)
    })
    return () => { cleanToken(); cleanDone(); cleanError() }
  }, [appendToken, finalizeStream, errorStream, setActiveConversationId])
}
