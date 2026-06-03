<template>
  <div class="character-graph-view h-full flex flex-col bg-[var(--el-bg-color-page)]">
    <!-- 顶部导航栏 -->
    <header class="h-14 flex items-center justify-between px-6 border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)]/80 backdrop-blur-xl z-10">
      <div class="flex items-center gap-4">
        <el-button text @click="handleBack" class="!p-2">
          <el-icon class="text-lg"><ArrowLeft /></el-icon>
        </el-button>
        <div class="flex items-center gap-2">
          <el-icon class="text-[var(--el-color-primary)]"><Share /></el-icon>
          <h1 class="text-lg font-semibold text-[var(--el-text-color-primary)]">角色关系图</h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- 布局切换 -->
        <el-dropdown @command="handleLayoutChange" trigger="click">
          <el-button size="default">
            <el-icon class="mr-1"><Operation /></el-icon>
            {{ layoutLabels[currentLayout] }}
            <el-icon class="ml-1"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="force">力导向布局</el-dropdown-item>
              <el-dropdown-item command="hierarchical">层次布局</el-dropdown-item>
              <el-dropdown-item command="circular">环形布局</el-dropdown-item>
              <el-dropdown-item command="fixed">固定布局</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 操作按钮 -->
        <el-button-group>
          <el-button @click="handleAutoGenerate" :loading="isLoading">
            <el-icon><MagicStick /></el-icon>
            <span class="ml-1">自动生成</span>
          </el-button>
          <el-button @click="handleImport">
            <el-icon><Upload /></el-icon>
            导入
          </el-button>
          <el-button @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </el-button-group>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧工具栏 -->
      <aside class="w-64 border-r border-[var(--el-border-color)] bg-[var(--el-bg-color)]/50 flex flex-col">
        <div class="p-4 border-b border-[var(--el-border-color)]">
          <h3 class="text-sm font-semibold text-[var(--el-text-color-primary)] mb-3">角色列表</h3>
          <el-button type="primary" size="small" class="w-full" @click="handleAddCharacter">
            <el-icon class="mr-1"><Plus /></el-icon>
            添加角色到关系图
          </el-button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <div
            v-for="node in nodes"
            :key="node.id"
            class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-[var(--el-fill-color-light)]"
            :class="{ 'bg-[var(--el-color-primary-light-9)]': selectedNodeId === node.id }"
            @click="handleSelectNode(node.id)"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              :style="{ backgroundColor: node.color || '#409EFF' }"
            >
              {{ (node.name || '?').charAt(0) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-[var(--el-text-color-primary)] truncate">{{ node.name || '未命名' }}</div>
              <div class="text-xs text-[var(--el-text-color-secondary)]">{{ getRoleLabel(node.role) }}</div>
            </div>
          </div>

          <el-empty v-if="nodes.length === 0" description="暂无角色节点" :image-size="60" />
        </div>

        <div class="p-3 border-t border-[var(--el-border-color)]">
          <el-button size="small" class="w-full" @click="handleResetLayout">
            <el-icon class="mr-1"><RefreshRight /></el-icon>
            重置布局
          </el-button>
        </div>
      </aside>

      <!-- 中央画布区域 -->
      <main class="flex-1 relative bg-[#1a1a2e] overflow-hidden">
        <!-- 关系图 -->
        <div v-if="graphData" class="w-full h-full">
          <relation-graph
            ref="graphRef"
            :options="graphOptions"
            :data="graphData"
            @node-click="handleNodeClick"
            @line-click="handleEdgeClick"
          />
        </div>

        <!-- 空状态 -->
        <div
          v-if="!graphData || nodes.length === 0"
          class="absolute inset-0 flex items-center justify-center"
        >
          <div class="text-center">
            <el-icon class="text-6xl text-[var(--el-text-color-secondary)] mb-4 opacity-50"><Share /></el-icon>
            <p class="text-lg text-[var(--el-text-color-secondary)] mb-2">关系图为空</p>
            <p class="text-sm text-[var(--el-text-color-placeholder)] mb-6">点击"自动生成"从现有角色创建关系图</p>
            <el-button type="primary" @click="handleAutoGenerate" :loading="isLoading">
              <el-icon class="mr-1"><MagicStick /></el-icon>
              自动生成关系图
            </el-button>
          </div>
        </div>

        <!-- 缩放控制 -->
        <div class="absolute bottom-4 right-4 flex items-center gap-2 bg-[var(--el-bg-color)]/80 backdrop-blur-md rounded-lg p-2 shadow-lg">
          <el-button-group size="small">
            <el-button @click="handleZoomIn">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
            <el-button class="!cursor-default !px-3">
              {{ Math.round(zoomLevel * 100) }}%
            </el-button>
            <el-button @click="handleZoomOut">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
          </el-button-group>
          <el-button size="small" @click="handleResetZoom">
            <el-icon><ScaleToOriginal /></el-icon>
          </el-button>
        </div>
      </main>

      <!-- 右侧详情面板 -->
      <aside
        v-if="selectedNode || selectedEdge"
        class="w-80 border-l border-[var(--el-border-color)] bg-[var(--el-bg-color)]/50 overflow-y-auto"
      >
        <!-- 节点详情 -->
        <div v-if="selectedNode" class="p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-[var(--el-text-color-primary)]">角色详情</h3>
            <el-button text class="!p-1" @click="clearSelection">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <div class="text-center mb-4">
            <div
              class="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-white"
              :style="{ backgroundColor: selectedNode.color || '#409EFF' }"
            >
              {{ (selectedNode.name || '?').charAt(0) }}
            </div>
            <h4 class="text-lg font-semibold text-[var(--el-text-color-primary)]">{{ selectedNode.name || '未命名' }}</h4>
            <p class="text-sm text-[var(--el-text-color-secondary)]">{{ getRoleLabel(selectedNode.role) }}</p>
          </div>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="性别" v-if="selectedNode.gender">
              {{ getGenderLabel(selectedNode.gender) }}
            </el-descriptions-item>
            <el-descriptions-item label="年龄" v-if="selectedNode.age">
              {{ selectedNode.age }} 岁
            </el-descriptions-item>
            <el-descriptions-item label="外貌" v-if="selectedNode.appearance">
              {{ selectedNode.appearance }}
            </el-descriptions-item>
            <el-descriptions-item label="性格" v-if="selectedNode.personality">
              {{ selectedNode.personality }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="mt-4 flex gap-2">
            <el-button type="primary" size="small" class="flex-1" @click="handleEditNode(selectedNode)">
              <el-icon class="mr-1"><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" size="small" class="flex-1" @click="handleDeleteNode(selectedNode)">
              <el-icon class="mr-1"><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>

        <!-- 边详情 -->
        <div v-if="selectedEdge && !selectedNode" class="p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-[var(--el-text-color-primary)]">关系详情</h3>
            <el-button text class="!p-1" @click="clearSelection">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="关系类型">
              {{ getRelationTypeLabel(selectedEdge.relationType) }}
            </el-descriptions-item>
            <el-descriptions-item label="关系描述">
              {{ selectedEdge.relationLabel || '未命名' }}
            </el-descriptions-item>
            <el-descriptions-item label="方向性">
              <el-tag :type="selectedEdge.directional ? 'primary' : 'info'" size="small">
                {{ selectedEdge.directional ? '有向' : '无向' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="mt-4 flex gap-2">
            <el-button type="primary" size="small" class="flex-1" @click="handleEditEdge(selectedEdge)">
              <el-icon class="mr-1"><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" size="small" class="flex-1" @click="handleDeleteEdge(selectedEdge)">
              <el-icon class="mr-1"><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </aside>

      <!-- 节点编辑对话框 -->
      <CharacterGraphNodeEditor
        v-model="nodeEditorVisible"
        :node="editingNode"
        :character-options="characterOptions"
        @confirm="handleNodeEditorConfirm"
      />

      <!-- 边编辑对话框 -->
      <CharacterGraphEdgeEditor
        v-model="edgeEditorVisible"
        :edge="editingEdge"
        :node-options="characterOptions"
        @confirm="handleEdgeEditorConfirm"
      />
    </div>

    <!-- 底部状态栏 -->
    <footer class="h-8 flex items-center justify-between px-4 border-t border-[var(--el-border-color)] bg-[var(--el-bg-color)] text-xs text-[var(--el-text-color-secondary)]">
      <span>{{ statusText }}</span>
      <span>{{ nodeCount }} 个节点 / {{ edgeCount }} 条边</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Share,
  Operation,
  ArrowDown,
  MagicStick,
  Upload,
  Download,
  Plus,
  RefreshRight,
  ZoomIn,
  ZoomOut,
  ScaleToOriginal,
  Close,
  Edit,
  Delete
} from '@element-plus/icons-vue'
import RelationGraph from '@relation-graph/vue'
import type { RelationGraphInstance, RelationGraphOptions } from '@relation-graph/vue'
import { useCharacterGraphStore } from '@/stores/characterGraphStore'
import { useProjectStore } from '@/stores/project'
import type { CharacterNode, CharacterEdge, CharacterRelationType, GraphLayoutConfig, AddCharacterNodeRequest, AddCharacterEdgeRequest } from '@/types/character-graph'
import CharacterGraphNodeEditor from '@/components/CharacterGraphNodeEditor.vue'
import CharacterGraphEdgeEditor from '@/components/CharacterGraphEdgeEditor.vue'

const router = useRouter()
const store = useCharacterGraphStore()
const projectStore = useProjectStore()

const graphRef = ref<any>()
const currentLayout = ref<string>('force')
const statusText = ref('就绪')

// 对话框控制
const nodeEditorVisible = ref(false)
const edgeEditorVisible = ref(false)
const editingNode = ref<CharacterNode | null>(null)
const editingEdge = ref<CharacterEdge | null>(null)

// 布局标签映射
const layoutLabels: Record<string, string> = {
  force: '力导向',
  hierarchical: '层次',
  circular: '环形',
  fixed: '固定'
}

// 节点和边
const nodes = computed(() => store.currentGraph?.nodes || [])
const edges = computed(() => store.currentGraph?.edges || [])
const selectedNode = computed(() => store.selectedNode)
const selectedEdge = computed(() => store.selectedEdge)
const selectedNodeId = computed(() => store.selectedNodeId)
const nodeCount = computed(() => store.nodeCount)
const edgeCount = computed(() => store.edgeCount)
const isLoading = computed(() => store.isLoading)
const zoomLevel = computed(() => store.zoomLevel)

// 角色选项（用于选择）
const characterOptions = computed(() => {
  // TODO: 从项目角色列表获取
  return nodes.value.map(n => ({
    id: n.characterId || n.id,
    name: n.name || '未命名',
    role: n.role || 'supporting'
  }))
})

// 关系图数据（转换为 relation-graph 格式）
const graphData = computed(() => {
  if (!store.currentGraph || nodes.value.length === 0) return null

  return {
    nodes: nodes.value.map(node => ({
      id: node.id,
      text: node.name || '未命名',
      color: node.color || getColorByRole(node.role),
      borderColor: node.borderColor || getColorByRole(node.role),
      width: node.size || 60,
      height: node.size || 60,
      borderRadius: (node.size || 60) / 2,
      fontSize: node.fontSize || 14,
      fontColor: node.fontColor || '#FFFFFF'
    })),
    links: edges.value.map(edge => ({
      from: edge.source,
      to: edge.target,
      text: edge.relationLabel || '',
      color: edge.color || '#409EFF',
      lineWidth: edge.lineWidth || 2,
      labelPosition: edge.labelPosition || 'middle'
    }))
  }
})

// 关系图配置
const graphOptions = ref<RelationGraphOptions>({
  debug: false,
  showDebugPanel: false,
  backgroundColor: 'transparent',
  layout: {
    layoutName: 'force',
    layoutClassName: 'seeks-layout-force'
  },
  defaultNode: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    fontColor: '#FFFFFF',
    fontSize: 14
  },
  defaultLine: {
    width: 2,
    color: '#409EFF',
    fontColor: '#FFFFFF'
  }
})

/**
 * 初始化
 */
onMounted(async () => {
  if (projectStore.projectPath) {
    await loadGraph()
  }
})

/**
 * 加载关系图
 */
async function loadGraph() {
  if (!projectStore.projectPath || !projectStore.project?.id) return

  statusText.value = '加载中...'
  try {
    // 获取项目的第一个关系图，如果没有则创建
    const graphs = await window.electronAPI.characterGraph.getGraphs(projectStore.projectPath, projectStore.project.id)
    if (graphs.success && graphs.data.length > 0) {
      const graph = await window.electronAPI.characterGraph.getGraphById(projectStore.projectPath, graphs.data[0].id)
      if (graph.success) {
        store.setCurrentGraph(graph.data)
      }
    } else {
      // 创建默认关系图
      const newGraph = await window.electronAPI.characterGraph.createGraph(
        projectStore.projectPath,
        projectStore.project.id,
        { name: '默认关系图' }
      )
      if (newGraph.success) {
        store.setCurrentGraph(newGraph.data)
      }
    }
    statusText.value = '就绪'
  } catch (error: any) {
    statusText.value = `加载失败: ${error.message}`
  }
}

/**
 * 返回
 */
function handleBack() {
  router.back()
}

/**
 * 布局切换
 */
function handleLayoutChange(layout: string) {
  currentLayout.value = layout

  // 更新关系图配置
  const layoutMap: Record<string, any> = {
    force: { layoutName: 'force', layoutClassName: 'seeks-layout-force' },
    hierarchical: { layoutName: 'hierarchical', layoutClassName: 'seeks-layout-hierarchical' },
    circular: { layoutName: 'circular', layoutClassName: 'seeks-layout-circular' },
    fixed: { layoutName: 'fixed', layoutClassName: '' }
  }

  if (layoutMap[layout]) {
    graphOptions.value.layout = layoutMap[layout]
    // 刷新关系图：通过 getInstance() 获取实例后调用 updateOptions
    nextTick(() => {
      const instance = graphRef.value?.getInstance()
      if (instance) {
        instance.updateOptions({ layout: graphOptions.value.layout } as any)
      }
    })
  }

  statusText.value = `已切换到${layoutLabels[layout]}布局`
}

/**
 * 自动生成关系图
 */
async function handleAutoGenerate() {
  if (!projectStore.projectPath || !projectStore.project?.id) return

  statusText.value = '生成中...'
  try {
    const result = await window.electronAPI.characterGraph.generateFromCharacters(
      projectStore.projectPath,
      projectStore.project.id,
      '自动生成的关系图'
    )
    if (result.success) {
      store.setCurrentGraph(result.data)
      statusText.value = '生成完成'
    }
  } catch (error: any) {
    statusText.value = `生成失败: ${error.message}`
  }
}

/**
 * 导入
 */
async function handleImport() {
  if (!projectStore.projectPath || !projectStore.project?.id) return

  try {
    const result = await window.electronAPI.characterGraph.importFromJSON(
      projectStore.projectPath,
      projectStore.project.id,
      '{}' // TODO: 从文件读取 JSON
    )
    if (result.success) {
      store.setCurrentGraph(result.data)
      statusText.value = '导入成功'
    }
  } catch (error: any) {
    statusText.value = `导入失败: ${error.message}`
  }
}

/**
 * 导出
 */
async function handleExport() {
  if (!projectStore.projectPath || !store.currentGraph) return

  try {
    const result = await window.electronAPI.characterGraph.exportToJSON(
      projectStore.projectPath,
      store.currentGraph.id
    )
    if (result.success) {
      // TODO: 保存到文件
      statusText.value = '导出成功'
    }
  } catch (error: any) {
    statusText.value = `导出失败: ${error.message}`
  }
}

/**
 * 添加角色到关系图
 */
function handleAddCharacter() {
  editingNode.value = null
  nodeEditorVisible.value = true
}

/**
 * 选中节点
 */
function handleSelectNode(nodeId: string) {
  store.setSelectedNode(nodeId)
  statusText.value = `已选中节点: ${nodes.value.find(n => n.id === nodeId)?.name || nodeId}`
}

/**
 * 选中边
 */
function handleEdgeClick(line: any) {
  if (line && line.data) {
    store.setSelectedEdge(line.data.id)
    statusText.value = `已选中关系: ${line.data.relationLabel || '未命名'}`
  }
}

/**
 * 点击节点
 */
function handleNodeClick(node: any) {
  handleSelectNode(node.id)
}

/**
 * 清除选中
 */
function clearSelection() {
  store.clearSelection()
  statusText.value = '就绪'
}

/**
 * 重置布局
 */
function handleResetLayout() {
  const instance = graphRef.value?.getInstance()
  if (instance) {
    instance.resetView()
    statusText.value = '布局已重置'
  }
}

/**
 * 缩放
 */
function handleZoomIn() {
  store.setZoomLevel(zoomLevel.value + 0.1)
}

function handleZoomOut() {
  store.setZoomLevel(zoomLevel.value - 0.1)
}

function handleResetZoom() {
  store.setZoomLevel(1)
}

/**
 * 编辑节点
 */
function handleEditNode(node: CharacterNode) {
  editingNode.value = node
  nodeEditorVisible.value = true
}

/**
 * 删除节点
 */
async function handleDeleteNode(node: CharacterNode) {
  if (!projectStore.projectPath || !store.currentGraph) return

  try {
    await ElMessageBox.confirm('确定要删除此节点吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const result = await window.electronAPI.characterGraph.deleteNode(
      projectStore.projectPath,
      node.id,
      store.currentGraph.id
    )
    if (result.success) {
      store.removeNodeFromCurrentGraph(node.id)
      statusText.value = '节点已删除'
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      statusText.value = `删除失败: ${error.message}`
    }
  }
}

/**
 * 编辑边
 */
function handleEditEdge(edge: CharacterEdge) {
  editingEdge.value = edge
  edgeEditorVisible.value = true
}

/**
 * 删除边
 */
async function handleDeleteEdge(edge: CharacterEdge) {
  if (!projectStore.projectPath || !store.currentGraph) return

  try {
    await ElMessageBox.confirm('确定要删除此关系吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const result = await window.electronAPI.characterGraph.deleteEdge(
      projectStore.projectPath,
      edge.id,
      store.currentGraph.id
    )
    if (result.success) {
      store.removeEdgeFromCurrentGraph(edge.id)
      statusText.value = '关系已删除'
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      statusText.value = `删除失败: ${error.message}`
    }
  }
}

/**
 * 节点编辑器确认
 */
async function handleNodeEditorConfirm(data: any) {
  if (!projectStore.projectPath || !store.currentGraph) return

  try {
    if (editingNode.value) {
      // 更新节点
      const result = await window.electronAPI.characterGraph.updateNode(
        projectStore.projectPath,
        editingNode.value.id,
        store.currentGraph.id,
        data
      )
      if (result.success) {
        statusText.value = '节点已更新'
      }
    } else {
      // 添加节点
      const result = await window.electronAPI.characterGraph.addNode(
        projectStore.projectPath,
        store.currentGraph.id,
        data
      )
      if (result.success) {
        store.addNodeToCurrentGraph(result.data)
        statusText.value = '节点已添加'
      }
    }
    nodeEditorVisible.value = false
  } catch (error: any) {
    statusText.value = `操作失败: ${error.message}`
  }
}

/**
 * 边编辑器确认
 */
async function handleEdgeEditorConfirm(data: any) {
  if (!projectStore.projectPath || !store.currentGraph) return

  try {
    if (editingEdge.value) {
      // 更新边
      const result = await window.electronAPI.characterGraph.updateEdge(
        projectStore.projectPath,
        editingEdge.value.id,
        store.currentGraph.id,
        data
      )
      if (result.success) {
        statusText.value = '关系已更新'
      }
    } else {
      // 添加边
      const result = await window.electronAPI.characterGraph.addEdge(
        projectStore.projectPath,
        store.currentGraph.id,
        data
      )
      if (result.success) {
        store.addEdgeToCurrentGraph(result.data)
        statusText.value = '关系已添加'
      }
    }
    edgeEditorVisible.value = false
  } catch (error: any) {
    statusText.value = `操作失败: ${error.message}`
  }
}

/**
 * 根据角色类型获取颜色
 */
function getColorByRole(role: string): string {
  const colorMap: Record<string, string> = {
    'protagonist': '#FFD700',
    'antagonist': '#DC143C',
    'supporting': '#4169E1',
    'minor': '#808080'
  }
  return colorMap[role] || '#409EFF'
}

/**
 * 获取角色类型标签
 */
function getRoleLabel(role: string): string {
  const labelMap: Record<string, string> = {
    'protagonist': '主角',
    'antagonist': '反派',
    'supporting': '配角',
    'minor': '次要角色'
  }
  return labelMap[role] || '未知'
}

/**
 * 获取性别标签
 */
function getGenderLabel(gender: string): string {
  const labelMap: Record<string, string> = {
    'male': '男',
    'female': '女',
    'other': '其他'
  }
  return labelMap[gender] || gender
}

/**
 * 获取关系类型标签
 */
function getRelationTypeLabel(type: CharacterRelationType): string {
  const labelMap: Record<string, string> = {
    'family': '亲属',
    'friend': '朋友',
    'rival': '对手',
    'lover': '恋人',
    'mentor': '导师',
    'student': '学生',
    'enemy': '敌人',
    'ally': '盟友',
    'subordinate': '下属',
    'leader': '领导',
    'custom': '自定义'
  }
  return labelMap[type] || type
}
</script>

<style scoped>
.character-graph-view {
  --graph-bg: #1a1a2e;
}

:deep(.rel-node) {
  transition: all 0.3s ease;
}

:deep(.rel-node:hover) {
  transform: scale(1.1);
  filter: brightness(1.2);
}

:deep(.rel-line) {
  transition: all 0.3s ease;
}

:deep(.rel-line:hover) {
  filter: brightness(1.3);
}
</style>
