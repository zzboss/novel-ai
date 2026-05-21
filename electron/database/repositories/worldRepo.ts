/**
 * 世界观设定数据访问层 - World Repository
 */
import type { Database } from 'sql.js'
import { queryAll, queryOne, run } from '../index'

export interface WorldSettingsRecord {
  genre: string
  tone: string
  rules: string
  locations: string[]
}

export function getWorldSettings(db: Database): WorldSettingsRecord {
  const row = queryOne(db, 'SELECT * FROM world_settings WHERE id = 1')
  const locations = queryAll(db, 'SELECT name FROM world_locations ORDER BY id')
    .map(r => r.name)

  return {
    genre: row?.genre || '',
    tone: row?.tone || '',
    rules: row?.rules || '',
    locations
  }
}

export function upsertWorldSettings(db: Database, settings: Partial<WorldSettingsRecord>): void {
  const existing = queryOne(db, 'SELECT id FROM world_settings WHERE id = 1')

  if (existing) {
    const fields: string[] = []
    const params: any[] = []
    if (settings.genre !== undefined) { fields.push('genre = ?'); params.push(settings.genre) }
    if (settings.tone !== undefined) { fields.push('tone = ?'); params.push(settings.tone) }
    if (settings.rules !== undefined) { fields.push('rules = ?'); params.push(settings.rules) }
    params.push(1)
    run(db, `UPDATE world_settings SET ${fields.join(', ')} WHERE id = ?`, params)
  } else {
    run(db, 'INSERT INTO world_settings (id, genre, tone, rules) VALUES (1, ?, ?, ?)', [
      settings.genre || '',
      settings.tone || '',
      settings.rules || ''
    ])
  }

  if (settings.locations !== undefined) {
    run(db, 'DELETE FROM world_locations')
    for (const loc of settings.locations) {
      run(db, 'INSERT INTO world_locations (name) VALUES (?)', [loc])
    }
  }
}
