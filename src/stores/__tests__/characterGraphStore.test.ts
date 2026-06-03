/**
 * 角色关系图 Store 单元测试
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharacterGraphStore } from '../characterGraphStore'

describe('角色关系图 Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    setActivePinia(undefined)
  })

  test('初始状态正确', () => {
    const store = useCharacterGraphStore()

    expect(store.currentProjectId).toBe('')
    expect(store.currentGraph).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.isSaving).toBe(false)
    expect(store.selectedNodeId).toBe('')
    expect(store.selectedEdgeId).toBe('')
  })

  test('setCurrentProjectId 正确ly updates project ID', () => {
    const store = useCharacterGraphStore()

    store.setCurrentProjectId('test-project-1')
    expect(store.currentProjectId).toBe('test-project-1')
  })

  test('setSelectedNode 正确ly selects node', () => {
    const store = useCharacterGraphStore()

    store.setSelectedNode('node-1')
    expect(store.selectedNodeId).toBe('node-1')
    expect(store.selectedEdgeId).toBe('')
  })

  test('setSelectedEdge 正确ly selects edge', () => {
    const store = useCharacterGraphStore()

    store.setSelectedEdge('edge-1')
    expect(store.selectedEdgeId).toBe('edge-1')
    expect(store.selectedNodeId).toBe('')
  })

  test('clearSelection 正确ly clears selection', () => {
    const store = useCharacterGraphStore()

    store.setSelectedNode('node-1')
    store.clearSelection()
    expect(store.selectedNodeId).toBe('')
    expect(store.selectedEdgeId).toBe('')
  })

  test('setZoomLevel 正确ly updates zoom', () => {
    const store = useCharacterGraphStore()

    store.setZoomLevel(1.5)
    expect(store.zoomLevel).toBe(1.5)

    // 测试边界
    store.setZoomLevel(3)
    expect(store.zoomLevel).toBe(2) // 最大 2

    store.setZoomLevel(0)
    expect(store.zoomLevel).toBe(0.1) // 最小 0.1
  })

  test('resetView 正确ly resets view', () => {
    const store = useCharacterGraphStore()

    store.setZoomLevel(1.5)
    store.resetView()
    expect(store.zoomLevel).toBe(1)
    expect(store.selectedNodeId).toBe('')
    expect(store.selectedEdgeId).toBe('')
  })
})
