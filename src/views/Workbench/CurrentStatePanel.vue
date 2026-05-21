<template>
  <div class="current-state-panel h-full flex flex-col overflow-hidden">
    <div class="p-4 border-b" style="border-color: var(--el-border-color)">
      <h3 class="text-base font-medium m-0">📊 小说当前状态</h3>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- 世界状态 -->
      <el-card shadow="never" class="!border">
        <template #header>
          <div class="flex items-center gap-2">
            <el-icon><Document /></el-icon>
            <span>世界状态</span>
          </div>
        </template>
        <div class="space-y-2 text-sm">
          <div>
            <span class="text-[var(--el-text-color-placeholder)]">当前时间线：</span>
            <span>{{ worldState.currentTimeline || '未设定' }}</span>
          </div>
          <div>
            <span class="text-[var(--el-text-color-placeholder)]">全局氛围：</span>
            <el-tag size="small">{{ worldState.globalMood || '未设定' }}</el-tag>
          </div>
          <div>
            <span class="text-[var(--el-text-color-placeholder)]">活跃冲突：</span>
            <div v-if="worldState.activeConflicts.length > 0" class="flex flex-wrap gap-1 mt-1">
              <el-tag v-for="(conflict, idx) in worldState.activeConflicts" :key="idx" size="small" type="warning">
                {{ conflict }}
              </el-tag>
            </div>
            <span v-else class="text-[var(--el-text-color-placeholder)]">暂无</span>
          </div>
          <div>
            <span class="text-[var(--el-text-color-placeholder)]">最后更新章节：</span>
            <span>{{ worldState.lastUpdatedChapter || '无' }}</span>
          </div>
        </div>
      </el-card>

      <!-- 角色状态列表 -->
      <el-card shadow="never" class="!border">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <el-icon><User /></el-icon>
              <span>角色状态（{{ characterStateEntries.length }}）</span>
            </div>
          </div>
        </template>
        <div v-if="characterStateEntries.length > 0" class="space-y-2">
          <div
            v-for="[charId, state] in characterStateEntries"
            :key="charId"
            class="p-3 rounded border cursor-pointer hover:bg-[var(--el-fill-color-light)] transition-colors"
            :class="{ 'bg-[var(--el-fill-color-light)]': selectedCharacterId === charId }"
            @click="selectedCharacterId = selectedCharacterId === charId ? '' : charId"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium">{{ state.name }}</span>
              <el-tag size="small" :type="getEmotionalStateType(state.emotionalState)">
                {{ state.emotionalState }}
              </el-tag>
            </div>
            <div class="text-xs space-y-1" style="color: var(--el-text-color-regular)">
              <div>📍 {{ state.location }}</div>
              <div>💪 {{ state.physicalState }}</div>
            </div>

            <!-- 展开详情 -->
            <div v-if="selectedCharacterId === charId" class="mt-2 pt-2 border-t text-xs space-y-1" style="border-color: var(--el-border-color)">
              <div v-if="state.knowledge.length > 0">
                <span class="text-[var(--el-text-color-placeholder)]">已知信息：</span>
                <div class="flex flex-wrap gap-1 mt-1">
                  <el-tag v-for="(info, i) in state.knowledge" :key="i" size="small">{{ info }}</el-tag>
                </div>
              </div>
              <div v-if="state.inventory.length > 0">
                <span class="text-[var(--el-text-color-placeholder)]">持有物品：</span>
                <div class="flex flex-wrap gap-1 mt-1">
                  <el-tag v-for="(item, i) in state.inventory" :key="i" size="small" type="success">{{ item }}</el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无角色状态" :image-size="60" />
      </el-card>

      <!-- 伏笔追踪 -->
      <el-card shadow="never" class="!border">
        <template #header>
          <div class="flex items-center gap-2">
            <el-icon><EditPen /></el-icon>
            <span>伏笔追踪（{{ pendingHooks.length }}）</span>
          </div>
        </template>
        <div v-if="pendingHooks.length > 0" class="space-y-2">
          <div
            v-for="hook in pendingHooks"
            :key="hook.id"
            class="p-3 rounded border"
            :class="{ 'border-orange-300': hook.urgency === 'high', 'border-yellow-300': hook.urgency === 'medium' }"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium">{{ hook.description }}</span>
              <el-tag size="small" :type="getUrgencyType(hook.urgency)">{{ urgencyLabels[hook.urgency] }}</el-tag>
            </div>
            <div class="text-xs" style="color: var(--el-text-color-placeholder)">
              埋于：{{ hook.plantedChapter }}
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无待回收伏笔" :image-size="60" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Document, User, EditPen } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const selectedCharacterId = ref('')

// 世界状态
const worldState = computed(() => projectStore.project?.storyState?.worldState || {
  currentTimeline: '',
  activeConflicts: [],
  globalMood: '',
  lastUpdatedChapter: ''
})

// 角色状态列表
const characterStateEntries = computed(() => {
  const states = projectStore.project?.storyState?.characterStates || {}
  return Object.entries(states)
})

// 伏笔列表
const pendingHooks = computed(() => {
  return projectStore.project?.storyState?.pendingHooks || []
})

const urgencyLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高'
}

function getEmotionalStateType(state: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | undefined {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | undefined> = {
    '平静': undefined,
    '焦虑': 'warning',
    '愤怒': 'danger',
    '悲伤': 'info',
    '兴奋': 'success'
  }
  return map[state] || undefined
}

function getUrgencyType(urgency: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' | undefined {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    low: 'info',
    medium: 'warning',
    high: 'danger'
  }
  return map[urgency] || 'info'
}
</script>

<style scoped>
.current-state-panel {
  background: var(--el-bg-color-page);
}
</style>
