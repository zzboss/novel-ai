<template>
  <div class="mcp-manager-panel">
    <!-- 面板标题栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="header-icon">🔌</span>
        <h3 class="panel-title">MCP 服务管理</h3>
        <el-tag size="small" type="info" effect="plain">{{ servers.length }} 个服务</el-tag>
      </div>
      <el-button text @click="$emit('close')" class="close-btn">
        ✕
      </el-button>
    </div>

    <!-- MCP 服务器列表 -->
    <div class="server-section">
      <div class="section-header">
        <h4 class="section-title">
          🖥️ 服务列表
        </h4>
        <el-button type="primary" size="small" @click="handleAddServer">
          ➕ 添加服务
        </el-button>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="servers.length === 0" description="暂无 MCP 服务" :image-size="80">
        <el-button type="primary" @click="handleAddServer">添加第一个服务</el-button>
      </el-empty>

      <!-- 服务器卡片列表 -->
      <div v-else class="server-cards">
        <div 
          v-for="server in servers" 
          :key="server.id"
          class="server-card"
          :class="{ 'is-running': server.isRunning }"
        >
          <!-- 服务器状态指示器 -->
          <div class="status-indicator" :class="{ 'status-active': server.isRunning }">
            <div class="pulse-ring" v-if="server.isRunning"></div>
          </div>

          <div class="server-content">
            <div class="server-header">
              <div class="server-name">
                🖥️ <span>{{ server.name }}</span>
              </div>
              <el-tag 
                :type="server.isRunning ? 'success' : 'info'" 
                size="small" 
                effect="dark"
                round
              >
                {{ server.isRunning ? '运行中' : '已停止' }}
              </el-tag>
            </div>

            <div class="server-id">
              <el-text size="small" type="info">{{ server.id }}</el-text>
            </div>

            <!-- 操作按钮 -->
            <div class="server-actions">
              <el-button 
                v-if="!server.isRunning"
                type="success" 
                size="small"
                @click="handleStartServer(server.id)"
                plain
              >
                ▶ 启动
              </el-button>
              <el-button 
                v-else
                type="danger" 
                size="small"
                @click="handleStopServer(server.id)"
                plain
              >
                ⏸ 停止
              </el-button>
              <el-button 
                size="small"
                @click="handleRestartServer(server.id)"
                plain
              >
                🔄 重启
              </el-button>
              <el-button 
                size="small"
                type="danger"
                @click="handleRemoveServer(server.id)"
                plain
              >
                🗑️ 移除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MCP 工具列表 -->
    <div class="tool-section">
      <div class="section-header">
        <h4 class="section-title">
          🔧 可用工具
          <el-tag size="small" type="warning" effect="plain">{{ tools.length }}</el-tag>
        </h4>
      </div>

      <el-empty v-if="tools.length === 0" description="暂无可用工具" :image-size="60" />

      <div v-else class="tool-cards">
        <div 
          v-for="tool in tools" 
          :key="tool.name"
          class="tool-card"
        >
          <div class="tool-icon">
            🔧
          </div>
          <div class="tool-info">
            <div class="tool-name">{{ tool.name }}</div>
            <div class="tool-description">{{ tool.description }}</div>
          </div>
          <el-button text size="small" type="primary">
            ⏩
          </el-button>
        </div>
      </div>
    </div>

    <!-- MCP 资源列表 -->
    <div class="resource-section">
      <div class="section-header">
        <h4 class="section-title">
          📂 可用资源
          <el-tag size="small" type="success" effect="plain">{{ resources.length }}</el-tag>
        </h4>
      </div>

      <el-empty v-if="resources.length === 0" description="暂无可用资源" :image-size="60" />

      <div v-else class="resource-cards">
        <div 
          v-for="resource in resources" 
          :key="resource.uri"
          class="resource-card"
        >
          <div class="resource-icon">
            📄
          </div>
          <div class="resource-info">
            <div class="resource-name">{{ resource.name }}</div>
            <div class="resource-description">{{ resource.description }}</div>
            <el-text size="small" type="info" class="resource-uri">{{ resource.uri }}</el-text>
          </div>
          <el-button 
            type="primary" 
            size="small" 
            @click="handleReadResource(resource.uri)"
            plain
          >
            读取
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 定义事件
defineEmits<{
  (e: 'close'): void
}>()

// 本地状态
const servers = ref<Array<{
  id: string
  name: string
  isRunning: boolean
}>>([])

const tools = ref<Array<{
  name: string
  description: string
}>>([])

const resources = ref<Array<{
  uri: string
  name: string
  description: string
}>>([])

// 生命周期
onMounted(() => {
  loadServers()
})

// 方法
async function loadServers(): Promise<void> {
  try {
    // TODO: 实际实现需要从 MCPManager 获取服务器列表
    // 暂时使用模拟数据
    servers.value = [
      {
        id: 'knowledge-base',
        name: '知识库服务器',
        isRunning: false
      },
      {
        id: 'research-tools',
        name: '研究工具服务器',
        isRunning: true
      }
    ]
  } catch (error) {
    console.error('加载 MCP 服务器列表失败:', error)
    ElMessage.error('加载服务器列表失败')
  }
}

async function handleAddServer(): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入服务器名称', '添加 MCP 服务器', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如: 我的知识库',
      inputValidator: (value: string) => {
        if (!value.trim()) {
          return '服务器名称不能为空'
        }
        return true
      }
    })
    
    console.log('添加 MCP 服务器:', value)
    ElMessage.success(`服务器 "${value}" 添加成功`)
    
    // TODO: 实际实现需要调用 MCPManager.addServerConfig()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('添加服务器失败:', error)
    }
  }
}

