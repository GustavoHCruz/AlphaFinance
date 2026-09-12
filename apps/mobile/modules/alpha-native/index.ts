// Re-export the native module. On web, it will be resolved to AlphaNativeModule.web.ts
// and on native platforms to AlphaNativeModule.ts
export { default } from './src/AlphaNativeModule';
export * from './src/AlphaNative.types';
