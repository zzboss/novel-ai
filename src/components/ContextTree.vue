<template>
  <div class="context-tree h-full flex flex-col bg-[var(--el-bg-color)] border-r border-[var(--el-border-color)]">
    <!-- 顶部标题 -->
    <div class="p-4 border-b border-[var(--el-border-color)]">
      <h3 class="text-sm font-medium text-[var(--el-text-color-primary)]">项目结构</h3>
    </div>

    <!-- 树形结构 -->
    <div class="flex-1 overflow-y-auto p-2">
      <el-tree
        :data="treeData"
        :props="treeProps"
        default-expand-all
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="flex items-center gap-1 text-sm py-1">
            <el-icon :size="16">
              <component :is="data.icon" />
            </el-icon>
            <span>{{ node.label }}</span>
            <span v-if="data.count !== undefined" class="text-xs text-[var(--el-text-color-secondary)]">
              ({{ data.count }})
            </span>
          </div>
        </template>
      </el-tree>
    </div>

    <!-- 底部操作按钮 -->
    <div class="p-2 border-t border-[var(--el-border-color)]">
      <el-button type="primary" size="small" class="w-full" @click="$emit('addChapter')">
        <el-icon class="mr-1"><Plus /></el-icon>
        新增章节
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import { Plus, Document, User, Globe, List, Memo } from '@element-plus/icons-vue'

const projectStore = useProjectStore()

const emit = defineEmits<{
  addChapter: []
  selectItem: [type: string, id: string]
  selectVolume: [volumeId: string]
}>()

/**
 * 构建树形数据
 */
const treeData = computed(() => {
  const project = projectStore.project
  if (!project) return []

  const children = []

  // 世界观
  if (project.worldSetting) {
    children.push({
      id: 'world',
      label: '世界观',
      icon: Globe,
      type: 'world',
      children: [
        { id: 'world-detail', label: '世界设定', type: 'world', icon: Document }
      ]
    })
  }

  // 角色
  const characters = (project as any).characters || []
  if (characters.length > 0) {
    children.push({
      id: 'characters',
      label: '角色',
      icon: User,
      type: 'character',
      count: characters.length,
      children: characters.map((c: any) => ({
        id: c.id,
        label: c.name,
        type: 'character',
        icon: User
      }))
    })
  }

  // 大纲
  const volumes = (project as any).volumes || []
  if (volumes.length > 0) {
    children.push({
      id: 'outline',
      label: '大纲',
      icon: List,
      type: 'outline',
      children: volumes.map((v: any) => ({
        id: v.id,
        label: v.name || `第${v.volumeNumber}卷`,
        type: 'volume',
        icon: List,
        children: (v.chapters || []).map((c: any) => ({
          id: c.id,
          label: c.title || `第${c.chapterNumber}章`,
          type: 'chapter',
          icon: Document
        }))
      }))
    })
  }

  // 章节（平铺视图）
  const chapters = (project as any).chapters || []
  if (chapters.length > 0 && volumes.length === 0) {
    children.push({
      id: 'chapters',
      label: '章节',
      icon: Document,
      type: 'chapter',
      count: chapters.length,
      children: chapters.map((c: any) => ({
        id: c.id,
        label: c.title || `第${c.chapterNumber}章`,
        type: 'chapter',
        icon: Document
      }))
    })
  }

  // 伏笔
  const foreshadows = (project as any).foreshadows || []
  if (foreshadows.length > 0) {
    children.push({
      id: 'foreshadows',
      label: '伏笔',
      icon: Memo,
      type: 'foreshadow',
      count: foreshadows.length,
      children: foreshadows.map((f: any) => ({
        id: f.id,
        label: f.name || '未命名伏笔',
        type: 'foreshadow',
        icon: Memo
      }))
    })
  }

  return [{
    id: 'root',
    label: project.name || '未命名项目',
    icon: Document,
    type: 'project',
    children
  }]
})

const treeProps = {
  children: 'children',
  label: 'label'
}

/**
 * 处理节点点击
 */
function handleNodeClick(data: any): void {
  if (data.type && data.type !== 'project') {
    emit('selectItem', data.type, data.id)
  }
  if (data.type === 'volume') {
    emit('selectVolume', data.id)
  }
}
</script>
