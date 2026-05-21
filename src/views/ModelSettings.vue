<template>
  <div class="model-settings min-h-screen bg-[var(--el-bg-color-page)] text-[var(--el-text-color-primary)]">
    <!-- 加载状态 -->
    <div v-if="!settingsStore.isReady" class="flex items-center justify-center h-64">
      <el-icon class="is-loading" size="large">
        <Loading />
      </el-icon>
    </div>
    
      <!-- 主内容 -->
      <div v-else class="max-w-4xl mx-auto p-6 pb-20" style="max-height: calc(100vh - 64px); overflow-y: auto;">
      <!-- 顶部导航 -->
      <div class="flex items-center gap-4 mb-6">
        <el-button :icon="ArrowLeft" @click="goBack" text>
          返回
        </el-button>
        <h1 class="text-xl font-medium">模型配置</h1>
      </div>

      <!-- 添加模型表单 -->
      <el-card class="mb-6">
        <template #header>
          <div class="font-medium">添加模型</div>
        </template>
        
        <el-form @submit.prevent="addModel" label-width="100px">
          <el-form-item label="提供商">
            <el-select v-model="form.provider" placeholder="请选择提供商" class="w-full">
              <el-option label="OpenAI" value="openai" />
              <el-option label="通义千问" value="qwen" />
              <el-option label="DeepSeek" value="deepseek" />
              <el-option label="豆包" value="doubao" />
              <el-option label="智谱 GLM" value="GLM" />
              <el-option label="Gemini" value="gemini" />
              <el-option label="Ollama（本地）" value="ollama" />
              <el-option label="LM Studio（本地）" value="lmstudio" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="名称">
            <el-input 
              v-model="form.name" 
              placeholder="例如：GPT-4o"
            />
          </el-form-item>
          
          <el-form-item label="模型 ID">
            <el-input 
              v-model="form.model" 
              placeholder="例如：gpt-4o（可选，测试连通性后可从列表选择）"
            />
          </el-form-item>
          
          <el-form-item v-if="!isOllamaOrLMStudio" label="API Key">
            <el-input 
              v-model="form.apiKey" 
              type="password"
              placeholder="sk-..."
              show-password
            />
          </el-form-item>
          
          <el-form-item v-if="needsBaseURL" label="Base URL">
            <el-input 
              v-model="form.baseURL" 
              :placeholder="baseURLPlaceholder"
            />
          </el-form-item>
          
          <!-- 测试连通性 -->
          <el-form-item v-if="needsBaseURL">
            <el-button 
              type="info" 
              :loading="testing"
              @click="testConnection"
            >
              {{ testing ? '检测中...' : '测试连通性' }}
            </el-button>
            
            <!-- 测试结果 -->
            <div v-if="testResult" class="mt-2">
              <el-alert 
                :type="testResult.ok ? 'success' : 'error'"
                :closable="false"
              >
                <template v-if="testResult.ok">
                  连接成功
                  <span v-if="testResult.models && testResult.models.length > 0">
                    （已拉取 {{ testResult.models.length }} 个可用模型）
                  </span>
                </template>
                <template v-else>
                  连接失败：{{ testResult.error }}
                </template>
              </el-alert>
            </div>
            
            <!-- 可用模型列表（多选） -->
            <div v-if="fetchedModels.length > 0" class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[var(--el-text-color-secondary)]">
                  可用模型（点击多选，已选 {{ selectedModels.size }} 个）：
                </span>
                <el-button 
                  size="small" 
                  @click="toggleSelectAll"
                >
                  {{ selectedModels.size === fetchedModels.length ? '取消全选' : '全选' }}
                </el-button>
              </div>
              
              <!-- 固定高度 + 滚动条 -->
              <div class="max-h-60 overflow-y-auto border rounded p-3 mb-4" style="border-color: var(--el-border-color)">
                <div class="flex flex-wrap gap-2">
                  <el-tag
                    v-for="m in fetchedModels"
                    :key="m"
                    :type="selectedModels.has(m) ? 'primary' : 'info'"
                    :effect="selectedModels.has(m) ? 'dark' : 'plain'"
                    class="cursor-pointer"
                    @click="toggleModelSelection(m)"
                  >
                    {{ m }}
                  </el-tag>
                </div>
              </div>
              
              <el-button 
                type="primary"
                :disabled="selectedModels.size === 0"
                @click="addSelectedModels"
              >
                添加选中模型（{{ selectedModels.size }}）
              </el-button>
            </div>
          </el-form-item>
          
          <el-form-item>
            <div class="flex gap-2 justify-end w-full">
              <el-button @click="goBack">取消</el-button>
              <el-button type="primary" native-type="submit">保存</el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 已配置模型列表 -->
      <el-card class="mb-6">
        <template #header>
          <div class="font-medium">已配置模型</div>
        </template>
        
        <el-empty v-if="settingsStore.settings.models.length === 0" description="暂无配置模型，请在上方添加。" />
        
        <!-- 固定高度 + 滚动条 -->
        <div v-else class="max-h-80 overflow-y-auto">
          <el-table :data="settingsStore.settings.models" style="width: 100%" max-height="320">
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.isLocal ? 'success' : 'primary'" size="small">
                  {{ row.isLocal ? '本地' : '云端' }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="名称" prop="name" />
            
            <el-table-column label="模型 ID" prop="model">
              <template #default="{ row }">
                <span class="text-[var(--el-text-color-secondary)]">{{ row.model }}</span>
              </template>
            </el-table-column>
            
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag 
                  v-if="settingsStore.settings.activeModelId === row.id" 
                  type="warning" 
                  size="small"
                >
                  默认
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button 
                  type="primary" 
                  link 
                  size="small"
                  :disabled="settingsStore.settings.activeModelId === row.id"
                  @click="setDefault(row.id)"
                >
                  设为默认
                </el-button>
                <el-button 
                  type="danger" 
                  link 
                  size="small"
                  @click="removeModel(row.id)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>

      <!-- Agent 模型配置 -->
      <el-card>
        <template #header>
          <div>
            <div class="font-medium">Agent 模型配置</div>
            <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">
              为每个 Agent 指定专用模型，未指定的 Agent 使用全局默认模型。
            </div>
          </div>
        </template>
        
        <el-empty v-if="settingsStore.settings.models.length === 0" description="请先添加至少一个模型。" />
        
        <el-table v-else :data="agentTypeOptions" style="width: 100%">
          <el-table-column label="Agent 类型" prop="label" />
          
          <el-table-column label="专用模型">
            <template #default="{ row }">
              <el-select 
                :model-value="(settingsStore.settings.agentModelMapping as Record<string, string>)[row.value] || ''"
                placeholder="全局默认"
                class="w-full"
                @change="(val: string) => onAgentModelChange(row.value, val)"
              >
                <el-option label="全局默认" value="" />
                <el-option 
                  v-for="m in settingsStore.settings.models" 
                  :key="m.id"
                  :label="`${m.name}（${m.model}）`"
                  :value="m.id"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'
import { LLMClient } from '@/llm/LLMClient'
import type { ModelConfig, LLMProviderType } from '@/llm/types'
import type { AgentType } from '@/agents/types'

const router = useRouter()
const settingsStore = useSettingsStore()

// 表单状态
const form = reactive({
  provider: 'openai' as string,
  name: '',
  model: '',
  apiKey: '',
  baseURL: ''
})

// 测试连通性状态
const testing = ref(false)
const testResult = ref<{ ok: boolean; models?: string[]; error?: string } | null>(null)
const fetchedModels = ref<string[]>([])
const selectedModels = ref<Set<string>>(new Set())

// 切换模型选中状态
function toggleModelSelection(modelId: string): void {
  const newSet = new Set(selectedModels.value)
  if (newSet.has(modelId)) {
    newSet.delete(modelId)
  } else {
    newSet.add(modelId)
  }
  selectedModels.value = newSet
}

// 全选/取消全选
function toggleSelectAll(): void {
  if (selectedModels.value.size === fetchedModels.value.length) {
    selectedModels.value = new Set()
  } else {
    selectedModels.value = new Set(fetchedModels.value)
  }
}

// 添加选中的模型
function addSelectedModels(): void {
  if (selectedModels.value.size === 0) {
    ElMessage.warning('请至少选择一个模型')
    return
  }
  
  for (const modelId of selectedModels.value) {
    const config: ModelConfig = {
      id: crypto.randomUUID(),
      name: modelId,
      provider: form.provider as LLMProviderType,
      model: modelId,
      baseURL: form.baseURL || undefined,
      apiKey: form.apiKey || undefined,
      temperature: 0.7,
      maxTokens: 4096,
      isLocal: isOllamaOrLMStudio.value,
      isDefault: false
    }
    settingsStore.addModel(config)
  }
  
  if (form.apiKey && !isOllamaOrLMStudio.value) {
    window.electronAPI?.setApiKey(form.provider, form.apiKey)
  }
  
  // 重置状态
  selectedModels.value = new Set()
  testResult.value = null
  fetchedModels.value = []
  
  ElMessage.success(`成功添加 ${selectedModels.value.size} 个模型`)
}

// 是否是本地模型
const isOllamaOrLMStudio = computed(() => 
  form.provider === 'ollama' || form.provider === 'lmstudio'
)

// 是否需要填写 Base URL
const needsBaseURL = computed(() =>
  form.provider === 'custom' ||
  form.provider === 'qwen' ||
  form.provider === 'deepseek' ||
  form.provider === 'doubao' ||
  form.provider === 'GLM' ||
  form.provider === 'gemini' ||
  form.provider === 'ollama' ||
  form.provider === 'lmstudio'
)

// Base URL 自动提示
const baseURLPlaceholder = computed(() => {
  switch (form.provider) {
    case 'ollama': return 'http://localhost:11434/v1'
    case 'lmstudio': return 'http://localhost:1234/v1'
    case 'qwen': return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    case 'deepseek': return 'https://api.deepseek.com/v1'
    case 'doubao': return 'https://ark.cn-beijing.volces.com/api/v3'
    case 'GLM': return 'https://open.bigmodel.cn/api/paas/v4'
    default: return 'https://...'
  }
})

// Agent 类型选项
const agentTypeOptions: { value: AgentType; label: string }[] = [
  { value: 'idea', label: '💡 创意激发' },
  { value: 'world', label: '🌍 世界观构建' },
  { value: 'character', label: '👤 角色设计' },
  { value: 'outline', label: '📒 大纲规划' },
  { value: 'chapter', label: '📄 章节写作' },
  { value: 'continue', label: '✍️ 续写' },
  { value: 'dialogue', label: '💬 对话优化' },
  { value: 'polish', label: '✨ 润色优化' },
  { value: 'consistency', label: '🔍 一致性检查' },
  { value: 'foreshadow', label: '🎯 伏笔管理' },
  { value: 'anti_ai', label: '🤖 降 AI 味' },
  { value: 'pacing', label: '⏱️ 节奏把控' },
  { value: 'emotion', label: '❤️ 情感曲线' },
  { value: 'scene', label: '🎬 场景扩写' },
  { value: 'name', label: '📛 命名工厂' },
  { value: 'reader', label: '👁️ 读者反馈' }
]

const defaultModelName = computed(() => {
  const m = settingsStore.activeModel
  return m ? `${m.name}（${m.model}）` : '未设置'
})

// 自动填充常用 Base URL
function onProviderChange(): void {
  form.model = ''
  form.apiKey = ''
  testResult.value = null
  fetchedModels.value = []
  if (form.provider === 'ollama') {
    form.baseURL = 'http://localhost:11434/v1'
    form.apiKey = ''
  } else if (form.provider === 'lmstudio') {
    form.baseURL = 'http://localhost:1234/v1'
    form.apiKey = ''
  } else if (form.provider === 'openai') {
    form.baseURL = ''
  } else if (form.provider === 'qwen') {
    form.baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  } else if (form.provider === 'deepseek') {
    form.baseURL = 'https://api.deepseek.com/v1'
  } else if (form.provider === 'doubao') {
    form.baseURL = 'https://ark.cn-beijing.volces.com/api/v3'
  } else if (form.provider === 'GLM') {
    form.baseURL = 'https://open.bigmodel.cn/api/paas/v4'
  }
}

// 监听 provider 变化
watch(() => form.provider, onProviderChange)

/**
 * 测试连通性 + 拉取模型列表
 */
async function testConnection(): Promise<void> {
  // 智能选择模型ID
  let testModelId = form.model || ''
  if (!testModelId) {
    switch (form.provider) {
      case 'openai': testModelId = 'gpt-3.5-turbo'; break
      case 'qwen': testModelId = 'qwen-turbo'; break
      case 'deepseek': testModelId = 'deepseek-chat'; break
      case 'doubao': testModelId = 'doubao-lite-4k'; break
      case 'GLM': testModelId = 'glm-4-flash'; break
      case 'gemini': testModelId = 'gemini-pro'; break
      case 'ollama': testModelId = 'llama2'; break
      case 'lmstudio': testModelId = 'local-model'; break
      default: testModelId = 'gpt-3.5-turbo'
    }
  }
  
  const config: ModelConfig = {
    id: '__test__',
    name: 'test',
    provider: form.provider as LLMProviderType,
    model: testModelId,
    baseURL: form.baseURL || undefined,
    apiKey: form.apiKey || undefined,
    isLocal: isOllamaOrLMStudio.value,
    isDefault: false
  }
  
  testing.value = true
  testResult.value = null
  fetchedModels.value = []
  selectedModels.value = new Set()
  
  try {
    const result = await LLMClient.healthCheck(config)
    testResult.value = result
    if (result.ok && result.models && result.models.length > 0) {
      fetchedModels.value = result.models
      ElMessage.success(`成功获取 ${result.models.length} 个可用模型`)
    } else if (result.ok && (!result.models || result.models.length === 0)) {
      testResult.value = { ok: true, error: '连通性测试成功，但未获取到模型列表。请手动填写模型ID。' }
    }
  } catch (e) {
    testResult.value = { ok: false, error: String(e) }
  } finally {
    testing.value = false
  }
}

/**
 * 保存模型配置
 */
function addModel(): void {
  if (!form.name || !form.model) {
    ElMessage.warning('请填写名称和模型 ID')
    return
  }
  
  const config: ModelConfig = {
    id: crypto.randomUUID(),
    name: form.name,
    provider: form.provider as LLMProviderType,
    model: form.model,
    baseURL: form.baseURL || undefined,
    apiKey: form.apiKey || undefined,
    temperature: 0.7,
    maxTokens: 4096,
    isLocal: isOllamaOrLMStudio.value,
    isDefault: false
  }
  
  settingsStore.addModel(config)
  if (form.apiKey && !config.isLocal) {
    window.electronAPI?.setApiKey(form.provider, form.apiKey)
  }
  
  // 重置表单
  form.name = ''
  form.model = ''
  form.apiKey = ''
  form.baseURL = ''
  testResult.value = null
  fetchedModels.value = []
  
  ElMessage.success('模型保存成功')
}

function setDefault(id: string): void {
  settingsStore.setActiveModel(id)
  ElMessage.success('已设为默认模型')
}

async function removeModel(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('确定删除该模型配置？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    settingsStore.removeModel(id)
    ElMessage.success('模型已删除')
  } catch {
    // 用户取消
  }
}

/**
 * Agent 模型配置变更
 */
function onAgentModelChange(agentType: AgentType, modelId: string): void {
  settingsStore.setAgentModel(agentType, modelId)
  ElMessage.success('Agent 模型配置已更新')
}

function goBack(): void {
  router.push('/settings')
}
</script>
