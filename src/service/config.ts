import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { sleep } from "@/utils/util";

export default class Config {
  static async readConfig() {
    try {
      const configStr: string = await invoke("read_config");
      return JSON.parse(configStr);
    } catch (e) {
      alert("read_config: " + e);
    }
  }

  static async saveConfig(updates: Record<string, any>) {
    try {
      const currentConfig = await this.readConfig();
      await invoke("set_config", {
        content: JSON.stringify({
          ...currentConfig,
          ...updates,
        }),
      });
    } catch (e) {
      console.error("save_config: " + e);
    }
  }
}
