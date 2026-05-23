import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '../mcp-servers/**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: ['node_modules', 'dist', 'dist-electron']
  }
})
