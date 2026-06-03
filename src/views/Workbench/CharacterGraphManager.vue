<template>
  <div class="character-graph-manager h-full flex flex-col bg-[var(--el-bg-color-page)]">
    <!-- 顶部工具栏 -->
    <header class="h-14 flex items-center justify-between px-6 border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)]/80 backdrop-blur-xl z-10">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-semibold text-[var(--el-text-color-primary)]">角色关系图</h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <el-button type="primary" size="default" @click="handleAddCharacter">
          <el-icon class="mr-1"><Plus /></el-icon>
          添加角色
        </el-button>

        <el-button size="default" @click="handleAddEdge">
          <el-icon class="mr-1"><Plus /></el-icon>
          添加关系
        </el-button>

        <el-button-group>
          <el-button @click="handleImport">导入</el-button>
          <el-button @click="handleExport">导出</el-button>
        </el-button-group>
      </div>
    </header>

    <div class="flex-1 flex overflow-hidden">
      <!-- 中央画布区域 -->
      <main class="flex-1 relative bg-[var(--el-bg-color)] overflow-hidden">
        <!-- 关系图 -->
        <div class="w-full h-full">
          <RelationGraph
            ref="graphRef"
            :options="graphOptions"
            @on-node-click="onNodeClick"
            @on-line-click="onLineClick"
            @before-create-line="handleCreateLine"
          />

          <!-- 自定义工具栏（左下角，横向排列） -->
          <div class="absolute bottom-4 left-4 flex items-center gap-1 bg-[var(--el-bg-color)]/80 backdrop-blur-md rounded-lg p-1 shadow-lg z-10">
            <el-button size="small" @click="handleZoomIn" title="放大">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
            <el-button size="small" @click="handleZoomReset" title="重置缩放">
              <el-icon><FullScreen /></el-icon>
            </el-button>
            <el-button size="small" @click="handleZoomOut" title="缩小">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
            <el-divider direction="vertical" style="margin: 0 2px" />
            <el-button size="small" @click="handleDownload" title="下载图片">
              <el-icon><Download /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="dataLoaded && nodes.length === 0"
          class="absolute inset-0 flex items-center justify-center bg-[var(--el-bg-color)]/80"
        >
          <div class="text-center">
            <p class="text-lg text-[var(--el-text-color-secondary)] mb-2">关系图为空</p>
            <p class="text-sm text-[var(--el-text-color-placeholder)]">正在自动生成关系图...</p>
          </div>
        </div>
      </main>
    </div>

    <!-- 底部状态栏 -->
    <footer class="h-8 flex items-center justify-between px-4 border-t border-[var(--el-border-color)] bg-[var(--el-bg-color)] text-xs text-[var(--el-text-color-secondary)]">
      <span>{{ statusText }}</span>
      <span>{{ nodeCount }} 个节点 / {{ edgeCount }} 条边</span>
    </footer>

    <!-- 节点编辑对话框 -->
    <CharacterGraphNodeEditor
      v-model="nodeEditorVisible"
      :node="editingNode"
      :character-options="characterOptions"
      @confirm="handleNodeEditorConfirm"
    />

    <!-- 边编辑对话框（关系维护） -->
    <CharacterGraphEdgeEditor
      v-model="edgeEditorVisible"
      :edge="editingEdge"
      :node-options="nodeOptions"
      :pre-fill-source="pendingEdgeSource"
      :pre-fill-target="pendingEdgeTarget"
      @confirm="handleEdgeEditorConfirm"
      @delete="handleEdgeEditorDelete"
      @update:model-value="onEdgeEditorClosed"
    />

    <!-- 添加角色对话框 -->
    <CharacterGraphAddDialog
      v-model="addDialogVisible"
      :project-path="projectStore.project?.path || ''"
      :graph-id="store.currentGraph?.id || ''"
      @success="handleAddDialogSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Plus, ZoomIn, ZoomOut, FullScreen, Download } from '@element-plus/icons-vue'
