import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import Config from "@/service/config";

import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { builtinHTMLBackgrounds } from "./const";

function makeUniqueName() {
  return Math.random().toString(36).slice(2, 8);
}

export class CodemirrorShaderEditor {
  private editorView: EditorView = null as any;

  constructor(
    container: HTMLElement,
    initialCode: string,
    onChange: (code: string) => void,
  ) {
    this.initEditor(container, initialCode, onChange);
  }

  initEditor(
    container: HTMLElement,
    initialCode: string,
    onChange: (code: string) => void,
  ) {
    try {
      // Clear container first
      container.innerHTML = "";

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          onChange && onChange(code);
        }
      });

      const state = EditorState.create({
        doc: initialCode,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          EditorState.allowMultipleSelections.of(true),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          cpp(),
          oneDark,
          updateListener,
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "13px",
              display: "flex",
              flexDirection: "column",
            },
            ".cm-scroller": {
              overflow: "auto",
              flex: "1",
              minHeight: "0",
            },
            ".cm-content": {
              fontFamily: "'Fira Code', 'Consolas', monospace",
              flex: "1",
            },
            ".cm-gutters": {
              flexShrink: 0,
            },
          }),
        ],
      });

      this.editorView = new EditorView({
        state,
        parent: container,
      });
    } catch (e) {
      console.error("Failed to initialize CodeMirror editor:", e);
    }
  }

  dispose() {
    try {
      if (this.editorView) {
        this.editorView.destroy();
        this.editorView = null as any;
      }
    } catch (e) {}
  }
}

export class HTML {
  static async readConfig() {
    return await Config.readConfig();
  }

  static async saveConfig(updates: Record<string, any>) {
    await Config.saveConfig(updates);
  }

  static async newDraft() {
    try {
      return { ...builtinHTMLBackgrounds[0], title: "h_" + makeUniqueName() };
      // const template: any = await Dialog.chooseShaderTemplate();
      // console.log("Chosen template:", template);
      // return {
      //   title: "s_" + makeUniqueName(),
      //   code: template.code,
      //   thumbnail: template.thumbnail,
      // };
    } catch (e) {
      // 用户取消选择，返回默认模板
      throw new Error("用户取消选择");
    }
  }

  static async removeHTMLBackground(title: string) {
    console.log("Removing shader background:", title);
    try {
      await invoke("delete_wallpaper_html", { folder: title });
    } catch (e) {
      console.error("Failed to remove html background:", e);
      throw e;
    }
  }

  static async setHTMLBackground(path: string) {
    const lastConfig = await HTML.readConfig();
    try {
      await invoke("set_config", {
        content: JSON.stringify({
          ...lastConfig,
          mode: "html",
          loop: false,
          htmlPath: path,
        }),
      });
    } catch (e) {
      console.log("set_HTML_wallpaper_from_path: " + e);
    }
    await invoke("create_animation_wallpaper");
  }

  static async saveHTMLBackground(
    title: string,
    code: string,
    thumbnail: string,
  ) {
    try {
      // thumbnail 是 base64 字符串，去掉前缀（如 "data:image/png;base64,"）
      const base64Data = thumbnail.includes("base64,")
        ? thumbnail.split("base64,")[1]
        : thumbnail;

      const shaderPath = await invoke("save_wallpaper_html", {
        folderName: title,
        html: code,
        thumbnail: base64Data,
      });
      console.log("html saved to:", shaderPath);
      return shaderPath;
    } catch (e) {
      console.error("Failed to save html:", e);
      throw e;
    }
  }

  static async getHTMLContent(filePath: string, fullPath = false) {
    if (fullPath) {
      return await invoke("read_file", { path: filePath });
    } else {
      return await invoke("read_file", { path: filePath });
    }
  }

  static async getLocalHTMLList() {
    try {
      const folders = await invoke("read_wallpaper_html");
      if (folders instanceof Array === false) {
        throw new Error("Expected an array from read_wallpaper_html");
      }
      // 使用时间戳作为 cache busting，避免浏览器缓存旧的缩略图
      const cacheBuster = Date.now();
      return folders.map((folderPath: any, index: number) => ({
        id: `${folderPath}`,
        title: folderPath.split("/").pop() || `本地图片 ${index + 1}`,

        thumbnail:
          convertFileSrc(`${folderPath}/thumbnail.png`) + `?t=${cacheBuster}`,
        url: `${folderPath}/index.html`,
      }));
    } catch (e) {
      console.log("Failed to read local html list: " + e);
      return [];
    }
  }
}

export default {
  HTML,
  CodemirrorShaderEditor,
};
