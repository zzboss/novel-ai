<template>
  <div class="ai-writing-assistant h-full flex flex-col">
    <!-- 顶部标题栏 -->
    <div class="panel-header flex items-center gap-2 px-3 py-2 border-b" style="border-color: var(--el-border-color)">
      <span class="text-sm font-semibold">✨ AI 写作助手</span>
      <el-tag v-if="isWorking" size="small" type="primary" effect="dark" round>
        工作中
      </el-tag>
    </div>

    <!-- 核心操作区 -->
    <div class="action-section p-3 flex flex-col gap-2 overflow-y-auto flex-1">
      
      <!-- 场景1：继续写作（最高频） -->
      <div class="action-card" :class="{ 'is-active': activeAction === 'continue' }" @click="onSelectAction('continue')">
        <div class="action-icon">✍️</div>
        <div class="action-body">
          <div class="action-title">继续写作</div>
          <div class="action-desc">从光标位置继续写，保持风格连贯</div>
        </div>
      </div>

      <!-- 场景2：按大纲生成 -->
      <div class="action-card" :class="{ 'is-active': activeAction === 'from-outline' }" @click="onSelectAction('from-outline')">
        <div class="action-icon">📋</div>
        <div class="action-body">
          <div class="action-title">按大纲生成</div>
          <div class="action-desc">根据章节细纲生成正文初稿</div>
        </div>
      </div>

      <!-- 场景3：改写选中内容 -->
      <div class="action-card" :class="{ 'is-active': activeAction === 'rewrite' }" @click="onSelectAction('rewrite')">
        <div class="action-icon">🔄</div>
        <div class="action-body">
          <div class="action-title">改写选中内容</div>
          <div class="action-desc">改写编辑器中选中的段落</div>
        </div>
      </div>

      <!-- 场景4：扩写 -->
      <div class="action-card" :class="{ 'is-active': activeAction === 'expand' }" @click="onSelectAction('expand')">
        <div class="action-icon">📈</div>
        <div class="action-body">
          <div class="action-title">扩写</div>
          <div class="action-desc">将选中的简短内容扩展成完整段落</div>
        </div>
      </div>

      <!-- 场景5：角色一致性检查 -->
      <div class="action-card" :class="{ 'is-active': activeAction === 'check-character' }" @click="onSelectAction('check-character')">
        <div class="action-icon">👤</div>
        <div class="action-body">
          <div class="action-title">角色一致性检查</div>
          <div class="action-desc">检查当前章节角色行为是否符合设定</div>
        </div>
      </div>

      <el-divider class="my-1" />

      <!-- 高级功能（折叠） -->
      <el-collapse v-model="advancedOpen">
        <el-collapse-item title="高级功能" name="advanced">
          <div class="flex flex-col gap-2">
            <div class="action-card-sm" @click="onSelectAction('plot-check')">
              <span>🔍 情节漏洞检测</span>
            </div>
            <div class="action-card-sm" @click="onSelectAction('foreshadowing')">
              <span>🎯 伏笔管理</span>
            </div>
            <div class="action-card-sm" @click="onSelectAction('style-polish')">
              <span>✒️ 文笔润色</span>
            </div>
            <div class="action-card-sm" @click="onSelectAction('brainstorm')">
              <span>💡 卡文时的灵感</span>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 参数配置区（选中操作后显示） -->
    <div v-if="activeAction" class="config-section border-t p-3 flex flex-col gap-3" style="border-color: var(--el-border-color)">
      <div class="config-header flex items-center justify-between">
        <span class="text-sm font-semibold">{{ getActionConfig(activeAction).title }}</span>
        <el-button text size="small" @click="activeAction = ''">✕</el-button>
      </div>

      <!-- 用户提示词输入 -->
      <div class="flex flex-col gap-1">
        <span class="text-xs" style="color: var(--el-text-color-secondary)">
          {{ getActionConfig(activeAction).placeholder }}
        </span>
        <el-input
          v-model="userPrompt"
          type="textarea"
          :rows="3"
          :placeholder="getActionConfig(activeAction).placeholder"
        />
      </div>

      <!-- 字数控制（仅生成类操作） -->
      <div v-if="showWordCount" class="flex items-center gap-2">
        <span class="text-xs shrink-0" style="color: var(--el-text-color-secondary)">生成字数：</span>
        <el-slider
          v-model="wordCount"
          :min="100"
          :max="3000"
          :step="100"
          style="flex: 1"
        />
        <span class="text-xs w-12 text-right">{{ wordCount }} 字</span>
      </div>

      <!-- 模型选择 -->
      <div class="flex items-center gap-2">
        <span class="text-xs shrink-0" style="color: var(--el-text-color-secondary)">模型：</span>
        <el-select v-model="selectedModelId" size="small" style="width: 100%">
          <el-option
            v-for="m in availableModels"
            :key="m.id"
            :label="m.name || m.model"
            :value="m.id"
          />
        </el-select>
      </div>

      <!-- 操作按钮 -->
      <el-button
        type="primary"
        size="large"
        :loading="isWorking"
        :disabled="!canExecute"
        @click="onExecute"
        class="execute-btn"
      >
        {{ isWorking ? '生成中...' : '开始生成' }}
      </el-button>
    </div>

    <!-- 生成结果预览（流式输出） -->
    <div v-if="streamingContent" class="result-section border-t flex flex-col" style="border-color: var(--el-border-color)">
      <div class="result-header flex items-center justify-between px-3 py-2">
        <span class="text-sm font-semibold">生成结果</span>
        <div class="flex items-center gap-1">
          <el-button size="small" @click="onRegenerate">重新生成</el-button>
          <el-button size="small" type="primary" @click="onAcceptResult">采纳</el-button>
        </div>
      </div>
      <div class="result-content flex-1 overflow-y-auto p-3 text-sm" style="background: var(--el-bg-color-page)">
        <div v-if="isWorking" class="flex items-center gap-2 text-[var(--el-color-primary)]">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>AI 正在生成...</span>
        </div>
        <div v-html="renderedContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import type { ModelConfig } from '@/llm/types'
