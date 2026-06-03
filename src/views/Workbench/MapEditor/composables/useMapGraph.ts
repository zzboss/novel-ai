import { ref, computed, watch, nextTick, type Ref } from 'vue'
import { RGNodeShape } from '@relation-graph/vue'
import type { RGNode, RGLine, RGLink, RGUserEvent, RelationGraphInstance } from '@relation-graph/vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import type { Location, LocationRelationship } from '@/types/project'
import { ElMessage } from 'element-plus'

// 测量文字渲染宽度（缓存 canvas）
let _measureCanvas: HTMLCanvasElement | null = null
function measureTextWidth(text: string, fontSize = 13): number {
  if (typeof document === 'undefined') return text.length * fontSize * 0.8
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas')
  }
  const ctx = _measureCanvas.getContext('2d')!
  ctx.font = `${fontSize}px sans-serif`
  return ctx.measureText(text || '未命名').width
}

export interface UseMapGraphReturn {
  graphRef: Ref<{ getInstance: () => RelationGraphInstance | null } | undefined>
  statusText: Ref<string>
  graphReady: Ref<boolean>
  dataLoaded: Ref<boolean>
  savedInstance: Ref<RelationGraphInstance | null>
  editMode: Ref<'add' | 'edit' | 'link'>
  isSaving: Ref<boolean>
  isDirty: Ref<boolean>
  mapId: Ref<string>
  mapName: Ref<string>
  locations: Ref<Location[]>
  relationships: Ref<LocationRelationship[]>
  graphOptions: Record<string, unknown>
  graphData: ReturnType<typeof computed<{
    nodes: { id: string; text: string; nodeShape: RGNodeShape; width: number; height: number; x: number; y: number }[]
    lines: { from: string; to: string; text: string; color: string; lineWidth: number; lineDash: number[] | undefined; fontColor: string; lineTextBGColor: string; lineTextBGAlpha: number }[]
  }>>
  refreshGraph: () => Promise<void>
  loadMapData: () => Promise<void>
  setEditMode: (mode: 'add' | 'edit' | 'link') => void
  onNodeClick: (nodeObject: RGNode, _event: RGUserEvent) => void
  onLineClick: (lineObject: RGLine, _linkObject: RGLink, _event: RGUserEvent) => void
  handleCreateLine: (fromNode: RGNode, toNode: RGNode, _event: RGUserEvent) => void
  getLocationName: (locationId: string) => string
  markDirty: () => void
  handleBack: () => void
  handleImport: () => Promise<void>
  handleExport: () => Promise<void>
  onMountedInit: () => void
  route: ReturnType<typeof useRoute>
  router: ReturnType<typeof useRouter>
}

