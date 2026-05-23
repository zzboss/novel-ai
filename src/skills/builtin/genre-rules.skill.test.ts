import { describe, it, expect, vi } from 'vitest'
import { execute } from './genre-rules.skill'

describe('genre-rules.skill', () => {
  it('应该成功执行并返回类型规则', async () => {
    // 模拟 LLM 客户端
    const mockLLMClient = {
      generateText: vi.fn().mockResolvedValue('个性化建议：...')
    }

    const result = await execute({
      genre: '玄幻',
      context: '测试上下文',
      llmClient: mockLLMClient
    })

    expect(result).toContain('玄幻类型写作规则')
    expect(result).toContain('关键元素')
    expect(result).toContain('常见情节模板')
    expect(result).toContain('写作技巧')
  })

  it('应该返回错误当 LLM 客户端不存在时', async () => {
    const result = await execute({
      genre: '都市'
    })

    expect(result).toContain('错误')
    expect(result).toContain('无法访问 LLM 客户端')
  })

  it('应该处理未知类型', async () => {
    const result = await execute({
      genre: '未知类型',
      llmClient: {
        generateText: vi.fn().mockResolvedValue('建议：...')
      }
    })

    expect(result).toContain('未找到类型')
  })
})