import { RelationGraph } from '@relation-graph/vue'
import type { RGNode, RGLine, RGLink, RGUserEvent, RelationGraphInstance } from '@relation-graph/vue'
import { useCharacterGraphStore } from '@/stores/characterGraphStore'
import { useProjectStore } from '@/stores/project'
import type { CharacterNode, CharacterEdge } from '@/types/character-graph'
import type { ProjectState } from '@/types/project'
import CharacterGraphNodeEditor from '@/components/CharacterGraphNodeEditor.vue'
import CharacterGraphEdgeEditor from '@/components/CharacterGraphEdgeEditor.vue'
import CharacterGraphAddDialog from '@/components/CharacterGraphAddDialog.vue'
import { ElMessage } from 'element-plus'

const store = useCharacterGraphStore()
const projectStore = useProjectStore() as any

const graphRef = ref<any>()
const statusText = ref('就绪')
const graphReady = ref(false)
const dataLoaded = ref(false)
const savedInstance = ref<RelationGraphInstance | null>(null)

// 主题检测：是否为深色主题
const isDark = ref(false)
function updateTheme() {
  // Element Plus 深色模式会在 html 元素上添加 'dark' 类
  // 亮色/护眼主题无此类名
  const dark = document.documentElement.classList.contains('dark')
  if (isDark.value !== dark) {
    console.log('[CharacterGraphManager] 主题变化检测: isDark', isDark.value, '->', dark, 'html.class:', document.documentElement.className)
  }
  isDark.value = dark
}

// 对话框控制
const nodeEditorVisible = ref(false)
const edgeEditorVisible = ref(false)
const addDialogVisible = ref(false)
const editingNode = ref<CharacterNode | undefined>(undefined)
const editingEdge = ref<CharacterEdge | undefined>(undefined)

// 节点和边
const nodes = computed(() => store.currentGraph?.nodes || [])
const nodeCount = computed(() => store.nodeCount)
const edgeCount = computed(() => store.edgeCount)

// 角色选项（用于选择）
const characterOptions = computed(() => {
  if (!projectStore.project) return []
  return projectStore.project.characters.map((c: any) => ({
    id: c.id,
    name: c.name || '未命名',
    role: c.role || 'supporting'
  }))
})

// 节点选项（用于关系边的 source/target 选择，id 必须是节点 UUID）
const nodeOptions = computed(() => {
  const nodeList = store.currentGraph?.nodes || []
  return nodeList.map(node => ({
    id: node.id,
    name: node.name || '未命名',
    role: node.role || 'supporting'
  }))
})

// 动态读取主题 CSS 变量
function getThemeLineColors() {
  const style = getComputedStyle(document.documentElement)
  // --text-primary: 主文本色（深色主题为浅色，亮色/护眼主题为深色）
  const fontColor = style.getPropertyValue('--text-primary').trim() || '#F8FAFC'
  // --bg-elevated: 悬浮层背景（深色主题为深紫灰，亮色为白色，护眼为暖白）
  const lineTextBGColor = style.getPropertyValue('--bg-elevated').trim() || '#1E1E3A'
  return { fontColor, lineTextBGColor }
}

// 根据角色类型获取节点大小
function getSizeByRole(role: string): number {
  const sizeMap: Record<string, number> = {
    'protagonist': 80,   // 主角更大
    'antagonist': 70,     // 反派次之
    'supporting': 60,     // 配角默认
    'minor': 50           // 次要角色更小
  }
  return sizeMap[role] || 60
}

