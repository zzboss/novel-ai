<template>
  <div class="map-editor-view">
    <!-- 左侧面板：地图列表和地点列表 -->
    <div class="left-panel" :class="{ collapsed: leftPanelCollapsed }">
      <div class="panel-header">
        <span class="panel-title">地图编辑器</span>
        <el-button
          type="text"
          class="collapse-btn"
          @click="leftPanelCollapsed = !leftPanelCollapsed"
        >
          <el-icon>
            <ArrowLeft v-if="!leftPanelCollapsed" />
            <ArrowRight v-else />
          </el-icon>
        </el-button>
      </div>

      <div class="panel-content" v-show="!leftPanelCollapsed">
        <!-- 地图列表 -->
        <div class="section">
          <div class="section-header">
            <span>地图列表</span>
            <el-button type="primary" link size="small" @click="showCreateMapDialog">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <div class="map-list">
            <div
              v-for="map in maps"
              :key="map.id"
              class="map-item"
              :class="{ active: currentMap?.id === map.id }"
              @click="loadMap(map.id)"
            >
              <span class="map-name">{{ map.name }}</span>
              <div class="map-actions">
                <el-button type="text" size="small" @click.stop="editMap(map)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button type="text" size="small" @click.stop="deleteMap(map)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 地点列表 -->
        <div class="section" v-if="currentMap">
          <div class="section-header">
            <span>地点列表 ({{ locationCount }})</span>
            <el-button type="primary" link size="small" @click="showAddLocationDialog">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <div class="location-list">
            <div
              v-for="loc in locations"
              :key="loc.id"
              class="location-item"
              :class="{ active: selectedLocationId === loc.id }"
              @click="selectLocation(loc.id)"
            >
              <div class="location-color" :style="{ background: loc.color || '#409EFF' }"></div>
              <span class="location-name">{{ loc.name }}</span>
            </div>
          </div>
        </div>

        <!-- 关系列表 -->
        <div class="section" v-if="currentMap">
          <div class="section-header">
            <span>关系列表 ({{ relationshipCount }})</span>
            <el-button type="primary" link size="small" @click="showAddRelationshipDialog">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>
          <div class="relationship-list">
            <div
              v-for="rel in relationships"
              :key="rel.id"
              class="relationship-item"
              :class="{ active: selectedRelationshipId === rel.id }"
              @click="selectRelationship(rel.id)"
            >
              <span class="rel-label">{{ getLocationName(rel.sourceId) }} → {{ getLocationName(rel.targetId) }}</span>
              <span class="rel-type">{{ rel.relationLabel || rel.relationType }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中央画布：地图可视化 -->
    <div class="center-canvas">
      <div class="canvas-toolbar" v-if="currentMap">
        <el-button-group>
          <el-button size="small" :type="mode === 'select' ? 'primary' : 'default'" @click="mode = 'select'">
            <el-icon><Rank /></el-icon>
            选择
          </el-button>
          <el-button size="small" :type="mode === 'addLocation' ? 'primary' : 'default'" @click="mode = 'addLocation'">
            <el-icon><LocationIcon /></el-icon>
            添加地点
          </el-button>
          <el-button size="small" :type="mode === 'addRelationship' ? 'primary' : 'default'" @click="mode = 'addRelationship'">
            <el-icon><Connection /></el-icon>
            添加关系
          </el-button>
        </el-button-group>

        <div class="toolbar-right">
          <el-button size="small" @click="zoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button size="small" @click="zoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <el-button size="small" @click="resetView">
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </div>
      </div>

      <MapVisualization
        v-if="currentMap"
        :locations="locations"
        :relationships="relationships"
        :selected-location-id="selectedLocationId"
        :editable="true"
        @update:selected-location-id="selectLocation"
        @update:locations="updateLocations"
        @location-click="onLocationClick"
        @relationship-click="onRelationshipClick"
        @map-click="onMapClick"
      />

      <div class="empty-canvas" v-else>
        <el-empty description="请选择或创建一个地图" />
      </div>
    </div>

    <!-- 右侧面板：地点/关系编辑 -->
    <div class="right-panel" :class="{ collapsed: rightPanelCollapsed }" v-if="currentMap">
      <div class="panel-header">
        <el-button
          type="text"
          class="collapse-btn"
          @click="rightPanelCollapsed = !rightPanelCollapsed"
        >
          <el-icon>
            <ArrowRight v-if="!rightPanelCollapsed" />
            <ArrowLeft v-else />
          </el-icon>
        </el-button>
        <span class="panel-title">属性编辑</span>
      </div>

      <div class="panel-content" v-show="!rightPanelCollapsed">
        <!-- 地点编辑 -->
        <LocationEditor
          v-if="selectedLocation"
          :location="selectedLocation"
          @update:location="updateLocation"
          @delete="deleteLocation"
        />

        <!-- 关系编辑 -->
        <RelationshipEditor
          v-else-if="selectedRelationship"
          :relationship="selectedRelationship"
          :locations="locations"
          @update:relationship="updateRelationship"
          @delete="deleteRelationship"
        />

        <!-- 空状态 -->
        <div class="empty-state" v-else>
          <el-empty description="选择地点或关系进行编辑" :image-size="80" />
        </div>
      </div>
    </div>

    <!-- 创建/编辑地图对话框 -->
    <el-dialog
      v-model="showMapDialog"
      :title="editingMap ? '编辑地图' : '创建地图'"
      width="400px"
    >
      <el-form :model="mapForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="mapForm.name" placeholder="请输入地图名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="mapForm.description"
            type="textarea"
            placeholder="请输入地图描述"
            :rows="3"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showMapDialog = false">取消</el-button>
        <el-button type="primary" @click="saveMap" :loading="saving">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加地点对话框 -->
    <el-dialog
      v-model="showLocationDialog"
      title="添加地点"
      width="400px"
    >
      <el-form :model="locationForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="locationForm.name" placeholder="请输入地点名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="locationForm.description"
            type="textarea"
            placeholder="请输入地点描述"
            :rows="3"
          />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="locationForm.color" />
        </el-form-item>
        <el-form-item label="大小">
          <el-slider v-model="locationForm.size" :min="10" :max="100" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showLocationDialog = false">取消</el-button>
        <el-button type="primary" @click="addLocation" :loading="saving">
          添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加关系对话框 -->
    <el-dialog
      v-model="showRelationshipDialog"
      title="添加关系"
      width="400px"
    >
      <el-form :model="relationshipForm" label-width="80px">
        <el-form-item label="源地点" required>
          <el-select v-model="relationshipForm.sourceId" placeholder="请选择源地点">
            <el-option
              v-for="loc in locations"
              :key="loc.id"
              :label="loc.name"
              :value="loc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标地点" required>
          <el-select v-model="relationshipForm.targetId" placeholder="请选择目标地点">
            <el-option
              v-for="loc in locations"
              :key="loc.id"
              :label="loc.name"
              :value="loc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关系类型">
          <el-select v-model="relationshipForm.relationType" placeholder="请选择关系类型">
            <el-option label="连接" value="connection" />
            <el-option label="路径" value="path" />
            <el-option label="边界" value="border" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="关系标签">
          <el-input v-model="relationshipForm.relationLabel" placeholder="请输入关系标签" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="relationshipForm.description"
            type="textarea"
            placeholder="请输入关系描述"
            :rows="3"
          />
        </el-form-item>
        <el-form-item label="线条颜色">
          <el-color-picker v-model="relationshipForm.color" />
        </el-form-item>
        <el-form-item label="线条宽度">
          <el-slider v-model="relationshipForm.lineWidth" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="线条样式">
          <el-radio-group v-model="relationshipForm.lineStyle">
            <el-radio value="solid">实线</el-radio>
            <el-radio value="dashed">虚线</el-radio>
            <el-radio value="dotted">点线</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showRelationshipDialog = false">取消</el-button>
        <el-button type="primary" @click="addRelationship" :loading="saving">
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 地图编辑器主界面
 *
 * 整合地图列表、地图可视化、地点/关系编辑功能
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMapStore } from '@/stores/mapStore'
import { useProjectStore } from '@/stores/project'
import MapVisualization from '@/components/MapVisualization.vue'
import LocationEditor from '@/components/LocationEditor.vue'
import RelationshipEditor from '@/components/RelationshipEditor.vue'
import type { Map, Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'
import {
  Plus,
  Edit,
  Delete,
  Location as LocationIcon,
  Connection,
  Rank,
  ZoomIn,
  ZoomOut,
  FullScreen,
  ArrowLeft,
  ArrowRight
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// Stores
const mapStore = useMapStore()
const projectStore = useProjectStore()
const route = useRoute()

// 状态
const leftPanelCollapsed = ref(false)
const rightPanelCollapsed = ref(false)
const mode = ref<'select' | 'addLocation' | 'addRelationship'>('select')

// 对话框状态
const showMapDialog = ref(false)
const showLocationDialog = ref(false)
const showRelationshipDialog = ref(false)
const editingMap = ref<Map | null>(null)
const saving = ref(false)

// 表单数据
const mapForm = ref({
  name: '',
  description: ''
})

const locationForm = ref({
  name: '',
  description: '',
  x: 0,
  y: 0,
  color: '#409EFF',
  size: 30,
  icon: ''
})

const relationshipForm = ref({
  sourceId: '',
  targetId: '',
  relationType: 'connection' as LocationRelationType,
  relationLabel: '',
  description: '',
  color: '#409EFF',
  lineWidth: 2,
  lineStyle: 'solid' as LineStyle
})

// 计算属性
const maps = computed(() => mapStore.maps)
const currentMap = computed(() => mapStore.currentMap)
const locations = computed(() => mapStore.currentMap?.locations || [])
const relationships = computed(() => mapStore.currentMap?.relationships || [])
const selectedLocationId = computed(() => mapStore.selectedLocationId)
const selectedRelationshipId = computed(() => mapStore.selectedRelationshipId)
const selectedLocation = computed(() => mapStore.selectedLocation)
const selectedRelationship = computed(() => mapStore.selectedRelationship)
const locationCount = computed(() => locations.value.length)
const relationshipCount = computed(() => relationships.value.length)

// 方法
async function loadMaps(): Promise<void> {
  if (!projectStore.currentProject?.path) return
  await mapStore.loadMaps(projectStore.currentProject.path)
}

async function loadMap(mapId: string): Promise<void> {
  if (!projectStore.currentProject?.path) return
  await mapStore.loadMap(projectStore.currentProject.path, mapId)
}

function selectLocation(locationId: string): void {
  mapStore.setSelectedLocation(locationId)
}

function selectRelationship(relationshipId: string): void {
  mapStore.setSelectedRelationship(relationshipId)
}

function updateLocations(updatedLocations: Location[]): void {
  if (!projectStore.currentProject?.path || !currentMap.value) return

  // 更新位置
  const positions = updatedLocations.map(loc => ({
    locationId: loc.id,
    x: loc.x,
    y: loc.y
  }))

  mapStore.updateLocationPositions(projectStore.currentProject.path, currentMap.value.id, positions)
}

async function updateLocation(locationId: string, updates: Partial<Location>): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return
  await mapStore.updateLocation(projectStore.currentProject.path, locationId, currentMap.value.id, updates)
}

async function deleteLocation(locationId: string): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return

  try {
    await ElMessageBox.confirm('确定要删除这个地点吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await mapStore.deleteLocation(projectStore.currentProject.path, locationId, currentMap.value.id)
    ElMessage.success('删除成功')
  } catch (error) {
    // 用户取消
  }
}

async function updateRelationship(relationshipId: string, updates: Partial<LocationRelationship>): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return
  await mapStore.updateRelationship(projectStore.currentProject.path, relationshipId, currentMap.value.id, updates)
}

