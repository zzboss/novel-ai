<template>
  <div class="map-visualization-container">
    <l-map
      ref="mapRef"
      :zoom="zoom"
      :center="center"
      :options="mapOptions"
      @update:zoom="onZoomChange"
      @update:center="onCenterChange"
      @click="onMapClick"
    >
      <l-tile-layer :url="tileUrl" :attribution="attribution" />

      <!-- 地点关系（边） -->
      <l-polyline
        v-for="rel in relationships"
        :key="'rel-' + rel.id"
        :lat-lngs="getRelationshipLatLngs(rel)"
        :color="rel.color || '#409EFF'"
        :weight="rel.lineWidth || 2"
        :dash-array="getDashArray(rel.lineStyle)"
        @click="onRelationshipClick(rel, $event)"
      />

      <!-- 地点（节点） -->
      <l-circle-marker
        v-for="loc in locations"
        :key="loc.id"
        :lat-lng="[loc.y, loc.x]"
        :radius="loc.size || 30"
        :color="loc.color || '#409EFF'"
        :fill-color="loc.color || '#409EFF'"
        :fill-opacity="0.6"
        :weight="2"
        @click="onLocationClick(loc, $event)"
        @mousedown="onLocationDragStart(loc, $event)"
      >
        <l-tooltip :content="loc.name" />
      </l-circle-marker>

      <!-- 选中地点的高亮 -->
      <l-circle-marker
        v-if="selectedLocation"
        :lat-lng="[selectedLocation.y, selectedLocation.x]"
        :radius="(selectedLocation.size || 30) + 5"
        color="#FFD700"
        :fill-opacity="0"
        :weight="3"
      />
    </l-map>

    <!-- 地图工具栏 -->
    <div class="map-toolbar">
      <button class="toolbar-btn" title="放大" @click="zoomIn">
        <el-icon><ZoomIn /></el-icon>
      </button>
      <button class="toolbar-btn" title="缩小" @click="zoomOut">
        <el-icon><ZoomOut /></el-icon>
      </button>
      <button class="toolbar-btn" title="重置视图" @click="resetView">
        <el-icon><FullScreen /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 地图可视化组件
 *
 * 使用 Leaflet + Vue-Leaflet 显示地图、地点和地点关系
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  LMap,
  LTileLayer,
  LCircleMarker,
  LPolyline,
  LTooltip
} from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import { ZoomIn, ZoomOut, FullScreen } from '@element-plus/icons-vue'
import type { Location, LocationRelationship } from '@/types/project'

// Props
const props = defineProps<{
  locations: Location[]
  relationships: LocationRelationship[]
  selectedLocationId?: string
  editable?: boolean
}>()

// Emits
const emit = defineEmits<{
  'update:selectedLocationId': [locationId: string]
  'update:locations': [locations: Location[]]
  'location-click': [location: Location]
  'relationship-click': [relationship: LocationRelationship]
  'map-click': [event: { x: number; y: number }]
}>()

// 地图引用
const mapRef = ref<any>(null)

// 地图状态
const zoom = ref(2)
const center = ref<[number, number]>([30, 105]) // 中国中心）

// 地图配置
const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const mapOptions = {
  crs: (window as any).L?.CRS?.Simple || undefined,
  minZoom: -5,
  maxZoom: 10
}

// 选中的地点
const selectedLocation = computed(() => {
  if (!props.selectedLocationId) return null
  return props.locations.find(loc => loc.id === props.selectedLocationId) || null
})

// 获取地点关系的坐标
function getRelationshipLatLngs(rel: LocationRelationship): [number, number][] {
  const source = props.locations.find(loc => loc.id === rel.sourceId)
  const target = props.locations.find(loc => loc.id === rel.targetId)
  if (!source || !target) return []
  return [
    [source.y, source.x],
    [target.y, target.x]
  ]
}

// 获取线条样式
function getDashArray(lineStyle?: string): string {
  switch (lineStyle) {
    case 'dashed': return '10, 10'
    case 'dotted': return '2, 10'
    default: return ''
  }
}

// 地点点击
function onLocationClick(loc: Location, event: any): void {
  event.originalEvent.stopPropagation()
  emit('update:selectedLocationId', loc.id)
  emit('location-click', loc)
}

// 地点拖拽开始
let isDragging = false
let dragLocation: Location | null = null
let dragStart: { x: number; y: number } = { x: 0, y: 0 }

function onLocationDragStart(loc: Location, event: any): void {
  if (!props.editable) return
  isDragging = true
  dragLocation = loc
  dragStart = { x: event.originalEvent.clientX, y: event.originalEvent.clientY }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(event: MouseEvent): void {
  if (!isDragging || !dragLocation || !mapRef.value) return
  const map = mapRef.value.leafletObject
  if (!map) return

  const point = map.containerPointToLatLng({
    x: event.clientX - dragStart.x + map.getSize().x / 2,
    y: event.clientY - dragStart.y + map.getSize().y / 2
  })

  dragLocation.x = point.lng
  dragLocation.y = point.lat
}

function onDragEnd(): void {
  if (!isDragging || !dragLocation) return
  isDragging = false
  emit('update:locations', [...props.locations])
  dragLocation = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// 地点关系点击
function onRelationshipClick(rel: LocationRelationship, event: any): void {
  event.originalEvent.stopPropagation()
  emit('relationship-click', rel)
}

// 地图点击
function onMapClick(event: any): void {
  const latLng = event.latlng
  emit('map-click', { x: latLng.lng, y: latLng.lat })
  emit('update:selectedLocationId', '')
}

// 缩放控制
function zoomIn(): void {
  zoom.value++
}

function zoomOut(): void {
  zoom.value--
}

function onZoomChange(newZoom: number): void {
  zoom.value = newZoom
}

function onCenterChange(newCenter: [number, number]): void {
  center.value = newCenter
}

function resetView(): void {
  zoom.value = 2
  center.value = [30, 105]
}

// 初始化地图
onMounted(() => {
  nextTick(() => {
    if (mapRef.value?.leafletObject) {
      mapRef.value.leafletObject.invalidateSize()
    }
  })
})
</script>

<style scoped>
.map-visualization-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
}

.map-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
}
</style>