async function handleStartServer(serverId: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.startServer()
    console.log('启动 MCP 服务器:', serverId)
    
    // 更新本地状态
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.isRunning = true
      
      // 加载工具和资源
      await loadTools(serverId)
      await loadResources(serverId)
      
      ElMessage.success(`服务器 "${server.name}" 已启动`)
    }
  } catch (error) {
    console.error('启动 MCP 服务器失败:', error)
    ElMessage.error('启动服务器失败')
  }
}

async function handleStopServer(serverId: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.stopServer()
    console.log('停止 MCP 服务器:', serverId)
    
    // 更新本地状态
    const server = servers.value.find(s => s.id === serverId)
    if (server) {
      server.isRunning = false
      
      // 清空工具和资源
      tools.value = []
      resources.value = []
      
      ElMessage.info(`服务器 "${server.name}" 已停止`)
    }
  } catch (error) {
    console.error('停止 MCP 服务器失败:', error)
    ElMessage.error('停止服务器失败')
  }
}

async function handleRestartServer(serverId: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.restartServer()
    console.log('重启 MCP 服务器:', serverId)
    
    await handleStopServer(serverId)
    await new Promise(resolve => setTimeout(resolve, 500)) // 短暂延迟
    await handleStartServer(serverId)
    
    ElMessage.success('服务器重启成功')
  } catch (error) {
    console.error('重启 MCP 服务器失败:', error)
    ElMessage.error('重启服务器失败')
  }
}

async function handleRemoveServer(serverId: string): Promise<void> {
  try {
    const server = servers.value.find(s => s.id === serverId)
    const serverName = server?.name || serverId
    
    await ElMessageBox.confirm(
      `确定要移除服务器 "${serverName}" 吗？此操作不可恢复。`,
      '确认移除',
      {
        confirmButtonText: '确定移除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // TODO: 实际实现需要调用 MCPManager.removeServerConfig()
    console.log('移除 MCP 服务器:', serverId)
    
    // 更新本地状态
    servers.value = servers.value.filter(s => s.id !== serverId)
    
    ElMessage.success('服务器已移除')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('移除 MCP 服务器失败:', error)
      ElMessage.error('移除服务器失败')
    }
  }
}

async function loadTools(serverId: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.listTools()
    // 暂时使用模拟数据
    tools.value = [
      {
        name: 'searchKnowledge',
        description: '搜索知识库（集成 Chroma 向量检索）'
      },
      {
        name: 'getDocument',
        description: '获取文档内容'
      }
    ]
  } catch (error) {
    console.error('加载 MCP 工具列表失败:', error)
  }
}

async function loadResources(serverId: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.listResources()
    // 暂时使用模拟数据
    resources.value = [
      {
        uri: 'knowledge://all',
        name: '所有知识库文档',
        description: '访问所有知识库文档'
      }
    ]
  } catch (error) {
    console.error('加载 MCP 资源列表失败:', error)
  }
}

async function handleReadResource(uri: string): Promise<void> {
  try {
    // TODO: 实际实现需要调用 MCPManager.readResource()
    console.log('读取 MCP 资源:', uri)
    ElMessage.info(`正在读取资源: ${uri}`)
  } catch (error) {
    console.error('读取 MCP 资源失败:', error)
    ElMessage.error('读取资源失败')
  }
}
</script>

<style scoped>
.mcp-manager-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(to bottom, var(--el-bg-color-page), var(--el-fill-color-light));
  overflow-y: auto;
}

/* 自定义滚动条 */
.mcp-manager-panel::-webkit-scrollbar {
  width: 6px;
}

.mcp-manager-panel::-webkit-scrollbar-thumb {
  background-color: var(--el-border-color-darker);
  border-radius: 3px;
}

.mcp-manager-panel::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 面板标题栏 */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color));
  border-bottom: 1px solid var(--el-border-color-light);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: var(--el-color-primary);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.close-btn {
  border-radius: 8px;
  transition: all 0.3s;
}

.close-btn:hover {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* 区块样式 */
.server-section,
.tool-section,
.resource-section {
  padding: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title .el-icon {
  color: var(--el-color-primary);
}

/* 服务器卡片 */
.server-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.server-card {
  display: flex;
  align-items: stretch;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.server-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--el-border-color);
  transition: all 0.3s;
}

.server-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.server-card:hover::before {
  background: var(--el-color-primary-light-3);
}

.server-card.is-running {
  border-color: var(--el-color-success-light-5);
  background: linear-gradient(to right, var(--el-color-success-light-9), var(--el-bg-color));
}

.server-card.is-running::before {
  background: var(--el-color-success);
}

/* 状态指示器 */
.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--el-color-info-light-5);
  margin-right: 16px;
  align-self: center;
  position: relative;
  flex-shrink: 0;
}

.status-indicator.status-active {
  background: var(--el-color-success);
  box-shadow: 0 0 8px var(--el-color-success-light-3);
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--el-color-success);
  animation: pulse 2s ease-out infinite;
  opacity: 0.5;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.server-content {
  flex: 1;
  min-width: 0;
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.server-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.server-name .el-icon {
  color: var(--el-color-primary);
}

.server-id {
  margin-bottom: 12px;
}

.server-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 工具卡片 */
.tool-cards,
.resource-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-card,
.resource-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition: all 0.3s;
}

.tool-card:hover,
.resource-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateX(4px);
}

.tool-icon,
.resource-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.resource-icon {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.tool-info,
.resource-info {
  flex: 1;
  min-width: 0;
}

.tool-name,
.resource-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.tool-description,
.resource-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-uri {
  display: block;
  margin-top: 4px;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 11px !important;
}
</style>
