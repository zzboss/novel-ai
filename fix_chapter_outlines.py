#!/usr/bin/env python3
"""在 index.ts 的 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
只修改 getDatabase 函数，不影响 loadDatabase
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 定位 getDatabase 函数中的唯一标记
# getDatabase 中角色关系图迁移后有 "地图相关表" 注释
# loadDatabase 中相同位置后面没有这个注释
# 精确匹配 getDatabase 中的那段代码

old_text = """      console.log('[Database] 角色关系图相关表创建完成')
      needsSave = true
    } else {
      console.log('[Database] 角色关系图相关表已存在')
    }
  } catch (e) {
    console.error('[Database] 角色关系图相关表迁移检查失败:', e)
  }

  // 迁移：检查并创建地图相关表"""

new_text = """      console.log('[Database] 角色关系图相关表创建完成')
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

  // 迁移：检查并创建地图相关表"""

# 只替换第一次出现（getDatabase 中的那一次）
first_pos = content.find(old_text)
if first_pos == -1:
    print("ERROR: target text not found")
else:
    new_content = content[:first_pos] + new_text + content[first_pos + len(old_text):]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: chapter_outlines migration inserted into getDatabase")
