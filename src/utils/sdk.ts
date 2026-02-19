import { invoke } from "@tauri-apps/api/core";

/**
 * 系统信息接口
 */
export interface SystemInfo {
  cpu_usage_percent: number;
  memory_used: number;
  memory_total: number;
  memory_usage_percent: number;
}

/**
 * 获取系统信息
 * @returns Promise<SystemInfo> 系统信息对象
 * @example
 * const res = await getSystemInfo();
 * console.log(res.cpu_usage_percent);
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  return await invoke<SystemInfo>("get_system_stats");
}

/**
 * 读取配置
 * @returns Promise<string> 配置 JSON 字符串
 */
export async function getConfig(): Promise<string> {
  return await invoke<string>("read_config");
}

/**
 * 设置配置
 * @param content 配置内容 (JSON 字符串)
 * @returns Promise<string> 操作结果
 */
export async function setConfig(content: string): Promise<string> {
  return await invoke<string>("set_config", { content });
}
