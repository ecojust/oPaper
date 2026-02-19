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
}
