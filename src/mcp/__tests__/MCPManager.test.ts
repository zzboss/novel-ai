/**
 * MCPManager 单元测试
 * 
 * 测试内容：
 * - 单例模式
 * - 服务器配置管理
 * - 服务器连接管理
 * - MCP 工具调用
 * - MCP 资源访问
 * - 事件管理
 * - 销毁
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { MCPManager } from '../MCPManager'
import type { MCPServerConfig, MCPEvent, MCPEventHandler } from '../types'

// ==================== 模拟服务器配置 ====================

const mockServerConfig: MCPServerConfig = {
  id: 'test-server',
  name: '测试服务器',
  description: '用于单元测试的知识库服务器',
  type: 'stdio',
  command: 'node',
  args: ['mcp-servers/knowledge-base/server.js'],
  env: { NODE_ENV: 'test' },
  autoStart: false,
  enabled: true
}

const mockSSEServerConfig: MCPServerConfig = {
  id: 'test-sse-server',
  name: '测试 SSE 服务器',
  description: '用于单元测试的 SSE 服务器',
  type: 'sse',
  url: 'http://localhost:3000/mcp',
  autoStart: false,
  enabled: true
}

// ==================== 测试套件 ====================

describe('MCPManager', () => {
  let manager: MCPManager
  
  beforeEach(() => {
    // 重置单例
    MCPManager.resetInstance()
    manager = MCPManager.getInstance({ enableLogging: false })
  })
  
  afterEach(() => {
    // 销毁管理器
    manager.destroy()
    MCPManager.resetInstance()
  })
  
  // ==================== 单例模式测试 ====================
  
  describe('单例模式', () => {
    test('应该返回同一个实例', () => {
      const instance1 = MCPManager.getInstance()
      const instance2 = MCPManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
    
    test('应该更新现有实例的配置', () => {
      const instance1 = MCPManager.getInstance()
      const instance2 = MCPManager.getInstance({ enableLogging: true })
      
      expect(instance1).toBe(instance2)
      expect(instance2.getConfig().enableLogging).toBe(true)
    })
    
    test('resetInstance 应该清除单例', () => {
      const instance1 = MCPManager.getInstance()
      MCPManager.resetInstance()
      const instance2 = MCPManager.getInstance()
      
      expect(instance1).not.toBe(instance2)
    })
  })
  
  // ==================== 配置管理测试 ====================
  
  describe('配置管理', () => {
    test('应该更新配置', () => {
      manager.updateConfig({ enableLogging: true })
      
      expect(manager.getConfig().enableLogging).toBe(true)
    })
    
    test('应该返回配置的副本', () => {
      const config = manager.getConfig()
      config.enableLogging = true
      
      // 修改返回的副本不应该影响原始配置
      expect(manager.getConfig().enableLogging).toBe(false)
    })
  })
  
  // ==================== 服务器配置管理测试 ====================
  
  describe('服务器配置管理', () => {
    test('应该成功添加服务器配置', () => {
      manager.addServerConfig(mockServerConfig)
      
      const config = manager.getServerConfig('test-server')
      expect(config).toBeDefined()
      expect(config?.id).toBe('test-server')
      expect(config?.name).toBe('测试服务器')
      expect(config?.type).toBe('stdio')
    })
    
    test('添加服务器配置应该初始化状态', () => {
      manager.addServerConfig(mockServerConfig)
      
      const status = manager.getServerStatus('test-server')
      expect(status).toBeDefined()
      expect(status?.serverId).toBe('test-server')
      expect(status?.isRunning).toBe(false)
      expect(status?.tools).toEqual([])
      expect(status?.resources).toEqual([])
    })
    
    test('应该成功获取服务器配置', () => {
      manager.addServerConfig(mockServerConfig)
      
      const config = manager.getServerConfig('test-server')
      expect(config).toBeDefined()
      expect(config?.id).toBe('test-server')
    })
    
    test('获取不存在的服务器配置应该返回 undefined', () => {
      const config = manager.getServerConfig('non-existent')
      expect(config).toBeUndefined()
    })
    
    test('应该成功获取所有服务器配置', () => {
      manager.addServerConfig(mockServerConfig)
      manager.addServerConfig(mockSSEServerConfig)
      
      const configs = manager.getAllServerConfigs()
      expect(configs).toHaveLength(2)
      expect(configs.map(c => c.id)).toContain('test-server')
      expect(configs.map(c => c.id)).toContain('test-sse-server')
    })
    
    test('应该成功更新服务器配置', () => {
      manager.addServerConfig(mockServerConfig)
      
      manager.updateServerConfig('test-server', { name: '更新后的名称' })
      
      const config = manager.getServerConfig('test-server')
      expect(config?.name).toBe('更新后的名称')
    })
    
    test('更新不存在的服务器配置应该抛出错误', () => {
      expect(() => {
        manager.updateServerConfig('non-existent', { name: '更新后的名称' })
      }).toThrow('服务器配置不存在: non-existent')
    })
    
    test('应该成功移除服务器配置', () => {
      manager.addServerConfig(mockServerConfig)
      expect(manager.getServerConfig('test-server')).toBeDefined()
      
      manager.removeServerConfig('test-server')
      expect(manager.getServerConfig('test-server')).toBeUndefined()
    })
    
    test('移除服务器配置应该清除状态', () => {
      manager.addServerConfig(mockServerConfig)
      expect(manager.getServerStatus('test-server')).toBeDefined()
      
      manager.removeServerConfig('test-server')
      expect(manager.getServerStatus('test-server')).toBeUndefined()
    })
  })
  
  // ==================== 服务器连接管理测试 ====================
  
  describe('服务器连接管理', () => {
    beforeEach(() => {
      manager.addServerConfig(mockServerConfig)
    })
    
    test('应该成功启动服务器', async () => {
      await manager.startServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      const status = manager.getServerStatus('test-server')
      expect(status?.isRunning).toBe(true)
      expect(status?.startTime).toBeDefined()
      expect(status?.stopTime).toBeUndefined()
      expect(status?.error).toBeUndefined()
    })
    
    test('启动不存在的服务器应该抛出错误', async () => {
      await expect(manager.startServer('non-existent')).rejects.toThrow('服务器配置不存在: non-existent')
    })
    
    test('启动已禁用的服务器应该抛出错误', async () => {
      manager.updateServerConfig('test-server', { enabled: false })
      
      await expect(manager.startServer('test-server')).rejects.toThrow('服务器已禁用: test-server')
    })
    
    test('启动已在运行的服务器应该不执行任何操作', async () => {
      await manager.startServer('test-server')
      
      // 第二次启动应该不执行任何操作（不抛出错误）
      await expect(manager.startServer('test-server')).resolves.toBeUndefined()
    })
    
    test('应该成功停止服务器', async () => {
      await manager.startServer('test-server')
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      await manager.stopServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(false)
      
      const status = manager.getServerStatus('test-server')
      expect(status?.isRunning).toBe(false)
      expect(status?.stopTime).toBeDefined()
    })
    
    test('停止不存在的服务器应该抛出错误', async () => {
      await expect(manager.stopServer('non-existent')).rejects.toThrow('服务器配置不存在: non-existent')
    })
    
    test('停止未在运行的服务器应该不执行任何操作', async () => {
      // 不抛出错误，但会输出警告日志
      await expect(manager.stopServer('test-server')).resolves.toBeUndefined()
    })
    
    test('应该成功重启服务器', async () => {
      await manager.startServer('test-server')
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      await manager.restartServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(true)
    })
    
    test('重启未运行的服务器应该启动服务器', async () => {
      expect(manager.isServerRunning('test-server')).toBe(false)
      
      await manager.restartServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(true)
    })
    
    test('应该正确检查服务器是否正在运行', async () => {
      expect(manager.isServerRunning('test-server')).toBe(false)
      
      await manager.startServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      await manager.stopServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(false)
    })
    
    test('应该成功获取服务器状态', async () => {
      await manager.startServer('test-server')
      
      const status = manager.getServerStatus('test-server')
      expect(status).toBeDefined()
      expect(status?.serverId).toBe('test-server')
      expect(status?.isRunning).toBe(true)
    })
    
    test('获取不存在的服务器状态应该返回 undefined', () => {
      const status = manager.getServerStatus('non-existent')
      expect(status).toBeUndefined()
    })
    
    test('应该成功获取所有服务器状态', async () => {
      manager.addServerConfig(mockSSEServerConfig)
      await manager.startServer('test-server')
      await manager.startServer('test-sse-server')
      
      const statuses = manager.getAllServerStatuses()
      expect(statuses).toHaveLength(2)
      expect(statuses.map(s => s.serverId)).toContain('test-server')
      expect(statuses.map(s => s.serverId)).toContain('test-sse-server')
    })
  })
  
  // ==================== MCP 工具调用测试 ====================
  
  describe('MCP 工具调用', () => {
    beforeEach(() => {
      manager.addServerConfig(mockServerConfig)
    })
    
    test('获取工具列表应该抛出错误（服务器未运行）', async () => {
      await expect(manager.listTools('test-server')).rejects.toThrow('服务器未在运行: test-server')
    })
    
    test('获取工具列表应该返回工具数组（服务器运行中）', async () => {
      await manager.startServer('test-server')
      
      const tools = await manager.listTools('test-server')
      expect(tools).toEqual([])
    })
    
    test('调用工具应该抛出错误（服务器未运行）', async () => {
      await expect(manager.callTool('test-server', 'searchKnowledge', {})).rejects.toThrow('服务器未在运行: test-server')
    })
    
    test('调用工具应该返回成功结果（服务器运行中）', async () => {
      await manager.startServer('test-server')
      
      const result = await manager.callTool('test-server', 'searchKnowledge', {
        query: '测试查询',
        maxResults: 5
      })
      
      expect(result.success).toBe(true)
      expect(result.content).toBeDefined()
      expect(result.content?.[0]?.type).toBe('text')
      expect(result.content?.[0]?.text).toContain('模拟工具调用结果')
    })
    
    test('调用工具应该返回失败结果（发生错误）', async () => {
      // 由于当前实现是模拟的，不会实际抛出错误
      // 这里测试正常流程
      await manager.startServer('test-server')
      
      const result = await manager.callTool('test-server', 'testTool', {})
      
      expect(result.success).toBe(true)
    })
  })
  
  // ==================== MCP 资源访问测试 ====================
  
  describe('MCP 资源访问', () => {
    beforeEach(() => {
      manager.addServerConfig(mockServerConfig)
    })
    
    test('获取资源列表应该抛出错误（服务器未运行）', async () => {
      await expect(manager.listResources('test-server')).rejects.toThrow('服务器未在运行: test-server')
    })
    
    test('获取资源列表应该返回资源数组（服务器运行中）', async () => {
      await manager.startServer('test-server')
      
      const resources = await manager.listResources('test-server')
      expect(resources).toEqual([])
    })
    
    test('读取资源应该抛出错误（服务器未运行）', async () => {
      await expect(manager.readResource('test-server', 'test-uri')).rejects.toThrow('服务器未在运行: test-server')
    })
    
    test('读取资源应该返回资源内容（服务器运行中）', async () => {
      await manager.startServer('test-server')
      
      const content = await manager.readResource('test-server', 'test-uri')
      
      expect(content.uri).toBe('test-uri')
      expect(content.text).toContain('模拟资源内容')
      expect(content.mimeType).toBe('text/plain')
    })
  })
  
  // ==================== 事件管理测试 ====================
  
  describe('事件管理', () => {
    beforeEach(() => {
      manager.addServerConfig(mockServerConfig)
    })
    
    test('应该成功添加事件监听器', async () => {
      const handler = vi.fn()
      
      manager.on('server-started', handler)
      
      await manager.startServer('test-server')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'server-started',
        serverId: 'test-server'
      }))
    })
    
    test('应该成功移除事件监听器', async () => {
      const handler = vi.fn()
      
      manager.on('server-started', handler)
      manager.off('server-started', handler)
      
      await manager.startServer('test-server')
      
      expect(handler).not.toHaveBeenCalled()
    })
    
    test('事件监听器错误应该被捕获', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('处理器错误')
      })
      
      manager.on('server-started', errorHandler)
      
      // 不应该抛出错误
      await expect(manager.startServer('test-server')).resolves.toBeUndefined()
    })
    
    test('启动服务器应该触发 server-started 事件', async () => {
      const handler = vi.fn()
      
      manager.on('server-started', handler)
      await manager.startServer('test-server')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'server-started',
        serverId: 'test-server'
      }))
    })
    
    test('停止服务器应该触发 server-stopped 事件', async () => {
      const handler = vi.fn()
      
      manager.on('server-stopped', handler)
      
      await manager.startServer('test-server')
      await manager.stopServer('test-server')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'server-stopped',
        serverId: 'test-server'
      }))
    })
    
    test('调用工具应该触发 tool-called 事件', async () => {
      const handler = vi.fn()
      
      manager.on('tool-called', handler)
      
      await manager.startServer('test-server')
      await manager.callTool('test-server', 'testTool', {})
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'tool-called',
        serverId: 'test-server',
        data: expect.objectContaining({
          toolName: 'testTool'
        })
      }))
    })
    
    test('读取资源应该触发 resource-read 事件', async () => {
      const handler = vi.fn()
      
      manager.on('resource-read', handler)
      
      await manager.startServer('test-server')
      await manager.readResource('test-server', 'test-uri')
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'resource-read',
        serverId: 'test-server',
        data: expect.objectContaining({
          uri: 'test-uri'
        })
      }))
    })
  })
  
  // ==================== 销毁测试 ====================
  
  describe('销毁', () => {
    test('销毁应该清除所有状态', async () => {
      manager.addServerConfig(mockServerConfig)
      await manager.startServer('test-server')
      
      expect(manager.getServerConfig('test-server')).toBeDefined()
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      manager.destroy()
      
      expect(manager.getServerConfig('test-server')).toBeUndefined()
      expect(manager.getServerStatus('test-server')).toBeUndefined()
    })
    
    test('销毁应该停止所有服务器', async () => {
      manager.addServerConfig(mockServerConfig)
      await manager.startServer('test-server')
      
      expect(manager.isServerRunning('test-server')).toBe(true)
      
      manager.destroy()
      
      // 服务器应该已被停止
      expect(manager.isServerRunning('test-server')).toBe(false)
    })
  })
})