// 关系图数据（转换为 relation-graph 格式）
const graphData = computed(() => {
  // 引用 isDark 以建立依赖，主题变化时重新计算并读取最新 CSS 变量
  void isDark.value

  const nodeList = store.currentGraph?.nodes || []
  const edgeList = store.currentGraph?.edges || []
  const { fontColor, lineTextBGColor } = getThemeLineColors()

  // 收集所有有效节点 ID，用于过滤无效的边
  const validNodeIds = new Set(nodeList.map(n => n.id))

  // 过滤掉引用不存在节点的边
  const validEdges = edgeList.filter(edge => {
    const valid = validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    if (!valid) {
      console.warn('[CharacterGraphManager] 跳过无效边:', edge.id, 'source:', edge.source, 'target:', edge.target)
    }
    return valid
  })

  return {
    nodes: nodeList.map((node, index) => {
      // 根据 characterId 查找最新的角色 role，确保颜色与角色类型同步
      // 优先使用角色最新 role，而非节点存储的 role（节点 role 可能过时）
      const character = characterOptions.value.find((c: { id: string; name: string; role: string }) => c.id === node.characterId)
      const role = character?.role || node.role || 'supporting'
      const color = getColorByRole(role)

      // 优先使用节点已存储的位置（来自上一次布局计算），否则使用默认位置
      const hasStoredPos = node.x !== undefined && node.y !== undefined && node.x !== 0 && node.y !== 0
      const pos = hasStoredPos ? { x: node.x!, y: node.y! } : { x: 100 + (index % 5) * 150, y: 100 + Math.floor(index / 5) * 150 }
      return {
        id: node.id,
        text: node.name || '未命名',
        color: color,
        borderColor: color,
        borderRadius: 30,
        fontSize: node.fontSize || 14,
        fontColor: node.fontColor || '#FFFFFF',
        // 根据角色类型设置大小，增加辨识度
        width: node.size || getSizeByRole(role),
        height: node.size || getSizeByRole(role),
        x: Math.round(pos.x),
        y: Math.round(pos.y)
      }
    }),
    lines: validEdges.map(edge => ({
      from: edge.source,
      to: edge.target,
      text: edge.relationLabel || '',
      color: edge.color || '#409EFF',
      labelPosition: edge.labelPosition || 'middle',
      // 根据主题显式设置文字颜色（关键：确保主题切换时颜色更新）
      fontColor: fontColor,
      lineTextBGColor: lineTextBGColor,
      lineTextBGAlpha: 0.85,
      // 将完整的 edge 数据附加到 data 属性，用于点击连线时获取边信息
      data: edge
    }))
  }
})

// 关系图配置
const graphOptions = {
  showToolBar: false,
  wheelEventAction: 'zoom',
  dragEventAction: 'move',
  layout: {
    layoutName: 'circle'
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
    lineWidth: 2,
    // 边文字颜色 - 亮色/护眼主题默认值（深色文字）
    fontColor: '#303133',
    // 文字背景色 - 亮色/护眼主题默认值（浅色背景）
    lineTextBGColor: '#FFFFFF',
    lineTextBGAlpha: 0.9,
    // 文字大小
    fontSize: 13
  },
  defaultLineMarker: {
    markerWidth: 20,
    markerHeight: 20
  },
  layoutAnimation: false,
  backgroundColor: 'transparent',
  padding: { top: 20, bottom: 20, left: 20, right: 20 },
  definitelyNoDataProviderNeeded: true,
  // 确保连线标签显示
  lineUseTextPath: false, // 不使用文字路径，直接显示文字
  labelTextSize: 12 // 标签字体大小
}

/**
 * 节点点击回调 - 添加以当前节点为源节点的边
 */
function onNodeClick(nodeObject: RGNode, _event: RGUserEvent) {
  // 点击节点时，打开添加边对话框，并预填源节点
  editingEdge.value = undefined
  nextTick(() => {
    edgeEditorVisible.value = true
    pendingEdgeSource.value = nodeObject.id
    pendingEdgeTarget.value = ''
  })
  statusText.value = `正在添加从"${nodeObject.text}"出发的关系`
}

/**
 * 线点击回调 - 打开边编辑器（用于编辑或删除）
 */
function onLineClick(lineObject: RGLine, _linkObject: RGLink, _event: RGUserEvent) {
  const edgeData = lineObject.data as CharacterEdge | undefined
  if (edgeData && edgeData.id) {
    const edge = store.currentGraph?.edges.find(e => e.id === edgeData.id)
    if (edge) {
      editingEdge.value = edge
      edgeEditorVisible.value = true
      statusText.value = `正在编辑关系: ${edge.relationLabel || '未命名'}`
    }
  }
}

/**
 * 获取图谱实例
 */
