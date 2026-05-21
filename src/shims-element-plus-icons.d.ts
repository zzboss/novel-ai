// 绕过 Volar 对 @element-plus/icons-vue 的类型解析问题
// 声明模块，告诉 TypeScript 这些导出存在

declare module '@element-plus/icons-vue' {
  import type { DefineComponent } from 'vue'
  
  export const ArrowLeft: DefineComponent<{}, {}, {}>
  export const FullScreen: DefineComponent<{}, {}, {}>
  export const Search: DefineComponent<{}, {}, {}>
  export const Check: DefineComponent<{}, {}, {}>
  export const Document: DefineComponent<{}, {}, {}>
  export const FolderOpened: DefineComponent<{}, {}, {}>
  export const Loading: DefineComponent<{}, {}, {}>
  export const User: DefineComponent<{}, {}, {}>
  export const Plus: DefineComponent<{}, {}, {}>
  export const Delete: DefineComponent<{}, {}, {}>
  export const Setting: DefineComponent<{}, {}, {}>
  export const EditPen: DefineComponent<{}, {}, {}>
  export const Avatar: DefineComponent<{}, {}, {}>
}