async function deleteRelationship(relationshipId: string): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return

  try {
    await ElMessageBox.confirm('确定要删除这个关系吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await mapStore.deleteRelationship(projectStore.currentProject.path, relationshipId, currentMap.value.id)
    ElMessage.success('删除成功')
  } catch (error) {
    // 用户取消
  }
}

// 地图操作
function showCreateMapDialog(): void {
  editingMap.value = null
  mapForm.value = {
    name: '',
    description: ''
  }
  showMapDialog.value = true
}

function editMap(map: Map): void {
  editingMap.value = map
  mapForm.value = {
    name: map.name,
    description: map.description || ''
  }
  showMapDialog.value = true
}

async function saveMap(): Promise<void> {
  if (!projectStore.currentProject?.path) return

  saving.value = true
  try {
    if (editingMap.value) {
      await mapStore.updateMap(projectStore.currentProject.path, editingMap.value.id, mapForm.value.name, mapForm.value.description)
      ElMessage.success('地图更新成功')
    } else {
      await mapStore.createMap(projectStore.currentProject.path, mapForm.value.name, mapForm.value.description)
      ElMessage.success('地图创建成功')
    }
    showMapDialog.value = false
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteMap(map: Map): Promise<void> {
  if (!projectStore.currentProject?.path) return

  try {
    await ElMessageBox.confirm(`确定要删除地图「${map.name}」吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await mapStore.deleteMap(projectStore.currentProject.path, map.id)
    ElMessage.success('删除成功')
  } catch (error) {
    // 用户取消
  }
}

// 地点操作
function showAddLocationDialog(): void {
  locationForm.value = {
    name: '',
    description: '',
    x: 0,
    y: 0,
    color: '#409EFF',
    size: 30,
    icon: ''
  }
  showLocationDialog.value = true
}

async function addLocation(): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return

  saving.value = true
  try {
    await mapStore.addLocation(
      projectStore.currentProject.path,
      currentMap.value.id,
      locationForm.value.name,
      locationForm.value.x,
      locationForm.value.y,
      locationForm.value.description,
      locationForm.value.color,
      locationForm.value.size,
      locationForm.value.icon
    )
    ElMessage.success('地点添加成功')
    showLocationDialog.value = false
  } catch (error: any) {
    ElMessage.error(error.message || '添加失败')
  } finally {
    saving.value = false
  }
}

// 关系操作
function showAddRelationshipDialog(): void {
  relationshipForm.value = {
    sourceId: '',
    targetId: '',
    relationType: 'connection',
    relationLabel: '',
    description: '',
    color: '#409EFF',
    lineWidth: 2,
    lineStyle: 'solid'
  }
  showRelationshipDialog.value = true
}

async function addRelationship(): Promise<void> {
  if (!projectStore.currentProject?.path || !currentMap.value) return

  saving.value = true
  try {
    await mapStore.addRelationship(
      projectStore.currentProject.path,
      currentMap.value.id,
      relationshipForm.value.sourceId,
      relationshipForm.value.targetId,
      relationshipForm.value.relationType,
      relationshipForm.value.relationLabel,
      relationshipForm.value.description,
      relationshipForm.value.color,
      relationshipForm.value.lineWidth,
      relationshipForm.value.lineStyle
    )
    ElMessage.success('关系添加成功')
    showRelationshipDialog.value = false
  } catch (error: any) {
    ElMessage.error(error.message || '添加失败')
  } finally {
    saving.value = false
  }
}

// 地图点击事件
function onMapClick(event: { x: number; y: number }): void {
  if (mode.value === 'addLocation') {
    // 添加地点模式
    locationForm.value.x = event.x
    locationForm.value.y = event.y
    showAddLocationDialog()
  }
}

function onLocationClick(location: Location): void {
  selectLocation(location.id)
}

function onRelationshipClick(relationship: LocationRelationship): void {
  selectRelationship(relationship.id)
}

// 工具方法
function getLocationName(locationId: string): string {
  const loc = locations.value.find(l => l.id === locationId)
  return loc ? loc.name : '未知地点'
}

function zoomIn(): void {
  // 通过 ref 调用 MapVisualization 的方法
}

function zoomOut(): void {
  // 通过 ref 调用 MapVisualization 的方法
}

function resetView(): void {
  // 通过 ref 调用 MapVisualization 的方法
}

// 生命周期
onMounted(async () => {
  await loadMaps()

  // 如果路由中有 mapId 参数，自动加载
  const mapId = route.query.mapId as string
  if (mapId) {
    await loadMap(mapId)
  }
})
</script>

<style scoped>
.map-editor-view {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.left-panel {
  width: 280px;
  border-right: 1px solid #dcdfe6;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  background: #ffffff;
}

.left-panel.collapsed {
  width: 0;
  border-right: none;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #dcdfe6;
  background: #f5f7fa;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.collapse-btn {
  padding: 4px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.map-list,
.location-list,
.relationship-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-item,
.location-item,
.relationship-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.map-item:hover,
.location-item:hover,
.relationship-item:hover {
  background: #f5f7fa;
}

.map-item.active,
.location-item.active,
.relationship-item.active {
  background: #ecf5ff;
  color: #409eff;
}

.map-name {
  flex: 1;
  font-size: 14px;
}

.map-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.map-item:hover .map-actions {
  opacity: 1;
}

.location-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
}

.location-name {
  flex: 1;
  font-size: 13px;
}

.rel-label {
  flex: 1;
  font-size: 12px;
}

.rel-type {
  font-size: 11px;
  color: #909399;
}

.center-canvas {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #ffffff;
  border-bottom: 1px solid #dcdfe6;
}

.toolbar-right {
  display: flex;
  gap: 4px;
}

.empty-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.right-panel {
  width: 320px;
  border-left: 1px solid #dcdfe6;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  background: #ffffff;
}

.right-panel.collapsed {
  width: 0;
  border-left: none;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
