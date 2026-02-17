import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { sleep } from "@/utils/util";

interface IWallpaper {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
}

export default class Panel {
  static async readLocalStaticWallpapers() {
    const images = await invoke("read_wallpaper_static");
    let wallpapers: IWallpaper[] = [];
    if (images && Array.isArray(images)) {
      wallpapers = images.map((imagePath, index) => {
        const fileUrl = convertFileSrc(imagePath);
        return {
          id: `local-${imagePath}`,
          title: imagePath.split("/").pop() || `本地图片 ${index + 1}`,
          thumbnail: fileUrl,
          url: imagePath,
          author: "本地图片",
        };
      });
    }
    wallpapers = wallpapers.sort((a, b) =>
      b.title.localeCompare(a.title) > 0 ? 1 : -1,
    );
    return wallpapers;
  }
  catch(e: any) {
    console.log("读取本地图片失败: " + e);
    return [];
  }

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

  static async getRandomWallpaper(lastConfig = {}) {
    const randomImageUrl = `https://picsum.photos/3840/2160?random=${Date.now()}`;
    const rawUrl = "random-image";
    let pathUrl = "";
    let imageUrl = "";
    try {
      pathUrl = await invoke("set_static_wallpaper_from_url", {
        url: randomImageUrl,
      });
      imageUrl = convertFileSrc(pathUrl);

      await invoke("set_config", {
        content: JSON.stringify({
          ...lastConfig,
          mode: "static",
        }),
      });
    } catch (e) {
      console.log("set_static_wallpaper_from_url: " + e);
    } finally {
      return {
        pathUrl,
        rawUrl,
        imageUrl,
      };
    }
  }

  static async setWallpaperFromLocal(path: string, lastConfig = {}) {
    try {
      await invoke("set_config", {
        content: JSON.stringify({
          ...lastConfig,
          mode: "static",
        }),
      });
      await invoke("set_static_wallpaper_from_path", { path: path });
      await sleep(50); // 模拟下载和设置壁纸的时间
    } catch (error) {
      console.log("set_static_wallpaper_from_path: " + error);
    }
  }

  static async switchAnimationWallpaper(lastConfig = {}) {
    await invoke("set_config", {
      content: JSON.stringify({
        ...lastConfig,
        mode: "animation",
        loop: false,
      }),
    });
    await invoke("create_animation_wallpaper", {});
  }

  static async downloadCurrentWallpaper(path: string) {
    try {
      await invoke("copy_wallpaper_to_wallpaper_static", { path });
      return true;
    } catch (e) {
      console.error("download_current_wallpaper:", e);
      return false;
    }
  }

  static async deleteWallpaper(path: string) {
    try {
      await invoke("delete_wallpaper_static", { path });
      return true;
    } catch (e) {
      console.error("delete_wallpaper:", e);
      return false;
    }
  }
}
