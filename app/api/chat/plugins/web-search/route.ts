import { getAIProfile } from "@/lib/server/server-chat-helpers"
import { ServerRuntime } from "next"

import { updateOrAddSystemMessage } from "@/lib/ai-helper"
import llmConfig from "@/lib/models/llm/llm-config"
import { checkRatelimitOnApi } from "@/lib/server/ratelimiter"
import {
  filterEmptyAssistantMessages,
  handleAssistantMessages
} from "@/lib/build-prompt"
import { GPT4o } from "@/lib/models/llm/openai-llm-list"
import { PGPT4 } from "@/lib/models/llm/hackerai-llm-list"
import { createOpenAI as createOpenRouterClient } from "@ai-sdk/openai"
import { streamText } from "ai"
import { toVercelChatMessages } from "@/lib/build-prompt"

export const runtime: ServerRuntime = "edge"
export const preferredRegion = [
  "iad1",
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hnd1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1"
]

export async function POST(request: Request) {
  const { messages, chatSettings, detectedModerationLevel } =
    await request.json()

  try {
    const profile = await getAIProfile()

    let { providerHeaders, selectedModel, rateLimitCheckResult } =
      await getProviderConfig(chatSettings, profile)

    if (rateLimitCheckResult !== null) {
      return rateLimitCheckResult.response
    }

    updateOrAddSystemMessage(
      messages,
      llmConfig.systemPrompts.pentestGPTWebSearch
    )

    if (
      detectedModerationLevel === 1 ||
      (detectedModerationLevel >= 0.0 && detectedModerationLevel <= 0.1) ||
      (detectedModerationLevel >= 0.8 && detectedModerationLevel < 1)
    ) {
      filterEmptyAssistantMessages(messages)
    } else if (detectedModerationLevel > 0.3 && detectedModerationLevel < 0.8) {
      handleAssistantMessages(messages)
    } else {
      filterEmptyAssistantMessages(messages)
    }

    const openrouter = createOpenRouterClient({
      baseUrl: llmConfig.openrouter.baseUrl,
      apiKey: llmConfig.openrouter.apiKey,
      headers: providerHeaders
    })

    const result = await streamText({
      model: openrouter(selectedModel),
      messages: toVercelChatMessages(messages),
      temperature: 0.4,
      maxTokens: 1024,
      // abortSignal isn't working for some reason.
      abortSignal: request.signal
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error("Error in web search endpoint:", error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}

async function getProviderConfig(chatSettings: any, profile: any) {
  const isProModel =
    chatSettings.model === PGPT4.modelId || chatSettings.model === GPT4o.modelId

  const defaultModel = "perplexity/llama-3.1-sonar-small-128k-online"
  const proModel = "perplexity/llama-3.1-sonar-large-128k-online"

  const providerHeaders = {
    "HTTP-Referer": "https://pentestgpt.com/web-search",
    "X-Title": "web-search"
  }

  let selectedModel = isProModel ? proModel : defaultModel

  let rateLimitIdentifier
  if (chatSettings.model === GPT4o.modelId) {
    rateLimitIdentifier = "gpt-4"
  } else if (chatSettings.model === PGPT4.modelId) {
    rateLimitIdentifier = "pentestgpt-pro"
  } else {
    rateLimitIdentifier = "pentestgpt"
  }

  let rateLimitCheckResult = await checkRatelimitOnApi(
    profile.user_id,
    rateLimitIdentifier
  )

  return {
    providerHeaders,
    selectedModel,
    rateLimitCheckResult,
    isProModel
  }
}
