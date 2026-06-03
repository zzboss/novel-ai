<template>
  <div class="chapter-outline-form h-full overflow-y-auto overflow-x-hidden px-3 py-4">
    <!-- 章节级字段 -->
    <el-form :model="formData" label-position="top" size="default" class="outline-form">
      <el-divider content-position="left" class="!mb-4">章节信息</el-divider>

      <el-form-item label="核心目标">
        <el-input
          v-model="formData.coreGoal"
          type="textarea"
          :rows="2"
          placeholder="本章节的核心目标和要达成的叙事目的"
        />
      </el-form-item>

      <el-form-item label="情节推进">
        <el-input
          v-model="formData.plotProgression"
          type="textarea"
          :rows="3"
          placeholder="整体情节如何推进，包含哪些关键转折"
        />
      </el-form-item>

      <el-form-item label="人物发展">
        <el-input
          v-model="formData.characterDevelopment"
          type="textarea"
          :rows="2"
          placeholder="本章中人物的变化、成长或关系发展"
        />
      </el-form-item>

      <el-form-item label="下一章钩子">
        <el-input
          v-model="formData.nextChapterHook"
          type="textarea"
          :rows="2"
          placeholder="章节结尾的悬念或引导下一章的钩子"
        />
      </el-form-item>
    </el-form>

    <!-- 场景列表 -->
    <el-divider content-position="left">
      场景列表
      <el-button type="primary" size="small" class="ml-2" @click="addScene">
        <el-icon><Plus /></el-icon>
        添加场景
      </el-button>
    </el-divider>

    <div v-if="formData.scenes.length === 0" class="text-center py-8 text-gray-400">
      暂无场景，点击"添加场景"开始
    </div>

    <div v-for="(scene, idx) in formData.scenes" :key="scene.sceneId" class="mb-4">
      <SceneOutlineForm
        :model-value="scene"
        :scene-index="idx"
        @update:model-value="updateScene(idx, $event)"
        @delete="removeScene(idx)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import type { ChapterOutlineJSON, SceneOutline } from '@/stores/agent/generators/chapter'
import SceneOutlineForm from './SceneOutlineForm.vue'

const props = defineProps<{
  modelValue: ChapterOutlineJSON
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ChapterOutlineJSON): void
}>()

// 阻断双向 watch 循环的标志
const syncingFromParent = ref(false)

// 表单数据
const formData = reactive<ChapterOutlineJSON>({
  chapterTitle: props.modelValue.chapterTitle || '',
  chapterNumber: props.modelValue.chapterNumber || 0,
  coreGoal: props.modelValue.coreGoal || '',
  scenes: [...(props.modelValue.scenes || [])],
  plotProgression: props.modelValue.plotProgression || '',
  characterDevelopment: props.modelValue.characterDevelopment || '',
  nextChapterHook: props.modelValue.nextChapterHook || ''
})

// 场景管理
const addScene = () => {
  const newScene: SceneOutline = {
    sceneId: Date.now(),
    location: '',
    emotionalTone: '',
    characters: [],
    events: '',
    foreshadowing: '',
    twists: ''
  }
  formData.scenes.push(newScene)
  emitChange()
}

const removeScene = (idx: number) => {
  formData.scenes.splice(idx, 1)
  emitChange()
}

const updateScene = (idx: number, updatedScene: SceneOutline) => {
  formData.scenes[idx] = updatedScene
  emitChange()
}

// 发送变更
const emitChange = () => {
  emit('update:modelValue', { ...formData })
}

// 监听表单数据变化（跳过父组件同步期间的变化）用于 v-model 绑定的自动同步
watch(formData, () => {
  if (syncingFromParent.value) return
  emitChange()
}, { deep: true })

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  syncingFromParent.value = true
  formData.chapterTitle = newVal.chapterTitle || ''
  formData.chapterNumber = newVal.chapterNumber || 0
  formData.coreGoal = newVal.coreGoal || ''
  formData.scenes = [...(newVal.scenes || [])]
  formData.plotProgression = newVal.plotProgression || ''
  formData.characterDevelopment = newVal.characterDevelopment || ''
  formData.nextChapterHook = newVal.nextChapterHook || ''
  nextTick(() => { syncingFromParent.value = false })
}, { deep: true })
</script>

<style scoped>
.chapter-outline-form {
  /* 由父容器 OutlinePanel 的 flex-1 overflow-hidden 控制高度 */
}

.outline-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.outline-form :deep(.el-form-item__label) {
  padding-bottom: 2px;
  line-height: 1.4;
  font-weight: 500;
}

.outline-form :deep(.el-divider) {
  margin: 8px 0 16px;
}

/* Tag 文字过长时省略并允许换行 */
.tag-ellipsis {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