export function useMapGraph(graphRef: Ref<{ getInstance: () => RelationGraphInstance | null } | undefined>) {
  const route = useRoute()
  const router = useRouter()
  const projectStore = useProjectStore()

  const statusText = ref('就绪')
  const graphReady = ref(false)
  const dataLoaded = ref(false)
  const savedInstance = ref<RelationGraphInstance | null>(null)
  const editMode = ref<'add' | 'edit' | 'link'>('edit')
  const isSaving = ref(false)
  const isDirty = ref(false)

  const mapId = ref('')
  const mapName = ref('')
  const locations = ref<Location[]>([])
  const relationships = ref<LocationRelationship[]>([])

  // 图谱配置
  const graphOptions = {
    showToolBar: false,
    wheelEventAction: 'zoom' as const,
    dragEventAction: 'move' as const,
    layout: { layoutName: 'center' },
    defaultNode: {
      width: 0,
      height: 0,
      color: '#FFFFFF',
      borderWidth: 2,
      borderColor: '#333333',
      fontColor: '#333333',
      fontSize: 13,
      nodeShape: RGNodeShape.rect
    },
    defaultLine: {
      width: 2,
      color: '#409EFF',
      lineWidth: 2,
      fontColor: '#303133',
      lineTextBGColor: '#FFFFFF',
      lineTextBGAlpha: 0.9,
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
    lineUseTextPath: false,
    labelTextSize: 12
  }

  // 图谱数据（转换为 relation-graph 格式）
  const graphData = computed(() => {
    const nodeList = locations.value || []
    const edgeList = relationships.value || []
    const validNodeIds = new Set(nodeList.map(n => n.id))
    const validEdges = edgeList.filter(
      rel => validNodeIds.has(rel.sourceId) && validNodeIds.has(rel.targetId)
    )

    return {
      nodes: nodeList.map((loc, index) => {
        const hasStoredPos = loc.x !== undefined && loc.y !== undefined && loc.x !== 0 && loc.y !== 0
        const pos = hasStoredPos
          ? { x: loc.x!, y: loc.y! }
          : { x: 100 + (index % 5) * 150, y: 100 + Math.floor(index / 5) * 150 }
        const label = loc.name || '未命名'
        const textW = measureTextWidth(label, 13)
        const nodeW = Math.ceil(textW) + 32
        const nodeH = 40
        return {
          id: loc.id,
          text: label,
          nodeShape: RGNodeShape.rect,
          width: nodeW,
          height: nodeH,
          x: Math.round(pos.x),
          y: Math.round(pos.y)
        }
      }),
      lines: validEdges.map(rel => ({
        id: rel.id,
        from: rel.sourceId,
        to: rel.targetId,
        text: rel.relationLabel || '',
        color: rel.color || '#409EFF',
        lineWidth: rel.lineWidth || 2,
        lineDash: rel.lineStyle === 'dashed' ? [10, 10] : rel.lineStyle === 'dotted' ? [2, 10] : undefined,
        fontColor: '#303133',
        lineTextBGColor: '#FFFFFF',
        lineTextBGAlpha: 0.85
      }))
    }
  })

  // 监听图谱组件挂载，获取实例
  watch(graphRef, async (newRef) => {
    if (newRef) {
      await nextTick()
      let instance: RelationGraphInstance | null = null
      for (let i = 0; i < 10; i++) {
        instance = newRef.getInstance() as RelationGraphInstance | null
        if (instance) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (instance) {
        graphReady.value = true
        savedInstance.value = instance
        // 实例就绪后，如果数据已加载则刷新
        if (dataLoaded.value) {
          nextTick(() => refreshGraph())
        }
      }
    }
  }, { immediate: true })

  // 监听数据和图谱实例，两者都就绪时刷新图谱（解决时序问题）
  watch(
    () => [graphReady.value, dataLoaded.value, locations.value.length] as const,
    () => {
      if (graphReady.value && dataLoaded.value) {
        nextTick(() => refreshGraph())
      }
    }
  )

  // 刷新关系图
  async function refreshGraph(): Promise<void> {
    const instance = savedInstance.value || graphRef.value?.getInstance() as RelationGraphInstance | null
    if (!instance) return
    try {
      const data = graphData.value
      instance.clearGraph()
      await instance.setJsonData(JSON.parse(JSON.stringify(data)))
      instance.zoomToFit()
      statusText.value = '就绪'
    } catch (e) {
      console.warn('[MapEditor] refreshGraph failed:', e)
    }
  }

  // 加载地图数据
  async function loadMapData(): Promise<void> {
    const currentProject = projectStore.project
    if (!currentProject) return
    const projectPath = currentProject.path || ''
    if (!projectPath || !mapId.value) return
    try {
      statusText.value = '加载中...'
      const result = await window.electronAPI.map.getMapById(projectPath, mapId.value)
      if (result.success && result.data) {
        const mapData = result.data
        mapName.value = mapData.map.name
        locations.value = mapData.locations || []
        relationships.value = mapData.relationships || []
        dataLoaded.value = true
        statusText.value = '就绪'
        nextTick(() => {
          if (graphReady.value) refreshGraph()
        })
      } else {
        throw new Error((result as any).error || '加载地图数据失败')
      }
    } catch (error: any) {
      console.error('[MapEditor] 加载地图数据失败:', error)
      ElMessage.error(`加载失败: ${error.message}`)
      statusText.value = `加载失败: ${error.message}`
    }
  }

  function setEditMode(mode: 'add' | 'edit' | 'link'): void {
    editMode.value = mode
    statusText.value = `模式: ${mode === 'add' ? '添加地点' : mode === 'edit' ? '编辑' : '连接'}`
  }

  // 回调函数，由父组件通过 setGraphCallbacks 设置
  let nodeClickCallback: ((nodeId: string, nodeText: string) => void) | null = null
  let lineClickCallback: ((relationshipId: string, lineText: string) => void) | null = null
  let createLineCallback: ((fromName: string, toName: string) => void) | null = null

  function setGraphCallbacks(callbacks: {
    onNodeClick?: (nodeId: string, nodeText: string) => void
    onLineClick?: (relationshipId: string, lineText: string) => void
    onCreateLine?: (fromName: string, toName: string) => void
  }): void {
    nodeClickCallback = callbacks.onNodeClick || null
    lineClickCallback = callbacks.onLineClick || null
    createLineCallback = callbacks.onCreateLine || null
  }

  function onNodeClick(nodeObject: RGNode, _event: RGUserEvent): boolean | void {
    const node = nodeObject as any
    const locationId: string | undefined = node.id
    const nodeText: string | undefined = node.text
    if (locationId && nodeClickCallback) {
      nodeClickCallback(locationId, nodeText || '')
    }
  }

  function onLineClick(lineObject: RGLine, _linkObject: RGLink, _event: RGUserEvent): boolean | void {
    const line = lineObject as any
    const relationshipId: string | undefined = line.id
    const lineText: string | undefined = line.text
    if (relationshipId && lineClickCallback) {
      lineClickCallback(relationshipId, lineText || '')
    }
  }

  function handleCreateLine(lineInfo: { lineJson: Record<string, unknown>; fromNode: any; toNode: any }, _event: RGUserEvent): boolean | void {
    const fromName = (lineInfo as any)?.fromNode?.text || (lineInfo as any)?.fromNode?.id || '未知'
    const toName = (lineInfo as any)?.toNode?.text || (lineInfo as any)?.toNode?.id || '未知'
    if (createLineCallback) {
      createLineCallback(fromName, toName)
    }
  }

  function getLocationName(locationId: string): string {
    const location = locations.value.find(loc => loc.id === locationId)
    return location ? location.name : '未知'
  }

  function markDirty(): void {
    isDirty.value = true
  }

  function handleBack(): void {
    router.push('/workbench')
  }

  async function handleImport(): Promise<void> {
    ElMessage.info('导入功能即将推出')
  }

  async function handleExport(): Promise<void> {
    ElMessage.info('导出功能即将推出')
  }

  function onMountedInit() {
    mapId.value = route.params.mapId as string
    if (!mapId.value) {
      ElMessage.error('地图ID不存在')
      router.push('/workbench')
      return
    }
    // 如果项目已加载则直接加载地图数据，否则等待项目加载完成
    if (projectStore.project?.path) {
      loadMapData()
    }
  }

  // 监听项目加载，项目就绪后再加载地图数据
  watch(
    () => projectStore.project,
    (newProject) => {
      if (newProject?.path && mapId.value && !dataLoaded.value) {
        loadMapData()
      }
    },
    { immediate: true }
  )

  return {
    graphRef, statusText, graphReady, dataLoaded, savedInstance,
    editMode, isSaving, isDirty,
    mapId, mapName, locations, relationships,
    graphOptions, graphData,
    refreshGraph, loadMapData,
    setEditMode, onNodeClick, onLineClick, handleCreateLine,
    setGraphCallbacks,
    getLocationName, markDirty,
    handleBack, handleImport, handleExport,
    onMountedInit,
    route, router
  }
}
