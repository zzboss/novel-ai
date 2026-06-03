/**
 * 枚举定义文件
 *
 * 使用 const 对象 + 类型定义替代 TypeScript 枚举，
 * 避免 Vite/esbuild 转译枚举时的兼容性问题。
 *
 * 值保持与原有字符串相同，确保 JSON 序列化/反序列化兼容。
 */
/** 项目类型 */
export declare const ProjectType: {
    readonly NOVEL: "novel";
    readonly SHORT_STORY: "short-story";
    readonly SCRIPT: "script";
};
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];
/** 步骤输入模式 */
export declare const StepInputMode: {
    readonly MANUAL: "manual";
    readonly AI: "ai";
    readonly ASSISTED: "assisted";
};
export type StepInputMode = (typeof StepInputMode)[keyof typeof StepInputMode];
/** 章节状态 */
export declare const ChapterStatus: {
    readonly DRAFT: "draft";
    readonly REVIEW: "review";
    readonly DONE: "done";
};
export type ChapterStatus = (typeof ChapterStatus)[keyof typeof ChapterStatus];
/** 步骤状态 */
export declare const StepStatus: {
    readonly PENDING: "pending";
    readonly IN_PROGRESS: "in-progress";
    readonly COMPLETED: "completed";
    readonly SKIPPED: "skipped";
};
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];
/** 角色定位 */
export declare const CharacterRole: {
    readonly PROTAGONIST: "protagonist";
    readonly ANTAGONIST: "antagonist";
    readonly SUPPORTING: "supporting";
    readonly MINOR: "minor";
};
export type CharacterRole = (typeof CharacterRole)[keyof typeof CharacterRole];
/** 角色性别 */
export declare const CharacterGender: {
    readonly MALE: "male";
    readonly FEMALE: "female";
    readonly OTHER: "other";
};
export type CharacterGender = (typeof CharacterGender)[keyof typeof CharacterGender];
