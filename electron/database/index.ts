/**
 * 数据库连接管理层
 *
 * 使用 sql.js（WebAssembly 版 SQLite，纯 JS，无需编译）
 * 每个项目对应一个独立的 .db 文件，存放在项目根目录下
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

// ==================== sql.js 初始化 ====================

let sqlJsInstance: SqlJsStatic | null = null
let sqlJsInitPromise: Promise<SqlJsStatic> | null = null

/**
 * 初始化 sql.js（单例模式，避免重复加载 WASM）
 */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsInstance) return sqlJsInstance
  if (sqlJsInitPromise) return sqlJsInitPromise

  sqlJsInitPromise = initSqlJs({
    locateFile: (file: string) => {
      // 方法1：开发/编译后均有效的路径（相对 __dirname）
      const localPath = join(__dirname, '../../node_modules/sql.js/dist/', file)
      if (existsSync(localPath)) {
        return localPath
      }
      // 方法2：从 app.getAppPath() 查找
      const appPath = join(app.getAppPath(), '../node_modules/sql.js/dist/', file)
      if (existsSync(appPath)) {
        return appPath
      }
      // 方法3：从 process.cwd() 查找（开发模式）
      const cwdPath = join(process.cwd(), 'node_modules/sql.js/dist/', file)
      if (existsSync(cwdPath)) {
        return cwdPath
      }
      // 生产环境：从 resources 目录查找
      return join(process.resourcesPath || app.getAppPath(), file)
    }
  }).then((SQL) => {
    sqlJsInstance = SQL
    return SQL
  })

  return sqlJsInitPromise
}

// ==================== 数据库文件操作 ====================

/**
 * 获取项目数据库文件路径
 * @param projectPath - 项目根目录路径
 * @returns 数据库文件完整路径
 */
export function getDatabasePath(projectPath: string): string {
  return join(projectPath, 'project.db')
}

/**
 * 判断项目数据库是否已存在
 * @param projectPath - 项目根目录路径
 */
export function databaseExists(projectPath: string): boolean {
  return existsSync(getDatabasePath(projectPath))
}

/**
 * 加载已有数据库文件
 * @param projectPath - 项目根目录路径
 * @returns 初始化的 Database 对象
 */
