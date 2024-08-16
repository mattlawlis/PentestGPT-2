import Loading from "@/app/[locale]/loading"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { PentestGPTContext } from "@/context/context"
import { getChatFilesByChatId } from "@/db/chat-files"
import { getChatById } from "@/db/chats"
import { getMessagesByChatId } from "@/db/messages"
import { getMessageImageFromStorage } from "@/db/storage/message-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, MessageImage } from "@/types"
import { IconPlayerTrackNext } from "@tabler/icons-react"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import { Button } from "../ui/button"
import { ChatHelp } from "./chat-help"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import { ChatSecondaryButtons } from "./chat-secondary-buttons"
import { ChatSettings } from "./chat-settings"

interface ChatUIProps {}

export const ChatUI: FC<ChatUIProps> = ({}) => {
  useHotkey("o", () => handleNewChat())

  const params = useParams()
  const router = useRouter()

  const {
    setChatMessages,
    chatMessages,
    selectedChat,
    setSelectedChat,
    setChatSettings,
    setChatImages,
    isGenerating,
    setChatFiles,
    setShowFilesDisplay,
    setUseRetrieval,
    setIsReadyToChat,
    showSidebar
  } = useContext(PentestGPTContext)

  const { handleNewChat, handleFocusChatInput, handleSendContinuation } =
    useChatHandler()

  const {
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom,
    isAtBottom,
    isOverflowing
  } = useScroll()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchMessages(), fetchChat()])

      scrollToBottom(true)
      setIsAtBottom(true)
    }

    if ((chatMessages?.length === 0 && !params.chatid) || params.chatid) {
      setIsReadyToChat(false)
      fetchData().then(() => {
        handleFocusChatInput()
        setLoading(false)
        setIsReadyToChat(true)
      })
    } else {
      setLoading(false)
      setIsReadyToChat(true)
    }
  }, [])

  const fetchMessages = async () => {
    const fetchedMessages = await getMessagesByChatId(params.chatid as string)

    const imagePromises: Promise<MessageImage>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
              const url = await getMessageImageFromStorage(imagePath)

              if (url) {
                const response = await fetch(url)
                const blob = await response.blob()
                const base64 = await convertBlobToBase64(blob)

                return {
                  messageId: message.id,
                  path: imagePath,
                  base64,
                  url,
                  file: null
                }
              }

              return {
                messageId: message.id,
                path: imagePath,
                base64: "",
                url,
                file: null
              }
            })
          : []
    )

    const images: MessageImage[] = await Promise.all(imagePromises.flat())
    setChatImages(images)

    const chatFiles = await getChatFilesByChatId(params.chatid as string)

    if (!chatFiles) {
      // Chat not found, redirect to the workspace chat page
      const workspaceId = params.workspaceid as string
      router.push(`/${workspaceId}/chat`)
      return
    }

    setChatFiles(
      chatFiles.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        file: null
      }))
    )

    setUseRetrieval(chatFiles.files.length > 0)
    setShowFilesDisplay(chatFiles.files.length > 0)

    const reformatedMessages = fetchedMessages.map(fetchMessage => ({
      message: fetchMessage,
      fileItems: fetchMessage.file_items,
      feedback: fetchMessage.feedback[0] ?? undefined
    }))

    setChatMessages(reformatedMessages)
  }

  const fetchChat = async () => {
    try {
      const chat = await getChatById(params.chatid as string)
      if (!chat) {
        // Chat not found, redirect to the workspace chat page
        const workspaceId = params.workspaceid as string
        router.push(`/${workspaceId}/chat`)
        return
      }

      setSelectedChat(chat)
      setChatSettings({
        model: chat.model as LLMID,
        contextLength: chat.context_length,
        includeProfileContext: chat.include_profile_context,
        embeddingsProvider: chat.embeddings_provider as "openai" | "local"
      })
    } catch (error) {
      console.error("Error fetching chat:", error)
      // Handle the error, e.g., show an error message to the user
      // and redirect to the workspace chat page
      const workspaceId = params.workspaceid as string
      router.push(`/${workspaceId}/chat`)
    }
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="relative flex h-full flex-col items-center">
      <div className="absolute right-[22px] top-1 flex h-[40px] items-center space-x-2">
        <ChatSecondaryButtons />
      </div>

      <div
        className={`flex max-h-[50px] min-h-[50px] w-full items-center justify-center font-bold sm:justify-start ${showSidebar ? "sm:pl-2" : "sm:pl-12"}`}
      >
        <div className="mt-2 max-w-[200px] truncate text-sm sm:max-w-[400px] sm:text-base md:max-w-[500px] lg:max-w-[600px] xl:w-[800px]">
          <ChatSettings />
        </div>
      </div>

      <div
        className="flex size-full flex-col overflow-auto"
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />

        <ChatMessages />

        <div ref={messagesEndRef} />
      </div>

      <div
        className={`relative w-screen min-w-[300px] items-end px-2 pb-3 sm:w-[600px] sm:pb-8 md:w-[650px] md:min-w-[300px] xl:w-[800px] ${
          showSidebar ? "lg:w-[650px]" : "lg:w-[700px]"
        }`}
      >
        <div className="absolute -top-10 left-1/2 flex -translate-x-1/2 justify-center">
          <ChatScrollButtons
            isAtBottom={isAtBottom}
            isOverflowing={isOverflowing}
            scrollToBottom={scrollToBottom}
          />
        </div>

        {!isGenerating && selectedChat?.finish_reason === "length" && (
          <div className="flex w-full justify-center p-2">
            <Button
              onClick={handleSendContinuation}
              variant="secondary"
              className="flex items-center space-x-1 px-4 py-2"
            >
              <IconPlayerTrackNext size={16} />
              <span>Continue generating</span>
            </Button>
          </div>
        )}

        <ChatInput />
      </div>

      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
