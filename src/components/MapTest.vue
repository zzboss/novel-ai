<template>
  <div class="map-test-container">
    <h2>地图功能测试</h2>
    <div class="map-wrapper">
      <LMap
        ref="mapRef"
        v-model:zoom="zoom"
        v-model:center="center"
        :use-global-leaflet="false"
        class="map-container"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          layer-type="base"
          name="OpenStreetMap"
        />
        <LMarker
          v-for="marker in markers"
          :key="marker.id"
          :lat-lng="marker.position"
          :draggable="true"
          @dragend="onMarkerDragEnd(marker, $event)"
        >
          <LPopup>{{ marker.name }}</LPopup>
        </LMarker>
      </LMap>
    </div>
    <div class="controls">
      <el-button type="primary" @click="addMarker">添加测试标记</el-button>
      <el-button @click="resetMap">重置地图</el-button>
      <el-button @click="logMarkers">输出标记数据</el-button>
    </div>
    <div class="info">
      <p>当前缩放级别: {{ zoom }}</p>
      <p>当前中心坐标: {{ center }}</p>
      <p>标记数量: {{ markers.length }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import type { LatLngTuple, DragEndEvent } from 'leaflet'

interface Marker {
  id: string
  name: string
  position: LatLngTuple
}

const zoom = ref(13)
const center = ref<LatLngTuple>([51.505, -0.09]) // 伦敦坐标
const markers = ref<Marker[]>([
  { id: '1', name: '标记点 1', position: [51.505, -0.09] },
  { id: '2', name: '标记点 2', position: [51.51, -0.1] }
])

const mapRef = ref(null)

/**
 * 添加测试标记
 */
function addMarker(): void {
  const newMarker: Marker = {
    id: Date.now().toString(),
    name: `标记点 ${markers.value.length + 1}`,
    position: [51.505 + Math.random() * 0.01, -0.09 + Math.random() * 0.01] as LatLngTuple
  }
  markers.value.push(newMarker)
}

/**
 * 重置地图
 */
function resetMap(): void {
  zoom.value = 13
  center.value = [51.505, -0.09]
}

/**
 * 标记拖拽结束事件
 */
function onMarkerDragEnd(marker: Marker, event: DragEndEvent): void {
  const latLng = event.target.getLatLng()
  marker.position = [latLng.lat, latLng.lng]
  console.log(`标记 ${marker.name} 移动到:`, marker.position)
}

/**
 * 输出标记数据
 */
function logMarkers(): void {
  console.log('当前标记数据:', markers.value)
  alert(`标记数据已输出到控制台，共 ${markers.value.length} 个标记`)
}
</script>

<style scoped>
.map-test-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

h2 {
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.map-wrapper {
  flex: 1;
  min-height: 400px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 100%;
}

.controls {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.info {
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.info p {
  margin: 4px 0;
  color: var(--el-text-color-regular);
}
</style>
