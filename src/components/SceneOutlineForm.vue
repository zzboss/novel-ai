<template>
  <div class="scene-outline-form border rounded-lg p-4 mb-4 overflow-x-hidden"
       style="border-color: var(--el-border-color); background: var(--el-bg-color-page)">
    <div class="flex items-center justify-between mb-4">
      <h4 class="text-base font-semibold m-0">
        场景 {{ sceneIndex + 1 }}
      </h4>
      <el-button type="danger" size="small" :icon="Delete" @click="$emit('delete')">
        删除场景
      </el-button>
    </div>

    <el-form :model="formData" label-position="top" size="default" class="scene-form">
      <!-- 地点 -->
      <el-form-item label="地点">
        <el-input v-model="formData.location" placeholder="请输入场景发生地点" />
      </el-form-item>

      <!-- 情感基调 -->
      <el-form-item label="情感基调">
        <el-input v-model="formData.emotionalTone" placeholder="如：紧张、悲伤、欢快" />
      </el-form-item>

      <!-- 出场人物 -->
      <el-form-item label="出场人物">
        <div class="w-full min-w-0">
          <div v-if="formData.characters.length > 0" class="mb-2 flex flex-wrap gap-1">
            <el-tag
              v-for="(char, idx) in formData.characters"
              :key="idx"
              closable
              class="tag-ellipsis"
              @close="removeCharacter(idx)"
            >
              {{ char }}
            </el-tag>
          </div>
          <el-input
            v-model="newCharacter"
            placeholder="输入人物名称后按 Enter 添加"
            @keyup.enter="addCharacter"
          />
        </div>
      </el-form-item>

      <!-- 事件描述 -->
      <el-form-item label="事件">
        <el-input
          v-model="formData.events"
          type="textarea"
          :rows="3"
          placeholder="描述本场景发生的主要事件"
        />
      </el-form-item>

      <!-- 伏笔 -->
      <el-form-item label="伏笔">
        <el-input
          v-model="formData.foreshadowing"
          type="textarea"
          :rows="2"
          placeholder="本场景埋下的伏笔，如：主角捡到一枚神秘徽章"
        />
      </el-form-item>

      <!-- 转折 -->
      <el-form-item label="转折">
        <el-input
          v-model="formData.twists"
          type="textarea"
          :rows="2"
          placeholder="本场景的关键转折，如：发现敌人真实身份"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive, nextTick } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { SceneOutline } from '@/stores/agent/generators/chapter'

const props = defineProps<{
  modelValue: SceneOutline
  sceneIndex: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SceneOutline): void
  (e: 'delete'): void
}>()

// 阻断双向 watch 循环的标志
const syncingFromParent = ref(false)

// 表单数据
const formData = reactive<SceneOutline>({
  sceneId: props.modelValue.sceneId,
  location: props.modelValue.location || '',
  emotionalTone: props.modelValue.emotionalTone || '',
  characters: [...(props.modelValue.characters || [])],
  events: props.modelValue.events || '',
  foreshadowing: props.modelValue.foreshadowing || '',
  twists: props.modelValue.twists || ''
})

// 新增输入
const newCharacter = ref('')

// 添加人物
const addCharacter = () => {
  if (newCharacter.value.trim()) {
    formData.characters.push(newCharacter.value.trim())
    newCharacter.value = ''
    emitChange()
  }
}

const removeCharacter = (idx: number) => {
  formData.characters.splice(idx, 1)
  emitChange()
}

// 发送变更
const emitChange = () => {
  emit('update:modelValue', { ...formData })
}

// 监听表单数据变化（跳过父组件同步期间的变化）
watch(formData, () => {
  if (syncingFromParent.value) return
  emitChange()
}, { deep: true })

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  syncingFromParent.value = true
  formData.sceneId = newVal.sceneId
  formData.location = newVal.location || ''
  formData.emotionalTone = newVal.emotionalTone || ''
  formData.characters = [...(newVal.characters || [])]
  formData.events = newVal.events || ''
  formData.foreshadowing = newVal.foreshadowing || ''
  formData.twists = newVal.twists || ''
  nextTick(() => { syncingFromParent.value = false })
}, { deep: true })
</script>

<style scoped>
.scene-outline-form {
  border-color: var(--el-border-color);
}

.scene-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.scene-form :deep(.el-form-item__label) {
  padding-bottom: 2px;
  line-height: 1.4;
  font-weight: 500;
}

/* Tag 文字过长时省略 */
.tag-ellipsis {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
