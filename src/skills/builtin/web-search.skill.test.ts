import { describe, it, expect, vi } from 'vitest'
import { execute } from './web-search.skill'

describe('web-search.skill', () => {
  it('应该成功执行搜索', async () => {
    // 模拟 LLM 客户端
    const mockLLMClient = {
      generateText: vi.fn().mockResolvedValue('模拟搜索结果：AIWT 是一款写作助手...')
    }

    const result = await execute({
      query: 'AIWT 写作助手',
      count: 5,
      llmClient: mockLLMClient
    })

    expect(result).toContain('模拟搜索结果')
    expect(mockLLMClient.generateText).toHaveBeenCalledTimes(1)
  })

  it('应该返回错误当 LLM 客户端不存在时', async () => {
    const result = await execute({
      query: 'test'
    })

    expect(result).toContain('错误')
  })
})
