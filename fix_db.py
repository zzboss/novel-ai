#!/usr/bin/env python3
"""在 index.ts 的 getDatabase 函数中插入 chapter_outlines 表迁移逻辑
通过识别 getDatabase 函数范围来精确修改，避免影响 loadDatabase
"""

filepath = r'd:\coding\writing\AIWT\novel-ai\electron\database\index.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到 getDatabase 函数的起始和结束行
get_db_start = None
get_db_end = None

for i, line in enumerate(lines):
    if 'export async function getDatabase' in line:
        get_db_start = i
    # getDatabase 结束于下一个 export async function 或文件末尾
    if get_db_start is not None and i > get_db_start:
        if line.startswith('export ') or line.startswith('function ') or (i > get_db_start and lines[i].strip() == '' and i+1 < len(lines) and lines[i+1].strip().startswith('//')):
            # 检查是否是下一个函数的开始
            if i + 1 < len(lines) and ('export async function' in lines[i+1] or 'function getSchemaSQL' in lines[i+1]):
                get_db_end = i
                break

if get_db_end is None:
    get_db_end = len(lines)

print(f'getDatabase: lines {get_db_start+1} to {get_db_end}')

# 在 getDatabase 函数范围内，找到角色关系图迁移结束后、地图迁移开始前的位置
# 插入点："} catch (e) {\n    console.error('[Database] 角色关系图相关表迁移检查失败:', e)\n  }\n\n  // 迁移：检查并创建地图相关表"
# 在 getDatabase 中这是唯一的，因为 loadDatabase 中没有"地图相关表"这个注释

insert_idx = None
for i in range(get_db_start, get_db_end):
    if i + 3 < get_db_end:
        if ("角色关系图相关表迁移检查失败" in lines[i] and
            i + 4 < get_db_end and '地图相关表' in lines[i + 4]):
            # 在 i+4 行之前插入（即在空行之后、地图迁移注释之前）
            # 实际插入位置是 i+2 之后的空行
            # 找到第一个空行或地图注释行
            insert_idx = i + 4  # 地图迁移注释的行
            break

if insert_idx is None:
    print("ERROR: insertion point not found in getDatabase")
else:
    new_lines = [
        '  }\r\n',
        '  // 迁移：检查并创建 chapter_outlines 表\r\n',
        '  try {\r\n',
        "    const tableExists = queryAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='chapter_outlines'`)\r\n",
        '    if (tableExists.length === 0) {\r\n',
        '      db.exec(`\r\n',
        '        CREATE TABLE chapter_outlines (\r\n',
        '          id TEXT PRIMARY KEY,\r\n',
        '          chapter_id TEXT NOT NULL UNIQUE,\r\n',
        "          core_goal TEXT DEFAULT '',\r\n",
        "          plot_progression TEXT DEFAULT '',\r\n",
        "          character_development TEXT DEFAULT '',\r\n",
        "          overall_foreshadowing TEXT DEFAULT '[]',\r\n",
        "          overall_twists TEXT DEFAULT '[]',\r\n",
        "          next_chapter_hook TEXT DEFAULT '',\r\n",
        "          scenes TEXT DEFAULT '[]',\r\n",
        '          created_at INTEGER NOT NULL,\r\n',
        '          updated_at INTEGER NOT NULL,\r\n',
        '          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE\r\n',
        '        )\r\n',
        '      `)\r\n',
        "      db.exec(`CREATE INDEX idx_chapter_outlines_chapter_id ON chapter_outlines(chapter_id)`)\r\n",
        "      console.log('[Database] chapter_outlines 表创建完成')\r\n",
        '      needsSave = true\r\n',
        '    }\r\n',
        '  } catch (e) {\r\n',
        "    console.error('[Database] chapter_outlines 表迁移检查失败:', e)\r\n",
        '  }\r\n',
        '\r\n',
    ]
    # 在地图迁移注释行之前插入
    for offset, nl in enumerate(new_lines):
        lines.insert(insert_idx + offset, nl)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f'SUCCESS: inserted at line {insert_idx + 1}')
