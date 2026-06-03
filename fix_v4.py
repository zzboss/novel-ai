#!/usr/bin/env python3
"""在 index.ts 的 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
通过定位 getDatabase 函数范围，只在该函数内做替换
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 找到 getDatabase 函数的起始和结束位置
start_marker = 'export async function getDatabase'
end_marker = '// ==================== Schema SQL ===================='

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: getDatabase function not found")
    exit(1)

end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: getDatabase function end not found")
    exit(1)

print(f"getDatabase range: {start_idx} to {end_idx}")

# 在 getDatabase 范围内做替换
# 替换目标：角色关系图迁移段结束后，地图迁移开始前的空行
old_within = """      console.log('[Database] 角色关系图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 角色关系图相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建地图相关表"""

new_within = """      console.log('[Database] 角色关系图相关表已存在')
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

  // 迁移：检查并创建地图相关表"""

# 只在 getDatabase 范围内查找
func_content = content[start_idx:end_idx]
if old_within not in func_content:
    print("ERROR: target text not found within getDatabase function")
    exit(1)

new_func_content = func_content.replace(old_within, new_within, 1)
new_content = content[:start_idx] + new_func_content + content[end_idx:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: chapter_outlines migration inserted into getDatabase")
