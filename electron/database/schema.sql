-- ============================================================
-- AIWT 项目数据库 Schema
-- 每个项目对应一个独立的 SQLite 数据库文件（project.db）
-- 放在项目根目录下
-- ============================================================

-- 项目表（主表，存储项目基本信息）
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'novel',
  creation_version TEXT NOT NULL DEFAULT 'v1.0',
  global_style TEXT DEFAULT '',
  idea TEXT DEFAULT '',
  script_meta TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 世界观设定表
CREATE TABLE IF NOT EXISTS world_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  genre TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  rules TEXT DEFAULT ''
);

-- 世界观地点表
CREATE TABLE IF NOT EXISTS world_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT ''
);

-- 卷表
CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 章节表（通过 volume_id 关联卷，允许 NULL 以保留孤儿章节）
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  volume_id TEXT,
  title TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  outline TEXT DEFAULT '',
  content TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'supporting',
  gender TEXT DEFAULT NULL,
  age INTEGER DEFAULT NULL,
  appearance TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  background TEXT DEFAULT '',
  abilities TEXT DEFAULT '',
  motivation TEXT DEFAULT '',
  arc TEXT DEFAULT '',
  dialogue_style TEXT DEFAULT '',
  description TEXT DEFAULT ''
);

-- 角色关系表
CREATE TABLE IF NOT EXISTS character_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  related_character_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (related_character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- StoryState: 世界当前状态
CREATE TABLE IF NOT EXISTS story_world_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_timeline TEXT DEFAULT '',
  active_conflicts TEXT DEFAULT '[]',
  global_mood TEXT DEFAULT '',
  last_updated_chapter TEXT DEFAULT ''
);

-- StoryState: 角色状态
CREATE TABLE IF NOT EXISTS story_character_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  location TEXT DEFAULT '未知',
  knowledge TEXT DEFAULT '[]',
  inventory TEXT DEFAULT '[]',
  relationships TEXT DEFAULT '{}',
  physical_state TEXT DEFAULT '健康',
  emotional_state TEXT DEFAULT '平静',
  last_appearance TEXT DEFAULT ''
);

-- StoryState: 资源台账
CREATE TABLE IF NOT EXISTS story_resource_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  last_mentioned TEXT DEFAULT ''
);

-- StoryState: 伏笔
CREATE TABLE IF NOT EXISTS story_pending_hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  planted_chapter TEXT DEFAULT '',
  related_characters TEXT DEFAULT '[]',
  status TEXT DEFAULT 'open',
  resolution TEXT DEFAULT '',
  resolved_chapter TEXT DEFAULT '',
  urgency TEXT DEFAULT 'medium'
);

-- StoryState: 章节摘要
CREATE TABLE IF NOT EXISTS story_chapter_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id TEXT NOT NULL,
  summary TEXT DEFAULT '',
  key_events TEXT DEFAULT '[]',
  character_changes TEXT DEFAULT '{}',
  new_hooks TEXT DEFAULT '[]',
  resolved_hooks TEXT DEFAULT '[]',
  word_count INTEGER DEFAULT 0
);

-- StoryState: 情感弧线
CREATE TABLE IF NOT EXISTS story_emotion_trajectory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  emotion TEXT DEFAULT '',
  intensity INTEGER DEFAULT 5
);

-- StoryState: 角色矩阵（信息边界）
CREATE TABLE IF NOT EXISTS story_character_matrix (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_a_id TEXT NOT NULL,
  character_b_id TEXT NOT NULL,
  has_met INTEGER DEFAULT 0,
  shared_knowledge TEXT DEFAULT '[]',
  last_interaction TEXT DEFAULT '',
  UNIQUE(character_a_id, character_b_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chapters_volume_id ON chapters(volume_id);
CREATE INDEX IF NOT EXISTS idx_chapters_sort ON chapters(sort_order);
CREATE INDEX IF NOT EXISTS idx_volumes_sort ON volumes(sort_order);
CREATE INDEX IF NOT EXISTS idx_story_cs_character_id ON story_character_states(character_id);
CREATE INDEX IF NOT EXISTS idx_story_et_character_id ON story_emotion_trajectory(character_id);

-- 初始化标记（用于判断数据库是否已初始化）
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 对话历史表
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  date TEXT NOT NULL,
  session_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 对话历史索引
CREATE INDEX IF NOT EXISTS idx_chat_history_date ON chat_history(date);
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);

-- ============================================================
-- LLM 交互记录表（独立功能，记录完整的大模型交互过程）
-- ============================================================
CREATE TABLE IF NOT EXISTS llm_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interaction_id TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL,  -- 操作类型：generateIdea, modifyIdea, generateWorld, modifyWorld, etc.
  model_provider TEXT NOT NULL,  -- 模型提供商：openai, claude, ollama, custom
  model_name TEXT NOT NULL,      -- 模型名称
  prompt_template_name TEXT,     -- 使用的 prompt 模板名称（可选）
  input_prompt TEXT NOT NULL,    -- 发送给 LLM 的完整 prompt（渲染后的）
  input_parameters TEXT,         -- 输入参数（JSON 格式，可选）
  output_response TEXT NOT NULL, -- LLM 返回的完整响应
  tokens_input INTEGER,          -- 输入 token 数（如果 API 返回）
  tokens_output INTEGER,         -- 输出 token 数（如果 API 返回）
  duration_ms INTEGER,          -- 请求耗时（毫秒）
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'cancelled')),
  error_message TEXT,           -- 如果失败，错误信息
  timestamp INTEGER NOT NULL,    -- 交互发生的时间戳
  date TEXT NOT NULL,           -- 日期（YYYY-MM-DD 格式，便于按日期查询）
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- LLM 交互记录索引
CREATE INDEX IF NOT EXISTS idx_llm_interactions_date ON llm_interactions(date);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_operation ON llm_interactions(operation_type);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp ON llm_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_status ON llm_interactions(status);
