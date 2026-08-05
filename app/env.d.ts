/** 构建期注入（vite.config.ts define）：页脚展示的真实构建时间 */
declare const __BUILD_TIME__: string;

/** 构建期注入：页脚版权年份（避免运行时实时取时间） */
declare const __BUILD_YEAR__: string;
