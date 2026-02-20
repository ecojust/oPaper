import { invoke } from "@tauri-apps/api/core";

export default class Tool {
  static async get_system_stats() {
    try {
      const get_system_stats = await invoke("get_system_stats");
      console.log(get_system_stats);
    } catch (e) {
      alert("read_config: " + e);
    }
  }

  static async open_executable(path: string) {
    try {
      const result = await invoke("open_executable", { path });
      console.log(result);
      return result;
    } catch (e) {
      alert("open_executable: " + e);
      throw e;
    }
  }
}
