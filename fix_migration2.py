#!/usr/bin/env python3
"""精确在 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
getDatabase 从第495行开始，其中的角色关系图迁移段在约第746行结束
"""

with open(r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 getDatabase 函数起始行（第495行，索引494）
# 在该函数内找到 "角色关系图相关表已存在" 且后面跟着 "地图相关表" 的位置
# loadDatabase 中该位置后面没有 "地图相关表" 这个注释

in_get_database = False
target_line_idx = None

for i, line in enumerate(lines):
    if 'export async function getDatabase' in line:
        in_get_database = True
    if in_get_database and 'export async function' in line and 'getDatabase' not in line:
        # 进入了下一个函数，停止
        in_get_database = False
    if in_get_database and '角色关系图相关表已存在' in line:
        # 检查后面第3行是否包含 "地图相关表"
        if i + 4 < len(lines) and '地图相关表' in lines[i + 4]:
            target_line_idx = i
            break

if target_line_idx is None:
    print("ERROR: target location not found in getDatabase")
else:
    insert_lines = [
        '  }\r\n',
        '  // 迁移：检查并创建 chapter_outlines 表\r\n',
        '  try {\r\n',
        '    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'chapter_outlines\'")`\r\n',
        '    if (tableExists.length === 0) {\r\n',
        '      db.exec(`\r\n',
        '        CREATE TABLE chapter_outlines (\r\n',
        '          id TEXT PRIMARY KEY,\r\n',
        '          chapter_id TEXT NOT NULL UNIQUE,\r\n',
        '          core_goal TEXT DEFAULT \'\',\r\n',
        '          plot_progression TEXT DEFAULT \'\',\r\n',
        '          character_development TEXT DEFAULT \'\',\r\n',
        '          overall_foreshadowing TEXT DEFAULT \'[]\',\r\n',
        '          overall_twists TEXT DEFAULT \'[]\',\r\n',
        '          next_chapter_hook TEXT DEFAULT \'\',\r\n',
        '          scenes TEXT DEFAULT \'[]\',\r\n',
        '          created_at INTEGER NOT NULL,\r\n',
        '          updated_at INTEGER NOT NULL,\r\n',
        '          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE\r\n',
        '        )\r\n',
        '      `)\r\n',
        '      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)\r\n',
        '      console.log(\'[Database] chapter_outlines 表创建完成\')\r\n',
        '      needsSave = true\r\n',
        '    }\r\n',
        '  } catch (e) {\r\n',
        '    console.error(\'[Database] chapter_outlines 表迁移检查失败:\', e)\r\n',
        '  }\r\n',
        '\r\n',
    ]
    # target_line_idx 是 "console.log('[Database] 角色关系图相关表已存在')" 所在行
    # 需要在其后插入（在第 i+1 行的 "}" 之后）
    # 实际插入位置是 target_line_idx + 2（即 catch 块结束后）
    insert_at = target_line_idx + 4  # } catch (e) { ... } 之后的空行
    for offset, line_content in enumerate(insert_lines):
        lines.insert(insert_at + offset, line_content)
    with open(r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"SUCCESS: inserted chapter_outlines migration at line {insert_at + 1}")