import { marked } from 'marked'

const settingsStore = useSettingsStore()
const projectStore = useProjectStore()

// 状态
const activeAction = ref('')
const userPrompt = ref('')
const wordCount = ref(500)
const selectedModelId = ref('')
const isWorking = ref(false)
const streamingContent = ref('')
const advancedOpen = ref<string[]>([])

// 可用的模型列表
const availableModels = computed<ModelConfig[]>(() => {
  return settingsStore.settings.models || []
})

// 是否可以执行
const canExecute = computed(() => {
  if (!selectedModelId.value) return false
  if (activeAction.value === 'rewrite' || activeAction.value === 'expand') {
    // 改写/扩写需要选中内容
    return true // 实际应检查编辑器是否有选中内容
  }
  return true
})

// 是否显示字数控制
const showWordCount = computed(() => {
  return ['continue', 'from-outline', 'expand'].includes(activeAction.value)
})

// 操作配置
function getActionConfig(action: string) {
  const configs: Record<string, { title: string; placeholder: string }> = {
    'continue': {
      title: '继续写作',
      placeholder: '可选：输入写作方向提示（如"接下来描写主角的内心活动"）'
    },
    'from-outline': {
      title: '按大纲生成',
      placeholder: '可选：输入额外要求（如"重点描写环境氛围"）'
    },
    'rewrite': {
      title: '改写选中内容',
      placeholder: '输入改写要求（如"改为更文艺的风格""缩短这段话"）'
    },
    'expand': {
      title: '扩写',
      placeholder: '输入扩写方向（如"增加动作描写""补充对话"）'
    },
    'check-character': {
      title: '角色一致性检查',
      placeholder: '可选：指定要检查的角色名称'
    },
    'plot-check': {
      title: '情节漏洞检测',
      placeholder: '可选：指定要检查的章节范围'
    },
    'foreshadowing': {
      title: '伏笔管理',
      placeholder: '输入要求（如"列出所有未回收的伏笔"）'
    },
    'style-polish': {
      title: '文笔润色',
      placeholder: '输入润色要求（如"提升文笔""改为口语化"）'
    },
    'brainstorm': {
      title: '卡文时的灵感',
      placeholder: '描述你卡住的地方，AI 会给出建议'
    }
  }
  return configs[action] || { title: '', placeholder: '' }
}

// 渲染 Markdown
const renderedContent = computed(() => {
  if (!streamingContent.value) return ''
  return marked(streamingContent.value) as string
})

// 选择操作
function onSelectAction(action: string) {
  activeAction.value = action
  userPrompt.value = ''
  streamingContent.value = ''
}

// 执行生成
async function onExecute() {
  if (!projectStore.project) {
    ElMessage.warning('请先打开项目')
    return
  }
  
  if (!selectedModelId.value) {
    ElMessage.warning('请选择模型')
    return
  }

  isWorking.value = true
  streamingContent.value = ''

  try {
    // TODO: 根据实际操作类型调用对应的 Agent
    // 这里需要根据 activeAction 分发到不同的处理逻辑
    ElMessage.info(`执行操作: ${getActionConfig(activeAction.value).title}`)
    
    // 模拟流式输出
    const demoText = `这是 AI 生成的内容示例。\n\n根据实际的操作类型（${activeAction.value}），这里应该调用对应的 Agent 来生成内容。\n\n用户提示词：${userPrompt.value}\n目标字数：${wordCount.value} 字`
    
    // 模拟流式输出效果
    for (const char of demoText) {
      streamingContent.value += char
      await new Promise(r => setTimeout(r, 20))
    }
    
  } catch (error: any) {
    ElMessage.error(`生成失败: ${error.message}`)
  } finally {
    isWorking.value = false
  }
}

// 重新生成
function onRegenerate() {
  streamingContent.value = ''
  onExecute()
}

// 采纳结果
function onAcceptResult() {
  // TODO: 将生成的内容插入到编辑器中
  ElMessage.success('已采纳 AI 生成的内容')
  streamingContent.value = ''
  activeAction.value = ''
}

// 初始化
onMounted(async () => {
  if (!settingsStore.isReady) {
    await settingsStore.initialize()
  }
  // 自动选择活跃模型
  if (settingsStore.settings.activeModelId) {
    selectedModelId.value = settingsStore.settings.activeModelId
  }
})
</script>

<style scoped>
.panel-header {
  background: var(--el-bg-color-page);
}

.action-section {
  background: var(--el-bg-color);
}

.action-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: all 0.2s;
}

.action-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.action-card.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.action-icon {
  font-size: 20px;
  line-height: 1;
  margin-top: 2px;
}

.action-body {
  flex: 1;
}

.action-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.action-desc {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
}

.action-card-sm {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.action-card-sm:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.config-section {
  background: var(--el-bg-color-page);
}

.result-section {
  max-height: 40%;
  background: var(--el-bg-color);
}

.result-content {
  min-height: 100px;
  max-height: 300px;
}

.execute-btn {
  width: 100%;
}
</style>
