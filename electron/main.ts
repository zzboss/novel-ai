import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// 加载 IPC 处理器（CommonJS 格式，不需要 .js 扩展名）
require('./ipc/file')
require('./ipc/keytar')
require('./ipc/snapshot')
require('./ipc/store')
require('./ipc/llm')
require('./ipc/export')
require('./ipc/chatHistory')
require('./ipc/llmInteraction')  // LLM 交互记录（独立功能）

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'default',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    // 开发模式：优先使用环境变量，默认指向 Vite dev server
    const rendererURL = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'
    mainWindow.loadURL(rendererURL)
  } else {
    // 生产模式：__dirname = novel-ai/dist-electron, dist-renderer 在上一级目录
    mainWindow.loadFile(join(__dirname, '../dist-renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aiwt.novel-ai')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