export async function loadDatabase(projectPath: string): Promise<Database> {
  const dbPath = getDatabasePath(projectPath)

  if (!existsSync(dbPath)) {
    throw new Error(`数据库文件不存在: ${dbPath}`)
  }

  const SQL = await getSqlJs()
  const buffer = readFileSync(dbPath)
  const db = new SQL.Database(new Uint8Array(buffer))

  let needsSave = false

  // 迁移：检查并添加 volumes 表的 content 列
  try {
    const cols = queryAll(db, `PRAGMA table_info(volumes)`)
    const hasContent = cols.some(r => r.name === 'content')
    if (!hasContent) {
      db.exec(`ALTER TABLE volumes ADD COLUMN content TEXT DEFAULT ''`)
      console.log('[Database] 迁移完成：volumes 表已添加 content 列')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] 迁移检查失败:', e)
  }

  // 迁移：检查并修复 chat_history 表
  try {
    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chat_history'`)

    if (tableExists.length === 0) {
      // 表不存在，直接创建
      db.exec(`
        CREATE TABLE chat_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          date TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
      `)
    } else {
      // 表存在，测试约束是否正确
      try {
        const testId = `test-${Date.now()}`
        run(db, `INSERT INTO chat_history (message_id, role, content, timestamp, date) VALUES (?, ?, ?, ?, ?)`,
          [testId, 'assistant', 'test', Date.now(), new Date().toISOString().split('T')[0]])
        run(db, `DELETE FROM chat_history WHERE message_id = ?`, [testId])
      } catch (e) {
        // 约束错误，重建表
        console.log('[Database] 检测到 chat_history 表约束错误，正在重建...')

        db.exec(`CREATE TABLE chat_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          date TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )`)

        db.exec(`INSERT INTO chat_history_new SELECT * FROM chat_history`)
        db.exec(`DROP TABLE chat_history`)
        db.exec(`ALTER TABLE chat_history_new RENAME TO chat_history`)

        console.log('[Database] chat_history 表重建完成')
        needsSave = true
      }
    }

    // 创建索引（如果不存在）
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_date ON chat_history(date);
      CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);
    `)

  } catch (e) {
    console.error('[Database] chat_history 表迁移检查失败:', e)
  }

  // 迁移：检查并创建 llm_interactions 表
  try {
    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='llm_interactions'`)

    if (tableExists.length === 0) {
      // 表不存在，创建
      db.exec(`
        CREATE TABLE llm_interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          interaction_id TEXT NOT NULL UNIQUE,
          operation_type TEXT NOT NULL,
          model_provider TEXT NOT NULL,
          model_name TEXT NOT NULL,
          prompt_template_name TEXT,
          input_prompt TEXT NOT NULL,
          input_parameters TEXT,
          output_response TEXT NOT NULL,
          tokens_input INTEGER,
          tokens_output INTEGER,
          duration_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'cancelled')),
          error_message TEXT,
          timestamp INTEGER NOT NULL,
          date TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_llm_interactions_date ON llm_interactions(date);
        CREATE INDEX IF NOT EXISTS idx_llm_interactions_operation ON llm_interactions(operation_type);
        CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp ON llm_interactions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_llm_interactions_status ON llm_interactions(status);
      `)

      console.log('[Database] llm_interactions 表创建完成')
      needsSave = true
    } else {
      console.log('[Database] llm_interactions 表已存在')
    }
  } catch (e) {
    console.error('[Database] llm_interactions 表迁移检查失败:', e)
  }

  // 迁移：检查并添加 chapters 表的 outline 列
  try {
    const cols = queryAll(db, `PRAGMA table_info(chapters)`)
    const hasOutline = cols.some((r: any) => r.name === 'outline')
    if (!hasOutline) {
      db.exec(`ALTER TABLE chapters ADD COLUMN outline TEXT DEFAULT ''`)
      console.log('[Database] 迁移完成：chapters 表已添加 outline 列')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] chapters.outline 迁移检查失败:', e)
  }

  // 迁移：检查并创建记忆相关表
  try {
    // 检查 memories 表是否存在
    const memoriesTableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='memories'`)
    
    if (memoriesTableExists.length === 0) {
      // 表不存在，创建记忆相关表
      console.log('[Database] 开始创建记忆相关表...')
      
      // 创建 memories 表
      db.exec(`
        CREATE TABLE memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          memory_type TEXT NOT NULL CHECK(memory_type IN ('short', 'medium', 'long', 'meta')),
          content TEXT NOT NULL,
          content_type TEXT NOT NULL,
          chapter_id TEXT,
          character_id TEXT,
          importance INTEGER NOT NULL DEFAULT 5,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          access_count INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (chapter_id) REFERENCES chapters(id),
          FOREIGN KEY (character_id) REFERENCES characters(id)
        )
      `)
      
      // 创建记忆访问日志表
      db.exec(`
        CREATE TABLE memory_access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_id INTEGER NOT NULL,
          access_type TEXT NOT NULL CHECK(access_type IN ('read', 'write', 'update')),
          accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          context TEXT,
          FOREIGN KEY (memory_id) REFERENCES memories(id)
        )
      `)
      
      // 创建索引
      db.exec(`
        CREATE INDEX idx_memories_project_id ON memories(project_id);
        CREATE INDEX idx_memories_memory_type ON memories(memory_type);
        CREATE INDEX idx_memories_content_type ON memories(content_type);
        CREATE INDEX idx_memories_chapter_id ON memories(chapter_id);
        CREATE INDEX idx_memories_character_id ON memories(character_id);
        CREATE INDEX idx_memories_importance ON memories(importance);
        CREATE INDEX idx_memories_last_accessed ON memories(last_accessed_at);
        CREATE INDEX idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
      `)
      
      console.log('[Database] 记忆相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 记忆相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 记忆相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建角色关系图相关表
  try {
    const tablesExist = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='character_graphs'`)

    if (tablesExist.length === 0) {
      console.log('[Database] 开始创建角色关系图相关表...')

      // 创建 character_graphs 表
      db.exec(`
        CREATE TABLE character_graphs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL DEFAULT '默认关系图',
          description TEXT DEFAULT '',
          layout_type TEXT NOT NULL DEFAULT 'force',
          show_labels INTEGER NOT NULL DEFAULT 1,
          show_icons INTEGER NOT NULL DEFAULT 1,
          highlight_on_hover INTEGER NOT NULL DEFAULT 1,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)

      // 创建 character_graph_nodes 表
      db.exec(`
        CREATE TABLE character_graph_nodes (
          id TEXT PRIMARY KEY,
          graph_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          x REAL DEFAULT NULL,
          y REAL DEFAULT NULL,
          fixed INTEGER DEFAULT 0,
          color TEXT DEFAULT NULL,
          size REAL DEFAULT 60,
          icon TEXT DEFAULT NULL,
          border_color TEXT DEFAULT NULL,
          border_width REAL DEFAULT 2,
          font_color TEXT DEFAULT '#FFFFFF',
          font_size REAL DEFAULT 14,
          collapsed INTEGER DEFAULT 0,
          hidden INTEGER DEFAULT 0,
          FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        )
      `)

      // 创建 character_graph_edges 表
      db.exec(`
        CREATE TABLE character_graph_edges (
          id TEXT PRIMARY KEY,
          graph_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation_type TEXT NOT NULL DEFAULT 'custom',
          relation_label TEXT NOT NULL DEFAULT '',
          description TEXT DEFAULT '',
          directed INTEGER NOT NULL DEFAULT 1,
          bidirectional INTEGER NOT NULL DEFAULT 0,
          color TEXT DEFAULT NULL,
          line_width REAL DEFAULT 2,
          line_style TEXT DEFAULT 'solid',
          label_position TEXT DEFAULT 'middle',
          hidden INTEGER DEFAULT 0,
          weight REAL DEFAULT 5,
          FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
        )
      `)

      // 创建索引
      db.exec(`
        CREATE INDEX idx_character_graph_nodes_graph_id ON character_graph_nodes(graph_id);
        CREATE INDEX idx_character_graph_nodes_character_id ON character_graph_nodes(character_id);
        CREATE INDEX idx_character_graph_edges_graph_id ON character_graph_edges(graph_id);
        CREATE INDEX idx_character_graph_edges_source_id ON character_graph_edges(source_id);
        CREATE INDEX idx_character_graph_edges_target_id ON character_graph_edges(target_id);
      `)

      console.log('[Database] 角色关系图相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 角色关系图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 角色关系图相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建 chapter_outlines 表
  try {
    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_outlines'`)
    if (tableExists.length === 0) {
      db.exec(`
        CREATE TABLE chapter_outlines (
          id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL UNIQUE,
          core_goal TEXT DEFAULT '',
          plot_progression TEXT DEFAULT '',
          character_development TEXT DEFAULT '',
          overall_foreshadowing TEXT DEFAULT '[]',
          overall_twists TEXT DEFAULT '[]',
          next_chapter_hook TEXT DEFAULT '',
          scenes TEXT DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )
      `)
      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)
      console.log('[Database] chapter_outlines 表创建完成')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] chapter_outlines 表迁移检查失败:', e)
  }

  // 迁移：检查并创建地图相关表
  try {
    const tablesExist = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='maps'`)

    if (tablesExist.length === 0) {
      console.log('[Database] 开始创建地图相关表...')

      db.exec(`
        CREATE TABLE maps (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE TABLE locations (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          x REAL DEFAULT 0,
          y REAL DEFAULT 0,
          color TEXT DEFAULT NULL,
          size REAL DEFAULT 30,
          icon TEXT DEFAULT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE TABLE location_relationships (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation_type TEXT NOT NULL DEFAULT 'custom',
          relation_label TEXT NOT NULL DEFAULT '',
          description TEXT DEFAULT '',
          color TEXT DEFAULT NULL,
          line_width REAL DEFAULT 2,
          line_style TEXT DEFAULT 'solid',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES locations(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES locations(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE INDEX idx_maps_project_id ON maps(project_id);
        CREATE INDEX idx_locations_map_id ON locations(map_id);
        CREATE INDEX idx_location_relationships_map_id ON location_relationships(map_id);
        CREATE INDEX idx_location_relationships_source_id ON location_relationships(source_id);
        CREATE INDEX idx_location_relationships_target_id ON location_relationships(target_id);
      `)

      console.log('[Database] 地图相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 地图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 地图相关表迁移检查失败:', e)
  }

  // 如果执行了迁移，立即保存到文件
  if (needsSave) {
    saveDatabase(projectPath, db)
  }

  return db
}

/**
 * 创建新数据库（初始化 Schema）
 * @param projectPath - 项目根目录路径
 * @returns 初始化的 Database 对象
 */
export async function createDatabase(projectPath: string): Promise<Database> {
  const SQL = await getSqlJs()
  const db = new SQL.Database()

  // 读取 schema.sql 并初始化
  // 注意：这里直接将 schema SQL 内联，避免 ?raw 导入问题
  const schemaSql = getSchemaSQL()
  db.exec(schemaSql)

  // 保存到文件
  saveDatabase(projectPath, db)

  return db
}

/**
 * 保存数据库到文件
 * @param projectPath - 项目根目录路径
 * @param db - Database 对象
 */
export function saveDatabase(projectPath: string, db: Database): void {
  const dbPath = getDatabasePath(projectPath)

  // 确保目录存在
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

/**
 * 获取项目的数据库（不存在则创建）
 * @param projectPath - 项目根目录路径
 * @returns 数据库对象和操作辅助方法
 */
export async function getDatabase(projectPath: string): Promise<{
  db: Database
  close: () => void
  save: () => void
}> {
  const dbPath = getDatabasePath(projectPath)

  let db: Database
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    const SQL = await getSqlJs()
    db = new SQL.Database(new Uint8Array(buffer))
  } else {
    db = await createDatabase(projectPath)
  }

  // 迁移：检查并添加 volumes 表的 content 列
  let needsSave = false
  try {
    const cols = queryAll(db, `PRAGMA table_info(volumes)`)
    const hasContent = cols.some(r => r.name === 'content')
    if (!hasContent) {
      db.exec(`ALTER TABLE volumes ADD COLUMN content TEXT DEFAULT ''`)
      console.log('[Database] 迁移完成：volumes 表已添加 content 列')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] 迁移检查失败:', e)
  }

  // 迁移：检查并修复 chat_history 表
  try {
    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chat_history'`)
    
    if (tableExists.length === 0) {
      // 表不存在，直接创建
      db.exec(`
        CREATE TABLE chat_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          date TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )
      `)
    } else {
      // 表存在，测试约束是否正确
      try {
        const testId = `test-${Date.now()}`
        run(db, `INSERT INTO chat_history (message_id, role, content, timestamp, date) VALUES (?, ?, ?, ?, ?)`, 
          [testId, 'assistant', 'test', Date.now(), new Date().toISOString().split('T')[0]])
        run(db, `DELETE FROM chat_history WHERE message_id = ?`, [testId])
      } catch (e) {
        // 约束错误，重建表
        console.log('[Database] 检测到 chat_history 表约束错误，正在重建...')
        
        db.exec(`CREATE TABLE chat_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          date TEXT NOT NULL,
          session_id TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )`)
        
        db.exec(`INSERT INTO chat_history_new SELECT * FROM chat_history`)
        db.exec(`DROP TABLE chat_history`)
        db.exec(`ALTER TABLE chat_history_new RENAME TO chat_history`)
        
        console.log('[Database] chat_history 表重建完成')
      }
    }
    
    // 创建索引（如果不存在）
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_date ON chat_history(date);
      CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);
    `)
    
    needsSave = true
  } catch (e) {
    console.error('[Database] chat_history 表迁移检查失败:', e)
  }

  // 迁移：检查并添加 chapters 表的 outline 列
  try {
    const cols = queryAll(db, `PRAGMA table_info(chapters)`)
    const hasOutline = cols.some((r: any) => r.name === 'outline')
    if (!hasOutline) {
      db.exec(`ALTER TABLE chapters ADD COLUMN outline TEXT DEFAULT ''`)
      console.log('[Database] 迁移完成：chapters 表已添加 outline 列')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] chapters.outline 迁移检查失败:', e)
  }

  // 迁移：检查并创建记忆相关表
  try {
    // 检查 memories 表是否存在
    const memoriesTableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='memories'`)
    
    if (memoriesTableExists.length === 0) {
      // 表不存在，创建记忆相关表
      console.log('[Database] 开始创建记忆相关表...')
      
      // 创建 memories 表
      db.exec(`
        CREATE TABLE memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          memory_type TEXT NOT NULL CHECK(memory_type IN ('short', 'medium', 'long', 'meta')),
          content TEXT NOT NULL,
          content_type TEXT NOT NULL,
          chapter_id TEXT,
          character_id TEXT,
          importance INTEGER NOT NULL DEFAULT 5,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          access_count INTEGER NOT NULL DEFAULT 0,
          metadata TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id),
          FOREIGN KEY (chapter_id) REFERENCES chapters(id),
          FOREIGN KEY (character_id) REFERENCES characters(id)
        )
      `)
      
      // 创建记忆访问日志表
      db.exec(`
        CREATE TABLE memory_access_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_id INTEGER NOT NULL,
          access_type TEXT NOT NULL CHECK(access_type IN ('read', 'write', 'update')),
          accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          context TEXT,
          FOREIGN KEY (memory_id) REFERENCES memories(id)
        )
      `)
      
      // 创建索引
      db.exec(`
        CREATE INDEX idx_memories_project_id ON memories(project_id);
        CREATE INDEX idx_memories_memory_type ON memories(memory_type);
        CREATE INDEX idx_memories_content_type ON memories(content_type);
        CREATE INDEX idx_memories_chapter_id ON memories(chapter_id);
        CREATE INDEX idx_memories_character_id ON memories(character_id);
        CREATE INDEX idx_memories_importance ON memories(importance);
        CREATE INDEX idx_memories_last_accessed ON memories(last_accessed_at);
        CREATE INDEX idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
      `)
      
      console.log('[Database] 记忆相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 记忆相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 记忆相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建角色关系图相关表
  try {
    const tablesExist = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='character_graphs'`)

    if (tablesExist.length === 0) {
      console.log('[Database] 开始创建角色关系图相关表...')

      // 创建 character_graphs 表
      db.exec(`
        CREATE TABLE character_graphs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL DEFAULT '默认关系图',
          description TEXT DEFAULT '',
          layout_type TEXT NOT NULL DEFAULT 'force',
          show_labels INTEGER NOT NULL DEFAULT 1,
          show_icons INTEGER NOT NULL DEFAULT 1,
          highlight_on_hover INTEGER NOT NULL DEFAULT 1,
          version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `)

      // 创建 character_graph_nodes 表
      db.exec(`
        CREATE TABLE character_graph_nodes (
          id TEXT PRIMARY KEY,
          graph_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          x REAL DEFAULT NULL,
          y REAL DEFAULT NULL,
          fixed INTEGER DEFAULT 0,
          color TEXT DEFAULT NULL,
          size REAL DEFAULT 60,
          icon TEXT DEFAULT NULL,
          border_color TEXT DEFAULT NULL,
          border_width REAL DEFAULT 2,
          font_color TEXT DEFAULT '#FFFFFF',
          font_size REAL DEFAULT 14,
          collapsed INTEGER DEFAULT 0,
          hidden INTEGER DEFAULT 0,
          FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        )
      `)

      // 创建 character_graph_edges 表
      db.exec(`
        CREATE TABLE character_graph_edges (
          id TEXT PRIMARY KEY,
          graph_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation_type TEXT NOT NULL DEFAULT 'custom',
          relation_label TEXT NOT NULL DEFAULT '',
          description TEXT DEFAULT '',
          directed INTEGER NOT NULL DEFAULT 1,
          bidirectional INTEGER NOT NULL DEFAULT 0,
          color TEXT DEFAULT NULL,
          line_width REAL DEFAULT 2,
          line_style TEXT DEFAULT 'solid',
          label_position TEXT DEFAULT 'middle',
          hidden INTEGER DEFAULT 0,
          weight REAL DEFAULT 5,
          FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
        )
      `)

      // 创建索引
      db.exec(`
        CREATE INDEX idx_character_graph_nodes_graph_id ON character_graph_nodes(graph_id);
        CREATE INDEX idx_character_graph_nodes_character_id ON character_graph_nodes(character_id);
        CREATE INDEX idx_character_graph_edges_graph_id ON character_graph_edges(graph_id);
        CREATE INDEX idx_character_graph_edges_source_id ON character_graph_edges(source_id);
        CREATE INDEX idx_character_graph_edges_target_id ON character_graph_edges(target_id);
      `)

      console.log('[Database] 角色关系图相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 角色关系图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 角色关系图相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建地图相关表
  try {
    const tablesExist = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='maps'`)

    if (tablesExist.length === 0) {
      console.log('[Database] 开始创建地图相关表...')

      db.exec(`
        CREATE TABLE maps (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE TABLE locations (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          x REAL DEFAULT 0,
          y REAL DEFAULT 0,
          color TEXT DEFAULT NULL,
          size REAL DEFAULT 30,
          icon TEXT DEFAULT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE TABLE location_relationships (
          id TEXT PRIMARY KEY,
          map_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation_type TEXT NOT NULL DEFAULT 'custom',
          relation_label TEXT NOT NULL DEFAULT '',
          description TEXT DEFAULT '',
          color TEXT DEFAULT NULL,
          line_width REAL DEFAULT 2,
          line_style TEXT DEFAULT 'solid',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES locations(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES locations(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE INDEX idx_maps_project_id ON maps(project_id);
        CREATE INDEX idx_locations_map_id ON locations(map_id);
        CREATE INDEX idx_location_relationships_map_id ON location_relationships(map_id);
        CREATE INDEX idx_location_relationships_source_id ON location_relationships(source_id);
        CREATE INDEX idx_location_relationships_target_id ON location_relationships(target_id);
      `)

      console.log('[Database] 地图相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 地图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 地图相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建 chapter_outlines 表
  try {
    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_outlines'`)
    if (tableExists.length === 0) {
      db.exec(`
        CREATE TABLE chapter_outlines (
          id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL UNIQUE,
          core_goal TEXT DEFAULT '',
          plot_progression TEXT DEFAULT '',
          character_development TEXT DEFAULT '',
          overall_foreshadowing TEXT DEFAULT '[]',
          overall_twists TEXT DEFAULT '[]',
          next_chapter_hook TEXT DEFAULT '',
          scenes TEXT DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )
      `)
      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)
      console.log('[Database] chapter_outlines 表创建完成')
      needsSave = true
    }
  } catch (e) {
    console.error('[Database] chapter_outlines 表迁移检查失败:', e)
  }
  
  // 如果执行了迁移，立即保存到文件
  if (needsSave) {
    saveDatabase(projectPath, db)
  }

  return {
    db,
    close: () => {
      db.close()
    },
    save: () => {
      saveDatabase(projectPath, db)
    }
  }
}

// ==================== Schema SQL ====================

/**
 * 获取 Schema 初始化 SQL
 * 直接内联 SQL，避免构建工具问题
 */
function getSchemaSQL(): string {
  return `
-- 项目表（单例，id 固定为 1）
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

-- 世界观设定表（单例）
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
  content TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  volume_id TEXT,
  title TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  content TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
);

-- 章节细纲表（结构化存储）
CREATE TABLE IF NOT EXISTS chapter_outlines (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL UNIQUE,
  core_goal TEXT DEFAULT '',
  plot_progression TEXT DEFAULT '',
  character_development TEXT DEFAULT '',
  overall_foreshadowing TEXT DEFAULT '[]',
  overall_twists TEXT DEFAULT '[]',
  next_chapter_hook TEXT DEFAULT '',
  scenes TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id);

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

-- 元数据表（用于版本控制）
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chapters_volume_id ON chapters(volume_id);
CREATE INDEX IF NOT EXISTS idx_chapters_sort ON chapters(sort_order);
CREATE INDEX IF NOT EXISTS idx_volumes_sort ON volumes(sort_order);
CREATE INDEX IF NOT EXISTS idx_story_cs_character_id ON story_character_states(character_id);
CREATE INDEX IF NOT EXISTS idx_story_et_character_id ON story_emotion_trajectory(character_id);

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

-- LLM 交互记录表
CREATE TABLE IF NOT EXISTS llm_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interaction_id TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_template_name TEXT,
  input_prompt TEXT NOT NULL,
  input_parameters TEXT,
  output_response TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'cancelled')),
  error_message TEXT,
  timestamp INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_interactions_date ON llm_interactions(date);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_operation ON llm_interactions(operation_type);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp ON llm_interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_llm_interactions_status ON llm_interactions(status);

    -- LLM 交互记录表索引
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_date ON llm_interactions(date);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_operation ON llm_interactions(operation_type);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_timestamp ON llm_interactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_status ON llm_interactions(status);
    
    -- 记忆表（存储所有层级的记忆）
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      memory_type TEXT NOT NULL CHECK(memory_type IN ('short', 'medium', 'long', 'meta')),
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      chapter_id TEXT,
      character_id TEXT,
      importance INTEGER NOT NULL DEFAULT 5,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );
    
    -- 记忆访问日志表（用于分析记忆访问模式）
    CREATE TABLE IF NOT EXISTS memory_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id INTEGER NOT NULL,
      access_type TEXT NOT NULL CHECK(access_type IN ('read', 'write', 'update')),
      accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      context TEXT,
      FOREIGN KEY (memory_id) REFERENCES memories(id)
    );
    
    -- 记忆表索引
    CREATE INDEX IF NOT EXISTS idx_memories_project_id ON memories(project_id);
    CREATE INDEX IF NOT EXISTS idx_memories_memory_type ON memories(memory_type);
    CREATE INDEX IF NOT EXISTS idx_memories_content_type ON memories(content_type);
    CREATE INDEX IF NOT EXISTS idx_memories_chapter_id ON memories(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_memories_character_id ON memories(character_id);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
    CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed_at);
    CREATE INDEX IF NOT EXISTS idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
    
    -- 初始化元数据
    INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '1');
    INSERT OR IGNORE INTO _meta (key, value) VALUES ('created_at', '${Date.now()}');
    
    -- 角色关系图表
    CREATE TABLE IF NOT EXISTS character_graphs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL DEFAULT '默认关系图',
      description TEXT DEFAULT '',
      layout_type TEXT NOT NULL DEFAULT 'force',
      show_labels INTEGER NOT NULL DEFAULT 1,
      show_icons INTEGER NOT NULL DEFAULT 1,
      highlight_on_hover INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 角色关系图节点表
    CREATE TABLE IF NOT EXISTS character_graph_nodes (
      id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      x REAL DEFAULT NULL,
      y REAL DEFAULT NULL,
      fixed INTEGER DEFAULT 0,
      color TEXT DEFAULT NULL,
      size REAL DEFAULT 60,
      icon TEXT DEFAULT NULL,
      border_color TEXT DEFAULT NULL,
      border_width REAL DEFAULT 2,
      font_color TEXT DEFAULT '#FFFFFF',
      font_size REAL DEFAULT 14,
      collapsed INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    -- 角色关系图边表
    CREATE TABLE IF NOT EXISTS character_graph_edges (
      id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'custom',
      relation_label TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      directed INTEGER NOT NULL DEFAULT 1,
      bidirectional INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT NULL,
      line_width REAL DEFAULT 2,
      line_style TEXT DEFAULT 'solid',
      label_position TEXT DEFAULT 'middle',
      hidden INTEGER DEFAULT 0,
      weight REAL DEFAULT 5,
      FOREIGN KEY (graph_id) REFERENCES character_graphs(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    -- 角色关系图索引
    CREATE INDEX IF NOT EXISTS idx_character_graph_nodes_graph_id ON character_graph_nodes(graph_id);
    CREATE INDEX IF NOT EXISTS idx_character_graph_nodes_character_id ON character_graph_nodes(character_id);
    CREATE INDEX IF NOT EXISTS idx_character_graph_edges_graph_id ON character_graph_edges(graph_id);
    CREATE INDEX IF NOT EXISTS idx_character_graph_edges_source_id ON character_graph_edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_character_graph_edges_target_id ON character_graph_edges(target_id);

    -- 地图功能相关表
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      color TEXT DEFAULT NULL,
      size REAL DEFAULT 30,
      icon TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS location_relationships (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'custom',
      relation_label TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      color TEXT DEFAULT NULL,
      line_width REAL DEFAULT 2,
      line_style TEXT DEFAULT 'solid',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES locations(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES locations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_maps_project_id ON maps(project_id);
    CREATE INDEX IF NOT EXISTS idx_locations_map_id ON locations(map_id);
    CREATE INDEX IF NOT EXISTS idx_location_relationships_map_id ON location_relationships(map_id);
    CREATE INDEX IF NOT EXISTS idx_location_relationships_source_id ON location_relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_location_relationships_target_id ON location_relationships(target_id);
  `
}

// ==================== 辅助函数 ====================

/**
 * 将 params 中的 undefined 替换为 null
 * sql.js 不接受 undefined 作为绑定值
 */
function sanitizeParams(params: any[]): any[] {
  return params.map(p => p === undefined ? null : p)
}

/**
 * 执行查询并返回所有结果
 */
export function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql)
  stmt.bind(sanitizeParams(params))
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

/**
 * 执行查询并返回单行
 */
export function queryOne(db: Database, sql: string, params: any[] = []): any | null {
  const results = queryAll(db, sql, params)
  return results.length > 0 ? results[0] : null
}

/**
 * 执行写操作（INSERT/UPDATE/DELETE）
 * 返回影响的行数（通过 changes() 获取）
 */
export function run(db: Database, sql: string, params: any[] = []): void {
  const stmt = db.prepare(sql)
  stmt.bind(sanitizeParams(params))
  stmt.step()
  stmt.free()
}

/**
 * 在事务中执行多个操作
 */
export function transaction(db: Database, operations: () => void): void {
  db.exec('BEGIN TRANSACTION')
  try {
    operations()
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
