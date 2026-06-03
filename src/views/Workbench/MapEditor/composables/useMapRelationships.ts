import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useMapRelationships({
  mapId,
  locations,
  relationships,
  isSaving,
  loadMapData
}: {
  mapId: { value: string }
  locations: { value: Location[] }
  relationships: { value: LocationRelationship[] }
  isSaving: { value: boolean }
  loadMapData: () => Promise<void>
}) {
  const projectStore = useProjectStore()

  const selectedRelationshipId = ref('')
  const selectedRelationship = computed(() =>
    relationships.value.find(rel => rel.id === selectedRelationshipId.value) || null
  )

  const showAddRelationshipDialog = ref(false)
  const editingRelationship = ref<LocationRelationship | null>(null)

  const relationshipForm = ref({
    sourceId: '',
    targetId: '',
    relationType: 'connection' as LocationRelationType,
    relationLabel: '',
    description: '',
    color: '',
    lineWidth: 2,
    lineStyle: 'solid' as LineStyle
  })

  function selectRelationship(relationshipId: string): void {
    selectedRelationshipId.value = relationshipId
  }

  function editRelationship(relationship: LocationRelationship): void {
    editingRelationship.value = relationship
    relationshipForm.value = {
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      relationType: relationship.relationType,
      relationLabel: relationship.relationLabel,
      description: relationship.description || '',
      color: relationship.color || '',
      lineWidth: relationship.lineWidth || 2,
      lineStyle: relationship.lineStyle || 'solid'
    }
    showAddRelationshipDialog.value = true
  }

  async function handleSaveRelationship(): Promise<void> {
    if (!relationshipForm.value.sourceId || !relationshipForm.value.targetId) {
      ElMessage.warning('请选择源地点和目标地点')
      return
    }
    const projectPath = projectStore.project?.path
    if (!projectPath || !mapId.value) return

    isSaving.value = true
    try {
      if (editingRelationship.value) {
        const updates = {
          relationType: relationshipForm.value.relationType,
          relationLabel: relationshipForm.value.relationLabel,
          description: relationshipForm.value.description,
          color: relationshipForm.value.color || undefined,
          lineWidth: relationshipForm.value.lineWidth,
          lineStyle: relationshipForm.value.lineStyle
        }
        const result = await window.electronAPI.map.updateLocationRelationship(
          projectPath,
          editingRelationship.value.id,
          mapId.value,
          updates
        )
        if (result.success) {
          ElMessage.success('更新成功')
          await loadMapData()
        } else {
          throw new Error((result as any).error || '更新失败')
        }
      } else {
        const result = await window.electronAPI.map.addLocationRelationship(
          projectPath,
          mapId.value,
          relationshipForm.value.sourceId,
          relationshipForm.value.targetId,
          relationshipForm.value.relationType,
          relationshipForm.value.relationLabel,
          relationshipForm.value.description,
          relationshipForm.value.color || undefined,
          relationshipForm.value.lineWidth,
          relationshipForm.value.lineStyle
        )
        if (result.success) {
          ElMessage.success('添加成功')
          await loadMapData()
        } else {
          throw new Error((result as any).error || '添加失败')
        }
      }
      showAddRelationshipDialog.value = false
      resetRelationshipForm()
    } catch (error: any) {
      console.error('[MapEditor] 保存关系失败:', error)
      ElMessage.error(`保存失败: ${error.message}`)
    } finally {
      isSaving.value = false
    }
  }

  async function handleDeleteRelationship(relationship: LocationRelationship): Promise<void> {
    try {
      await ElMessageBox.confirm(
        `确定要删除关系"${relationship.relationLabel || '未命名'}"吗？此操作不可恢复。`,
        '确认删除',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )

      const projectPath = projectStore.project?.path
      if (!projectPath || !mapId.value) return

      const result = await window.electronAPI.map.deleteLocationRelationship(
        projectPath,
        relationship.id,
        mapId.value
      )
      if (result.success) {
        ElMessage.success('删除成功')
        await loadMapData()
      } else {
        throw new Error((result as any).error || '删除失败')
      }
    } catch (error: any) {
      if (error !== 'cancel') {
        console.error('[MapEditor] 删除关系失败:', error)
        ElMessage.error(`删除失败: ${error.message}`)
      }
    }
  }

  function resetRelationshipForm(): void {
    relationshipForm.value = {
      sourceId: '',
      targetId: '',
      relationType: 'connection',
      relationLabel: '',
      description: '',
      color: '',
      lineWidth: 2,
      lineStyle: 'solid'
    }
    editingRelationship.value = null
  }

  return {
    selectedRelationshipId,
    selectedRelationship,
    showAddRelationshipDialog,
    editingRelationship,
    relationshipForm,
    selectRelationship,
    editRelationship,
    handleSaveRelationship,
    handleDeleteRelationship,
    resetRelationshipForm
  }
}
