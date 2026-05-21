<template>
  <div class="workbench h-screen flex flex-col bg-[var(--el-bg-color-page)] text-[var(--el-text-color-primary)]">
    <header class="h-12 border-b flex items-center px-4 gap-3 shrink-0" style="border-color: var(--el-border-color)">
      <el-button :icon="ArrowLeft" @click="goHome" text>返回</el-button>
      <el-divider direction="vertical" />
      <span class="text-sm font-medium">{{ projectName }}</span>
      <span class="text-xs text-[var(--el-text-color-placeholder)]">{{ editorWordCount }} 字</span>
      <div class="ml-auto flex gap-2">
        <el-tooltip content="完善设定" placement="bottom"><el-button :icon="Setting" @click="openCreationWizard" text /></el-tooltip>
        <el-tooltip content="专注模式" placement="bottom"><el-button :icon="FullScreen" @click="toggleFocusMode" text /></el-tooltip>
        <el-tooltip content="全文搜索" placement="bottom"><el-button :icon="Search" @click="toggleSearch" text /></el-tooltip>
        <el-tooltip content="保存" placement="bottom"><el-button :icon="Check" @click="saveProject" text /></el-tooltip>
        <el-tooltip content="对话历史" placement="bottom"><el-button :icon="Document" @click="goToChatHistory" text /></el-tooltip>
      </div>
    </header>
    <div class="flex-1 flex overflow-hidden">
      <div ref="leftPanelRef" class="border-r overflow-y-auto shrink-0" style="border-color: var(--el-border-color)" :style="{ width: leftPanelWidth + 'px' }">
        <div class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-[var(--el-text-color-placeholder)]">项目结构</div>
            <el-button size="small" :icon="Plus" circle @click="addChapter" :disabled="!projectStore.project" />
          </div>
          <el-empty v-if="volumes.length === 0" description="暂无章节" :image-size="60" />
          <el-tree v-else :data="treeData" :props="treeProps" default-expand-all :highlight-current="true"
            :expand-on-click-node="false"
            @node-click="onNodeClick" @node-contextmenu="onNodeContextMenu"
            @node-drag-start="onDragStart" @node-drag-end="onDragEnd" draggable>
            <template #default="{ data }">
              <span class="text-sm flex-1 flex items-center justify-between group"
                :draggable="data.type === 'character' || data.type === 'world'">
                <span v-if="data.type === 'chapter'" class="flex-1 flex items-center gap-1">
                  <el-icon class="mr-1"><Document /></el-icon>
                  <el-input v-if="editingChapterId === data.id" :ref="(el: any) => setEditInputRef(data.id, el)"
                    v-model="editingTitle" size="small" class="inline-edit-input"
                    @keyup.enter="confirmTitleEdit(data.id)" @blur="confirmTitleEdit(data.id)" />
                  <span v-else class="flex-1 cursor-pointer" @dblclick="startTitleEdit(data)">{{ data.label }}</span>
                  <el-button v-if="!editingChapterId" size="small" :icon="EditPen" circle
                    class="opacity-0 group-hover:opacity-100 transition-opacity ml-1" @click.stop="startTitleEdit(data)" />
                </span>
                <span v-else>
                  <el-icon v-if="data.type === 'character'" class="mr-1"><Avatar /></el-icon>
                  <el-icon v-else class="mr-1"><FolderOpened /></el-icon>
                  {{ data.label }}
                </span>
                <el-button v-if="data.type === 'chapter' && !editingChapterId" size="small" :icon="Delete" circle
                  class="opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop="deleteChapter(data.id, data.label)" />
              </span>
            </template>
          </el-tree>
        </div>
      </div>
      <div class="w-1 cursor-col-resize hover:bg-[var(--el-color-primary)] transition-colors shrink-0"
        @mousedown="startLeftResize" />
      <el-main class="overflow-hidden flex flex-col p-0" @dragover="onDragOver" @drop="onDrop">
        <!-- 灵感面板 -->
        <IdeaPanel v-if="selectedNodeType === 'idea'" />
        <!-- 世界观面板 -->
        <WorldEditor v-else-if="selectedNodeType === 'world'" />
        <!-- 角色列表面板 -->
        <CharacterListView v-else-if="selectedNodeType === 'characters'" @select="onCharacterSelect" />
        <!-- 角色详情面板 -->
        <CharacterEditor v-else-if="selectedNodeType === 'character'" :character-id="selectedNodeId" @update:characterId="onCharacterIdUpdate" />
        <!-- 卷编辑面板 -->
        <VolumeEditor v-else-if="selectedNodeType === 'volume'" />
        <!-- 模型记录面板 -->
        <ChatHistoryPanel v-else-if="selectedNodeType === 'chat-history'" />
        <!-- LLM 交互记录面板 -->
        <LLMInteractionPanel v-else-if="selectedNodeType === 'llm-interaction'" />
        <!-- 当前状态面板 -->
        <CurrentStatePanel v-else-if="selectedNodeType === 'current-state'" />
        <!-- 章节编辑器（选中章节或默认） -->
        <template v-else>
          <ChapterEditor ref="chapterEditorRef" :content="editorContent" :editable="!isStreaming"
            @update="onEditorUpdate" @ready="onEditorReady" />
          <div v-if="isStreaming" class="h-8 border-t flex items-center px-4 text-xs"
            style="border-color: var(--el-border-color); color: var(--el-color-primary)">
            <el-icon class="is-loading mr-2"><Loading /></el-icon>
            <span>{{ agentStore.pipelineProgress || 'AI 正在生成...' }}</span>
            <el-button class="ml-auto" type="danger" link size="small" @click="stopStreaming">停止</el-button>
          </div>
        </template>
      </el-main>
      <FocusMode v-if="focusModeVisible" :content="editorContent"
        :chapter-title="currentChapterId || '未选择章节'" @exit="focusModeVisible = false" @save="onFocusModeSave" />
      <GlobalSearch v-if="globalSearchVisible" @close="globalSearchVisible = false" />
      <div class="w-1 cursor-col-resize hover:bg-[var(--el-color-primary)] transition-colors shrink-0"
        @mousedown="startRightResize" />
      <div ref="rightPanelRef" class="shrink-0" :style="{ width: rightPanelWidth + 'px' }">
        <ChatAssistant :is-executing="isStreaming" :executing-agent-name="executingAgentName"
          @run-agent="runAgent" @stop-agent="stopStreaming" />
      </div>
    </div>
    <AddChapterDialog v-model="addChapterDialogVisible" :volumes="volumeInfos"
      :default-volume-id="defaultVolumeId" @confirm="onAddChapterConfirm" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { ArrowLeft, FullScreen, Search, Check, Document, FolderOpened, Loading, Plus, Delete, Setting, EditPen, Avatar } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import ChapterEditor from '@/components/ChapterEditor.vue'
