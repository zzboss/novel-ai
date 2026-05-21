<template>
  <el-dialog 
    v-model="visible" 
    title="全文搜索"
    width="700px"
    :append-to-body="true"
    class="global-search-dialog"
  >
    <!-- 搜索输入 -->
    <div class="mb-4">
      <el-input 
        v-model="searchQuery" 
        placeholder="输入搜索关键词..."
        size="large"
        clearable
        @input="performSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 搜索范围 -->
    <div class="mb-4 flex items-center gap-4">
      <span class="text-sm text-[var(--el-text-color-secondary)]">搜索范围：</span>
      <el-radio-group v-model="searchScope" @change="performSearch">
        <el-radio value="all">全书</el-radio>
        <el-radio value="outline">仅大纲</el-radio>
        <el-radio value="character">仅角色</el-radio>
      </el-radio-group>
    </div>

    <!-- 搜索结果 -->
    <div class="max-h-96 overflow-y-auto">
      <el-empty v-if="results.length === 0 && !searchQuery" description="请输入搜索关键词" :image-size="60" />
      <el-empty v-else-if="results.length === 0 && searchQuery" description="没有找到匹配的结果" :image-size="60" />
      
      <div v-else class="space-y-2">
        <div 
          v-for="(result, index) in results" 
          :key="index"
          class="p-3 border rounded cursor-pointer hover:bg-[var(--el-fill-color-light)]"
          @click="goToResult(result)"
        >
          <div class="flex items-center gap-2 mb-1">
            <el-tag size="small" :type="getScopeTagType(result.scope)">
              {{ getScopeLabel(result.scope) }}
            </el-tag>
            <span class="text-sm font-medium">{{ result.title }}</span>
          </div>
          <div class="text-sm text-[var(--el-text-color-regular)]" v-html="result.highlightedContent"></div>
        </div>
      </div>
    </div>

    <!-- 结果统计 -->
    <div v-if="results.length > 0" class="mt-2 text-sm text-[var(--el-text-color-secondary)]">
      找到 {{ results.length }} 个匹配结果
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useRouter } from 'vue-router'

const projectStore = useProjectStore()
const router = useRouter()

const visible = ref(false)
const searchQuery = ref('')
const searchScope = ref<string>('all')
const results = ref<any[]>([])

interface SearchResult {
  scope: 'chapter' | 'outline' | 'character' | 'world'
  id: string
  title: string
  content: string
  highlightedContent: string
}

/**
 * 显示搜索弹窗
 */
function show(): void {
  visible.value = true
  searchQuery.value = ''
  results.value = []
}

/**
 * 执行搜索
 */
function performSearch(): void {
  if (!searchQuery.value) {
    results.value = []
    return
  }
  
  const query = searchQuery.value.toLowerCase()
  const allResults: SearchResult[] = []
  const project = projectStore.project
  
  // 搜索章节
  if (searchScope.value === 'all' || searchScope.value === 'chapter') {
    const chapters = (project as any).chapters || []
    for (const chapter of chapters) {
      if (chapter.content && chapter.content.toLowerCase().includes(query)) {
        const index = chapter.content.toLowerCase().indexOf(query)
        const start = Math.max(0, index - 30)
        const end = Math.min(chapter.content.length, index + query.length + 30)
        const snippet = chapter.content.substring(start, end)
        const highlighted = snippet.replace(
          new RegExp(query, 'gi'),
          match => `<span class="bg-yellow-200">${match}</span>`
        )
        
        allResults.push({
          scope: 'chapter',
          id: chapter.id,
          title: chapter.title || `第${chapter.chapterNumber}章`,
          content: snippet,
          highlightedContent: highlighted
        })
      }
    }
  }
  
  // 搜索角色
  if (searchScope.value === 'all' || searchScope.value === 'character') {
    const characters = (project as any).characters || []
    for (const char of characters) {
      const searchText = `${char.name} ${char.description || ''} ${char.personality || ''}`.toLowerCase()
      if (searchText.includes(query)) {
        allResults.push({
          scope: 'character',
          id: char.id,
          title: char.name,
          content: char.description || '',
          highlightedContent: char.name
        })
      }
    }
  }
  
  results.value = allResults
}

/**
 * 获取范围标签类型
 */
function getScopeTagType(scope: string): string {
  const map: Record<string, string> = {
    chapter: '',
    outline: 'success',
    character: 'warning',
    world: 'danger'
  }
  return map[scope] || ''
}

/**
 * 获取范围标签文本
 */
function getScopeLabel(scope: string): string {
  const map: Record<string, string> = {
    chapter: '章节',
    outline: '大纲',
    character: '角色',
    world: '世界观'
  }
  return map[scope] || ''
}

/**
 * 跳转到搜索结果
 */
function goToResult(result: SearchResult): void {
  visible.value = false
  
  if (result.scope === 'chapter') {
    router.push(`/editor/${result.id}`)
  } else if (result.scope === 'character') {
    // 跳转到角色页面
  }
}

defineExpose({
  show
})
</script>

<style scoped>
.global-search-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
}
</style>
