// Tauri fetch 相关类型定义

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// 导入 Tauri API
import { invoke } from "@tauri-apps/api/core";

export class TauriFetch {
  /**
   * 发送 HTTP 请求
   * @param url 请求 URL
   * @param options 请求选项
   * @returns Promise<FetchResponse>
   */
  static async request(
    url: string,
    options?: FetchOptions
  ): Promise<FetchResponse> {
    return await invoke("fetch_request", { url, options });
  }

  /**
   * 发送 HTTP 请求并解析 JSON 响应
   * @param url 请求 URL
   * @param options 请求选项
   * @returns Promise<any>
   */
  static async json(url: string, options?: FetchOptions): Promise<any> {
    return await invoke("fetch_json", { url, options });
  }

  /**
   * 发送 GET 请求
   * @param url 请求 URL
   * @param headers 请求头
   * @returns Promise<FetchResponse>
   */
  static async get(
    url: string,
    headers?: Record<string, string>
  ): Promise<FetchResponse> {
    return this.request(url, { method: "GET", headers });
  }

  /**
   * 发送 POST 请求
   * @param url 请求 URL
   * @param body 请求体
   * @param headers 请求头
   * @returns Promise<FetchResponse>
   */
  static async post(
    url: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<FetchResponse> {
    return this.request(url, { method: "POST", body, headers });
  }

  /**
   * 发送 POST JSON 请求
   * @param url 请求 URL
   * @param data JSON 数据
   * @param headers 额外请求头
   * @returns Promise<FetchResponse>
   */
  static async postJson(
    url: string,
    data: any,
    headers?: Record<string, string>
  ): Promise<FetchResponse> {
    const defaultHeaders = { "Content-Type": "application/json" };
    const mergedHeaders = { ...defaultHeaders, ...headers };
    return this.request(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: mergedHeaders,
    });
  }

  /**
   * 发送 PUT 请求
   * @param url 请求 URL
   * @param body 请求体
   * @param headers 请求头
   * @returns Promise<FetchResponse>
   */
  static async put(
    url: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<FetchResponse> {
    return this.request(url, { method: "PUT", body, headers });
  }

  /**
   * 发送 DELETE 请求
   * @param url 请求 URL
   * @param headers 请求头
   * @returns Promise<FetchResponse>
   */
  static async delete(
    url: string,
    headers?: Record<string, string>
  ): Promise<FetchResponse> {
    return this.request(url, { method: "DELETE", headers });
  }
}