import FocusMode from '@/components/FocusMode.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import AddChapterDialog from '@/components/AddChapterDialog.vue'
import ChatAssistant from '@/components/ChatAssistant.vue'
import IdeaPanel from './IdeaPanel.vue'
import WorldEditor from '@/components/WorldEditor.vue'
import CharacterEditor from '@/components/CharacterEditor.vue'
import CharacterListView from '@/components/CharacterListView.vue'
import VolumeEditor from '@/components/VolumeEditor.vue'
import ChatHistoryPanel from './ChatHistoryPanel.vue'
import CurrentStatePanel from './CurrentStatePanel.vue'
import LLMInteractionPanel from './LLMInteractionPanel.vue'
import { usePanelResize } from './usePanelResize'
import { useChapterManager } from './useChapterManager'
import { useEditorManager } from './useEditorManager'
import { useAgentRunner } from './useAgentRunner'
import { useProjectTree } from './useProjectTree'
import { useDragDrop } from './useDragDrop'

const projectStore = useProjectStore()
const agentStore = useAgentStore()
const currentChapterId = computed(() => projectStore.currentChapterId)
const projectName = computed(() => projectStore.project?.name || '未命名项目')
const volumes = computed(() => projectStore.project?.volumes || [])

const { leftPanelWidth, rightPanelWidth, leftPanelRef, rightPanelRef, startLeftResize, startRightResize } = usePanelResize()
const { editorContent, editorWordCount, chapterEditorRef, onEditorReady, onEditorUpdate, onFocusModeSave, tipTapEditor } = useEditorManager({ projectStore, agentStore, currentChapterId })
const { isStreaming, executingAgentName, runAgent, stopStreaming } = useAgentRunner({ projectStore, agentStore, chapterEditorRef, tipTapEditor } as any)
const { treeData, treeProps, selectedNodeType, selectedNodeId, editingChapterId, editingTitle, editInputRefs, focusModeVisible, globalSearchVisible, setEditInputRef, startTitleEdit, confirmTitleEdit, handleNodeClick: onTreeClick, onNodeContextMenu, openCreationWizard, goHome, goToChatHistory, toggleFocusMode, toggleSearch } = useProjectTree({ projectStore: projectStore, editorContent })
const { selectChapter, saveCurrentChapterContent, addChapter, deleteChapter, onAddChapterConfirm, saveProject, volumeInfos, defaultVolumeId, addChapterDialogVisible } = useChapterManager({ projectStore, chapterEditorRef, editorContent, editorWordCount, currentChapterId })
const { onDragStart, onDragEnd, onDragOver, onDrop } = useDragDrop({ projectStore, tipTapEditor } as any)

function onNodeClick(data: any): void {
  onTreeClick(data)
  if (data.type === 'chapter') selectChapter(data.id)
}

function onCharacterIdUpdate(newId: string): void {
  if (!newId) {
    selectedNodeType.value = ''
    selectedNodeId.value = ''
  }
}

function onCharacterSelect(characterId: string): void {
  selectedNodeType.value = 'character'
  selectedNodeId.value = characterId
}

onBeforeUnmount(() => {
  saveCurrentChapterContent()
  projectStore.stopAutoSave()
})
</script>