function getGraphInstance() {
  // 优先使用保存的实例
  if (savedInstance.value) {
    return savedInstance.value
  }
  // 降级方案：从 ref 获取
  const instance = graphRef.value?.getInstance()
  if (!instance) {
    console.warn('[CharacterGraphManager] 图谱实例未就绪')
    return null
  }
  return instance
}

/**
 * 刷新关系图 - 完整重渲染
 */
async function refreshGraph() {
  const instance = getGraphInstance()
  if (!instance) {
    console.warn('[CharacterGraphManager] 图谱实例未就绪，无法刷新')
    return
  }

  try {
    const data = graphData.value
    console.log('[CharacterGraphManager] 刷新关系图，节点:', data.nodes.length, '边:', data.lines.length)
    // 先清空再设置，强制 relation-graph 完全重渲染（解决边文字更新被跳过的问题）
    instance.clearGraph()
    await instance.setJsonData(data)
    await instance.zoomToFit()
    statusText.value = '就绪'
  } catch (e) {
    console.warn('[CharacterGraphManager] 刷新关系图失败:', e)
  }
}

/**
 * 初始化
 */
onMounted(async () => {
  const project = projectStore.project as ProjectState | null

  // 初始化主题检测
  updateTheme()
  // 监听主题变化（Element Plus 通过修改 html 的 class 切换主题）
  const observer = new MutationObserver(() => {
    updateTheme()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (project?.path) {
    // 初始化角色数据快照（用于检测角色类型变化）
    initCharacterRolesSnapshot()
    await loadGraph()
  }
})

/**
 * 监听图谱组件挂载，获取实例
 */
watch(graphRef, async (newRef) => {
  if (newRef) {
    console.log('[CharacterGraphManager] 图谱组件已挂载，正在获取实例...')
    // 等待组件完全初始化
    await nextTick()
    
    // 多次尝试获取实例（有时需要等待）
    let instance: RelationGraphInstance | null = null
    for (let i = 0; i < 10; i++) {
      instance = newRef.getInstance() as RelationGraphInstance | null
      if (instance) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (instance) {
      console.log('[CharacterGraphManager] 成功获取图谱实例')
      graphReady.value = true
      savedInstance.value = instance
      
      // 如果数据已加载，自动刷新图谱
      if (dataLoaded.value && graphData.value.nodes.length > 0) {
        console.log('[CharacterGraphManager] 数据已加载，自动刷新图谱')
        await refreshGraph()
      }
    } else {
      console.error('[CharacterGraphManager] 无法获取图谱实例')
    }
  }
}, { immediate: true })

/**
 * 监听主题变化，动态更新边文字颜色（使用主题 CSS 变量）
 */
watch(isDark, async () => {
  // 从 CSS 变量读取主题色值
  const { fontColor, lineTextBGColor } = getThemeLineColors()

  graphOptions.defaultLine.fontColor = fontColor
  graphOptions.defaultLine.lineTextBGColor = lineTextBGColor
  graphOptions.defaultLine.lineTextBGAlpha = 0.85

  console.log('[CharacterGraphManager] 主题变化，更新边文字颜色:', { fontColor, lineTextBGColor })

  // 如果图谱已就绪，更新选项并刷新
  if (graphReady.value) {
    const instance = getGraphInstance()
    if (instance) {
      await instance.updateOptions(graphOptions)
      await refreshGraph()
    }
  }
}, { immediate: true })

/**
 * 监听角色数据变化，自动刷新图谱以更新节点颜色和大小
 * 当角色类型（role）变化时，节点的颜色和大小应该同步更新
 */
let previousCharacterRoles = new Map<string, string>()

// 初始化角色数据快照
function initCharacterRolesSnapshot() {
  previousCharacterRoles.clear()
  const characters = projectStore.project?.characters || []
  characters.forEach((c: any) => {
    previousCharacterRoles.set(c.id, c.role || 'supporting')
  })
}

// 检查角色数据是否变化（主要关注 role 变化）
function checkCharacterRolesChanged(): boolean {
  const characters = projectStore.project?.characters || []
  let changed = false

  for (const c of characters) {
    const newRole = c.role || 'supporting'
    const oldRole = previousCharacterRoles.get(c.id)

    if (oldRole !== newRole) {
      console.log('[CharacterGraphManager] 检测到角色类型变化:', c.name, oldRole, '->', newRole)
      previousCharacterRoles.set(c.id, newRole)
      changed = true
    }
  }

  return changed
}

// 监听 characterOptions 变化，检测角色类型变化并刷新图谱
watch(characterOptions, async () => {
  if (!graphReady.value || !dataLoaded.value) return

  // 检查是否有角色类型变化
  if (checkCharacterRolesChanged()) {
    console.log('[CharacterGraphManager] 角色类型已变化，刷新图谱以更新节点样式')
    await refreshGraph()
  }
}, { deep: true })

/**
 * 默认关系图的名称（固定名称，用于标识默认图）
 */
const DEFAULT_GRAPH_NAME = '默认关系图'

/**
 * 加载关系图（按照4个步骤执行）
 * 步骤1: 关联查询角色 + 节点，左连接，保证角色必定有数据
 * 步骤2: 加载默认图数据，没有则初始化一张图
 * 步骤3: 加载图关联的边
 * 步骤4: 显示图
 */
async function loadGraph() {
  const project = projectStore.project as ProjectState | null
  if (!project?.path || !project.characters) return

  statusText.value = '加载中...'
  try {
    // ========== 步骤2: 加载默认图数据，没有则初始化一张图 ==========
    statusText.value = '加载关系图...'
    
    // 获取项目所有关系图
    const graphsResult = await window.electronAPI.characterGraph.getGraphs(project.path, project.path)
    
    let targetGraphId = ''
    
    if (graphsResult.success && graphsResult.data && graphsResult.data.length > 0) {
      // 查找默认关系图（按名称匹配）
      const defaultGraph = graphsResult.data.find((g: any) => g.name === DEFAULT_GRAPH_NAME)
      
      if (defaultGraph) {
        // 找到默认图，加载它
        targetGraphId = defaultGraph.id
        console.log('[CharacterGraphManager] 找到默认图:', targetGraphId)
      } else {
        // 没有找到默认图，使用第一个图作为默认图，并更新其名称
        targetGraphId = graphsResult.data[0].id
        console.log('[CharacterGraphManager] 未找到默认图，使用第一个图:', targetGraphId)
        
        // 更新第一个图的名称为默认图名称
        try {
          await window.electronAPI.characterGraph.updateGraph(
            project.path, targetGraphId, { name: DEFAULT_GRAPH_NAME }
          )
          console.log('[CharacterGraphManager] 已更新图名称为默认图')
        } catch (updateError) {
          console.warn('[CharacterGraphManager] 更新图名称失败:', updateError)
        }
      }
    } else {
      // 没有图，初始化一张新图
      statusText.value = '初始化关系图...'
      console.log('[CharacterGraphManager] 没有找到现有图，开始生成新图')
      const genResult = await window.electronAPI.characterGraph.generateFromCharacters(
        project.path, project.path, DEFAULT_GRAPH_NAME
      )
      if (genResult.success) {
        targetGraphId = genResult.data.id
        store.setCurrentGraph(genResult.data)
        console.log('[CharacterGraphManager] 已生成新图:', targetGraphId, '节点数:', genResult.data.nodes?.length || 0)
      } else {
        throw new Error('初始化关系图失败')
      }
    }
    
    // 加载目标图的数据
    if (targetGraphId && !store.currentGraph) {
      const graphResult = await window.electronAPI.characterGraph.getGraphById(project.path, targetGraphId)
      if (graphResult.success && graphResult.data) {
        store.setCurrentGraph(graphResult.data)
        console.log('[CharacterGraphManager] 已加载图:', targetGraphId, '节点数:', graphResult.data.nodes?.length || 0)
      } else {
        throw new Error('加载关系图数据失败')
      }
    }

    // ========== 步骤1: 关联查询角色 + 节点，左连接，保证角色必定有数据 ==========
    statusText.value = '同步角色与节点...'
    const existingNodes = store.currentGraph?.nodes || []
    const characters = project.characters
    const nodesToAdd: any[] = []

    console.log('[CharacterGraphManager] 开始同步角色与节点，角色数:', characters.length, '现有节点数:', existingNodes.length)

    for (const character of characters) {
      // 左连接：角色必须有，节点可以没有
      // 注意：节点 ID 可能与角色 ID 不同，需要同时检查 node.id 和 node.characterId
      const existingNode = existingNodes.find(n => n.characterId === character.id)
      if (!existingNode) {
        // 没有对应图节点的，新增节点补足
        const pos = { 
          x: 100 + (nodesToAdd.length % 5) * 150, 
          y: 100 + Math.floor(nodesToAdd.length / 5) * 150 
        }
        nodesToAdd.push({
          characterId: character.id,
          name: character.name || '未命名',
          role: character.role || 'supporting',
          color: getColorByRole(character.role || 'supporting'),
          x: pos.x,
          y: pos.y,
          size: 60
        })
      }
    }

    // 批量添加缺失的节点
    if (nodesToAdd.length > 0) {
      statusText.value = `正在添加 ${nodesToAdd.length} 个角色节点...`
      console.log('[CharacterGraphManager] 需要添加', nodesToAdd.length, '个缺失的节点')
      for (const nodeData of nodesToAdd) {
        try {
          const result = await window.electronAPI.characterGraph.addNode(
            project.path, store.currentGraph!.id, nodeData
          )
          if (result.success) {
            store.addNodeToCurrentGraph(result.data)
          }
        } catch (error) {
          console.error('[CharacterGraphManager] 添加节点失败:', error)
        }
      }
      ElMessage.success(`已同步 ${nodesToAdd.length} 个角色节点`)
    } else {
      console.log('[CharacterGraphManager] 所有角色已有关联节点，无需添加')
    }

    // ========== 步骤3: 加载图关联的边（清理无效边） ==========
    statusText.value = '检查边数据...'
    await cleanupInvalidEdges(project)

    // ========== 标记数据加载完成 ==========
    dataLoaded.value = true
    console.log('[CharacterGraphManager] 数据加载完成，currentGraph:', store.currentGraph?.id, '节点数:', store.currentGraph?.nodes?.length || 0, '边数:', store.currentGraph?.edges?.length || 0)

    // ========== 步骤4: 显示图 ==========
    statusText.value = '准备显示关系图...'
    console.log('[CharacterGraphManager] 准备显示图，graphReady:', graphReady.value, 'nodes:', graphData.value?.nodes?.length)
    await nextTick()
    
    if (graphReady.value) {
      // 图谱已就绪，直接刷新
      if (graphData.value.nodes.length > 0) {
        console.log('[CharacterGraphManager] 开始刷新图谱，节点数:', graphData.value.nodes.length)
        await refreshGraph()
      } else {
        console.warn('[CharacterGraphManager] 没有节点数据，无法显示图')
        statusText.value = '就绪（无节点数据）'
      }
    } else {
      // 图谱还未就绪，等待 onGraphReady 回调
      console.log('[CharacterGraphManager] 图谱未就绪，等待 onGraphReady 回调')
    }
  } catch (error: any) {
    console.error('[CharacterGraphManager] 加载关系图失败:', error)
    statusText.value = `加载失败: ${error.message}`
    dataLoaded.value = true // 确保标记加载完成，避免一直显示加载中
  }
}

/**
 * 清理无效边
 */
async function cleanupInvalidEdges(project: ProjectState) {
  if (!store.currentGraph) return
  const nodes = store.currentGraph.nodes || []
  const edges = store.currentGraph.edges || []
  const validNodeIds = new Set(nodes.map(n => n.id))
  const invalidEdges = edges.filter(e => !validNodeIds.has(e.source) || !validNodeIds.has(e.target))
  if (invalidEdges.length === 0) return

  for (const edge of invalidEdges) {
    try {
      await store.deleteEdge(project.path, edge.id, store.currentGraph!.id)
    } catch (error) {
      console.error('[CharacterGraphManager] 删除无效边失败:', error)
    }
  }
  ElMessage.warning(`已清理 ${invalidEdges.length} 条无效边`)
}

/**
 * 导入
 */
async function handleImport() {
  if (!projectStore.project?.path) return
  const project = projectStore.project as ProjectState
  try {
    const result = await window.electronAPI.characterGraph.importFromJSON(
      project.path, project.path, '{}'
    )
    if (result.success) {
      store.setCurrentGraph(result.data)
      statusText.value = '导入成功'
      await refreshGraph()
    }
  } catch (error: any) {
    statusText.value = `导入失败: ${error.message}`
  }
}

/**
 * 导出
 */
async function handleExport() {
  if (!projectStore.project?.path || !store.currentGraph) return
  try {
    const result = await window.electronAPI.characterGraph.exportToJSON(
      projectStore.project.path, store.currentGraph.id
    )
    if (result.success) {
      statusText.value = '导出成功'
    }
  } catch (error: any) {
    statusText.value = `导出失败: ${error.message}`
  }
}

/**
 * 添加角色
 */
function handleAddCharacter() {
  addDialogVisible.value = true
}

/**
 * 添加关系
 */
function handleAddEdge() {
  editingEdge.value = undefined
  edgeEditorVisible.value = true
}

/**
 * 边编辑对话框关闭回调
 */
function onEdgeEditorClosed(val: boolean) {
  if (!val) {
    pendingEdgeSource.value = ''
    pendingEdgeTarget.value = ''
  }
}

/**
 * 拖拽创建连线时的预填数据
 */
const pendingEdgeSource = ref('')
const pendingEdgeTarget = ref('')

/**
 * 处理拖拽创建连线
 */
function handleCreateLine(lineInfo: any) {
  if (!lineInfo || !lineInfo.fromNode || !lineInfo.toNode) return
  const fromId = lineInfo.fromNode.id || lineInfo.fromNode.data?.id
  const toId = lineInfo.toNode.id || lineInfo.toNode.data?.id
  if (!fromId || !toId) {
    ElMessage.warning('无法识别连线节点')
    return
  }
  editingEdge.value = undefined
  nextTick(() => {
    edgeEditorVisible.value = true
    pendingEdgeSource.value = fromId
    pendingEdgeTarget.value = toId
  })
}

/**
 * 添加角色对话框确认回调
 */
async function handleAddDialogSuccess(character: any, nodeData: any) {
  if (!projectStore.project) return
  projectStore.project.characters.push(character)
  projectStore.markDirty()

  if (projectStore.project?.path && store.currentGraph) {
    try {
      const result = await window.electronAPI.characterGraph.addNode(
        projectStore.project.path, store.currentGraph.id, nodeData
      )
      if (result.success) {
        store.addNodeToCurrentGraph(result.data)
        statusText.value = '角色已添加'
        await refreshGraph()
      }
    } catch (error: any) {
      console.error('[CharacterGraphManager] 在关系图中创建节点失败:', error)
    }
  }
  ElMessage.success('角色已添加')
  addDialogVisible.value = false
}

/**
 * 节点编辑器确认
 */
async function handleNodeEditorConfirm(data: any) {
  if (!projectStore.project?.path || !store.currentGraph) return
  const project = projectStore.project
  try {
    if (editingNode.value) {
      const result = await window.electronAPI.characterGraph.updateNode(
        project.path, editingNode.value.id, store.currentGraph.id, data
      )
      if (result.success) {
        const updated = (result as any).data as CharacterNode | undefined
        if (updated && store.currentGraph) {
          const idx = store.currentGraph.nodes.findIndex(n => n.id === updated.id)
          if (idx !== -1) {
            // 使用 splice 确保响应式更新
            store.currentGraph.nodes.splice(idx, 1, updated)
          }
        }
        statusText.value = '节点已更新'
        await refreshGraph()
      }
    } else {
      const result = await window.electronAPI.characterGraph.addNode(
        project.path, store.currentGraph.id, data
      )
      if (result.success) {
        store.addNodeToCurrentGraph(result.data)
        statusText.value = '节点已添加'
        await refreshGraph()
      }
    }
    nodeEditorVisible.value = false
  } catch (error: any) {
    statusText.value = `操作失败: ${error.message}`
  }
}

/**
 * 边编辑器确认 - 修改后从数据库重新加载，不用缓存
 */
async function handleEdgeEditorConfirm(data: any) {
  if (!projectStore.project?.path || !store.currentGraph) return
  const project = projectStore.project
  const graphId = store.currentGraph.id
  try {
    if (editingEdge.value) {
      const result = await window.electronAPI.characterGraph.updateEdge(
        project.path, editingEdge.value.id, graphId, data
      )
      if (result.success) {
        statusText.value = '关系已更新'
        edgeEditorVisible.value = false
        await reloadGraphFromDB(project.path, graphId)
        ElMessage.success('关系已更新')
      }
    } else {
      const result = await window.electronAPI.characterGraph.addEdge(
        project.path, graphId, data
      )
      if (result.success) {
        statusText.value = '关系已添加'
        edgeEditorVisible.value = false
        await reloadGraphFromDB(project.path, graphId)
        ElMessage.success('关系已添加')
      }
    }
  } catch (error: any) {
    statusText.value = `操作失败: ${error.message}`
    ElMessage.error('操作失败')
  }
}

/**
 * 边编辑器删除回调 - 删除后从数据库重新加载
 */
async function handleEdgeEditorDelete(edgeId: string) {
  if (!projectStore.project?.path || !store.currentGraph) return
  const project = projectStore.project
  const graphId = store.currentGraph.id

  try {
    const result = await window.electronAPI.characterGraph.deleteEdge(
      project.path, edgeId, graphId
    )
    if (result.success) {
      statusText.value = '关系已删除'
      await reloadGraphFromDB(project.path, graphId)
      ElMessage.success('关系已删除')
    }
  } catch (error: any) {
    statusText.value = `删除失败: ${error.message}`
    ElMessage.error('删除失败')
  }
}

/**
 * 从数据库重新加载关系图数据，完全不走缓存
 */
async function reloadGraphFromDB(projectPath: string, graphId: string) {
  const result = await window.electronAPI.characterGraph.getGraphById(projectPath, graphId)
  if (result.success) {
    store.setCurrentGraph(result.data)
    await refreshGraph()
  } else {
    console.error('[CharacterGraphManager] 从数据库重新加载图失败')
  }
}

/**
 * 放大
 */
async function handleZoomIn() {
  const instance = getGraphInstance()
  if (!instance) return
  try {
    await instance.zoomTo(0.2) // 放大20%
    statusText.value = '已放大'
  } catch (e) {
    console.warn('[CharacterGraphManager] 放大失败:', e)
  }
}

/**
 * 缩小
 */
async function handleZoomOut() {
  const instance = getGraphInstance()
  if (!instance) return
  try {
    await instance.zoomTo(-0.2) // 缩小20%
    statusText.value = '已缩小'
  } catch (e) {
    console.warn('[CharacterGraphManager] 缩小失败:', e)
  }
}

/**
 * 重置缩放
 */
async function handleZoomReset() {
  const instance = getGraphInstance()
  if (!instance) return
  try {
    await instance.moveToCenter()
    await instance.zoomToFit()
    statusText.value = '已重置视图'
  } catch (e) {
    console.warn('[CharacterGraphManager] 重置视图失败:', e)
  }
}

/**
 * 下载图片
 */
async function handleDownload() {
  const instance = getGraphInstance()
  if (!instance) return
  try {
    const dataUrl = await instance.getCanvasDataURL()
    const link = document.createElement('a')
    link.download = `角色关系图_${new Date().getTime()}.png`
    link.href = dataUrl
    link.click()
    statusText.value = '已下载图片'
  } catch (e) {
    console.warn('[CharacterGraphManager] 下载图片失败:', e)
    ElMessage.warning('下载图片失败')
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
</script>

<style scoped>
.character-graph-manager {
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
