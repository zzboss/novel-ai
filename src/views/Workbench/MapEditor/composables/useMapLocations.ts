import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { Location } from '@/types/project'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useMapLocations({
  mapId,
  locations,
  relationships,
  isSaving,
  loadMapData
}: {
  mapId: { value: string }
  locations: { value: Location[] }
  relationships: { value: any[] }
  isSaving: { value: boolean }
  loadMapData: () => Promise<void>
}) {
  const projectStore = useProjectStore()

  const selectedLocationId = ref('')
  const selectedLocation = computed(() =>
    locations.value.find(loc => loc.id === selectedLocationId.value) || null
  )

  const showAddLocationDialog = ref(false)
  const editingLocation = ref<Location | null>(null)

  const locationForm = ref({
    name: '',
    description: '',
    x: 0,
    y: 0,
    color: '',
    size: 30
  })

  function selectLocation(locationId: string): void {
    selectedLocationId.value = locationId
  }

  function editLocation(location: Location): void {
    editingLocation.value = location
    locationForm.value = {
      name: location.name,
      description: location.description || '',
      x: location.x,
      y: location.y,
      color: location.color || '',
      size: location.size || 30
    }
    showAddLocationDialog.value = true
  }

  async function handleSaveLocation(): Promise<void> {
    if (!locationForm.value.name.trim()) {
      ElMessage.warning('请输入地点名称')
      return
    }
    const projectPath = projectStore.project?.path
    if (!projectPath || !mapId.value) return

    isSaving.value = true
    try {
      if (editingLocation.value) {
        const updates = {
          name: locationForm.value.name,
          description: locationForm.value.description,
          x: locationForm.value.x,
          y: locationForm.value.y,
          color: locationForm.value.color || undefined,
          size: locationForm.value.size,
          icon: undefined as any
        }
        const result = await window.electronAPI.map.updateLocation(
          projectPath,
          editingLocation.value.id,
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
        const result = await window.electronAPI.map.addLocation(
          projectPath,
          mapId.value,
          locationForm.value.name,
          locationForm.value.x,
          locationForm.value.y,
          locationForm.value.description,
          locationForm.value.color || undefined,
          locationForm.value.size,
          undefined as any
        )
        if (result.success) {
          ElMessage.success('添加成功')
          await loadMapData()
        } else {
          throw new Error((result as any).error || '添加失败')
        }
      }
      showAddLocationDialog.value = false
      resetLocationForm()
    } catch (error: any) {
      console.error('[MapEditor] 保存地点失败:', error)
      ElMessage.error(`保存失败: ${error.message}`)
    } finally {
      isSaving.value = false
    }
  }

  async function handleDeleteLocation(location: Location): Promise<void> {
    try {
      await ElMessageBox.confirm(
        `确定要删除地点"${location.name}"吗？此操作不可恢复。`,
        '确认删除',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )

      const projectPath = projectStore.project?.path
      if (!projectPath || !mapId.value) return

      const result = await window.electronAPI.map.deleteLocation(
        projectPath,
        location.id,
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
        console.error('[MapEditor] 删除地点失败:', error)
        ElMessage.error(`删除失败: ${error.message}`)
      }
    }
  }

  function resetLocationForm(): void {
    locationForm.value = {
      name: '',
      description: '',
      x: 0,
      y: 0,
      color: '',
      size: 30
    }
    editingLocation.value = null
  }

  return {
    selectedLocationId,
    selectedLocation,
    showAddLocationDialog,
    editingLocation,
    locationForm,
    selectLocation,
    editLocation,
    handleSaveLocation,
    handleDeleteLocation,
    resetLocationForm
  }
}
