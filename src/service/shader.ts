import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import Config from "@/service/config";

import * as BABYLON from "@babylonjs/core";
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

import Dialog from "./dialog";

type BabylonHandle = {
  dispose: () => void;
  updateCode?: (code: string) => void;
  sceneShot?: () => Promise<string | undefined>;
};

function makeUniqueName() {
  return Math.random().toString(36).slice(2, 8);
}

export function initBabylon(
  canvas: HTMLCanvasElement,
  getFragmentSource: () => string,
): BabylonHandle {
  let shaderName = makeUniqueName();

  const engine = new BABYLON.Engine(canvas, true, {
    // 启用 preserveDrawingBuffer 可以提高性能，如果不需要截图可以设为 false
    preserveDrawingBuffer: false,
    // 禁用 stencil buffer 如果不需要
    stencil: false,
  });
  const scene = new BABYLON.Scene(engine);
  // 禁用 scene 的自动清除，因为我们只渲染一个全屏 quad
  scene.autoClear = false;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  const camera = new BABYLON.FreeCamera(
    "cam",
    new BABYLON.Vector3(0, 0, -1),
    scene,
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  // use an orthographic camera so the shader is screen-space and doesn't
  // change with 3D perspective transforms
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

  const setOrtho = () => {
    const w = canvas.width;
    const h = canvas.height;
    // apply ortho frustum in pixel-like units centered on origin
    (camera as any).orthoLeft = -w / 2;
    (camera as any).orthoRight = w / 2;
    (camera as any).orthoTop = h / 2;
    (camera as any).orthoBottom = -h / 2;
  };
  setOrtho();

  // create a plane that exactly covers the orthographic frustum (full-screen)
  const plane = BABYLON.MeshBuilder.CreatePlane(
    "plane",
    { width: canvas.width, height: canvas.height },
    scene,
  );
  plane.position = new BABYLON.Vector3(0, 0, 0);

  // vertex shader
  BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUV;
    uniform mat4 worldViewProjection;
    void main(void) {
      vUV = uv;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  let material: BABYLON.ShaderMaterial | null = null;
  // 使用 performance.now() 获得更高精度的时间
  let start = performance.now();

  // 预创建 Vector2 对象以避免每帧创建新对象（内存优化）
  const resolutionVector = new BABYLON.Vector2(0, 0);
  let needsResolutionUpdate = true;

  // update material/resolution when canvas resizes
  // 使用防抖处理 resize 事件
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  const resizeHandler = () => {
    // 清除之前的 timeout
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    // 防抖：延迟执行，实际的 resize 处理
    resizeTimeout = setTimeout(() => {
      try {
        engine.resize();
      } catch (e) {}
      try {
        setOrtho();
      } catch (e) {}
      // 标记需要更新 resolution
      needsResolutionUpdate = true;
    }, 16); // ~60fps 的帧时间
  };
  window.addEventListener("resize", resizeHandler);

  const createMaterialFromSource = (src: string, name: string) => {
    // ensure fragment source exists and looks plausible
    const fragSource =
      src && src.includes("gl_FragColor")
        ? src
        : `
        precision highp float;
        varying vec2 vUV;
        uniform float iTime;
        uniform vec2 iResolution;
        void main(void) {
          vec2 uv = vUV;
          vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0,2.0,4.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `;

    BABYLON.Effect.ShadersStore[name + "FragmentShader"] = fragSource;

    const mat = new BABYLON.ShaderMaterial(
      "mat_" + name,
      scene,
      {
        vertex: name,
        fragment: name,
      },
      {
        attributes: ["position", "uv"],
        uniforms: [
          "world",
          "worldView",
          "worldViewProjection",
          "iTime",
          "iResolution",
        ],
      },
    );

    return mat;
  };

  material = createMaterialFromSource(getFragmentSource(), shaderName);
  plane.material = material;

  const renderFn = () => {
    const now = (performance.now() - start) / 1000;
    try {
      if (material) {
        (material as any).setFloat("iTime", now);
      }
    } catch (e) {}
    try {
      // 只在需要时更新 resolution（canvas 大小变化时）
      if (needsResolutionUpdate && material) {
        resolutionVector.x = canvas.width;
        resolutionVector.y = canvas.height;
        (material as any).setVector2("iResolution", resolutionVector);
        needsResolutionUpdate = false;
      }
    } catch (e) {}
    scene.render();
  };

  engine.runRenderLoop(renderFn);

  const dispose = () => {
    // 1. 停止渲染循环
    try {
      engine.stopRenderLoop(renderFn);
    } catch (e) {}

    // 2. 清理 resize 监听
    try {
      window.removeEventListener("resize", resizeHandler);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }
    } catch (e) {}

    // 3. 清理 material
    try {
      if (material) {
        material.dispose();
        material = null;
      }
    } catch (e) {}

    // 4. 清理 plane
    try {
      plane.dispose();
    } catch (e) {}

    // 5. 清理相机（显式清理，避免依赖 scene.dispose()）
    try {
      camera.dispose();
    } catch (e) {}

    // 6. 清理 scene
    try {
      scene.dispose();
    } catch (e) {}

    // 7. 清理 engine
    try {
      engine.dispose();
    } catch (e) {}

    // 8. 清理 shaders store
    try {
      delete (BABYLON as any).Effect.ShadersStore[
        shaderName + "FragmentShader"
      ];
      delete (BABYLON as any).Effect.ShadersStore[shaderName + "VertexShader"];
    } catch (e) {}

    // 9. 清理引用，帮助 GC
    shaderName = "";
  };

  const updateCode = (code: string) => {
    try {
      // 生成新的唯一 shader 名称，强制 Babylon 重新编译 shader
      const newShaderName = makeUniqueName();

      // 复制顶点 shader 到新的名称
      BABYLON.Effect.ShadersStore[newShaderName + "VertexShader"] =
        BABYLON.Effect.ShadersStore[shaderName + "VertexShader"];

      // 使用新名称创建新的 material
      const newMat = createMaterialFromSource(code, newShaderName);

      // 更新 shader 名称
      const oldShaderName = shaderName;
      shaderName = newShaderName;

      // 清理旧的 shader
      try {
        delete (BABYLON as any).Effect.ShadersStore[
          oldShaderName + "FragmentShader"
        ];
        delete (BABYLON as any).Effect.ShadersStore[
          oldShaderName + "VertexShader"
        ];
      } catch (e) {}

      // 清理旧的 material
      if (material) {
        material.dispose();
        material = null;
      }

      // 设置新的 material
      material = newMat;
      plane.material = newMat;

      console.log(
        "Shader code updated successfully, new shader:",
        newShaderName,
      );
    } catch (e) {
      console.warn("failed to update shader code", e);
    }
  };

  const sceneShot = () => {
    // try {
    //   const dataURL = engine.getRenderingCanvas()?.toDataURL("image/png");
    //   return dataURL;
    // } catch (e) {
    //   console.warn("Failed to capture screenshot:", e);
    //   return "";
    // }

    return new Promise<string>((resolve) => {
      try {
        BABYLON.Tools.CreateScreenshotUsingRenderTarget(
          engine,
          camera,
          { width: 800, height: 450 },
          function (data) {
            resolve(data);
          },
        );
      } catch (e) {
        console.warn("Failed to capture screenshot:", e);
        resolve("");
      }
    });
  };

  return { dispose, updateCode, sceneShot };
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

export class Shader {
  static async readConfig() {
    return await Config.readConfig();
  }

  static async saveConfig(updates: Record<string, any>) {
    await Config.saveConfig(updates);
  }

  static async getTemplates() {
    try {
      const response = await fetch("/shaders/default.json");
      const templates = await response.json();
      return templates;
    } catch (e) {
      console.error("Failed to load templates:", e);
      return [];
    }
  }

  static async loadTemplate(path: string) {
    try {
      const response = await fetch(path);
      const code = await response.text();
      return code;
    } catch (e) {
      console.error("Failed to load template:", e);
      return null;
    }
  }

  static async newDraft() {
    try {
      const template: any = await Dialog.chooseShaderTemplate();
      console.log("Chosen template:", template);
      return {
        title: "s_" + makeUniqueName(),
        code: template.code,
        thumbnail: template.thumbnail,
      };
    } catch (e) {
      // 用户取消选择，返回默认模板
      throw new Error("用户取消选择");
    }
  }

  static async removeShaderBackground(title: string) {
    console.log("Removing shader background:", title);
    try {
      await invoke("delete_wallpaper_shader", { folder: title });
    } catch (e) {
      console.error("Failed to remove shader background:", e);
      throw e;
    }
  }

  static async setShaderBackground(path: string) {
    const lastConfig = await Shader.readConfig();
    try {
      await invoke("set_config", {
        content: JSON.stringify({
          ...lastConfig,
          mode: "shader",
          shaderPath: path,
        }),
      });
    } catch (e) {
      console.log("set_shader_wallpaper_from_path: " + e);
    }
    await invoke("create_animation_wallpaper");
  }

  static async saveDefaultShaderBackground(_code: string, _thumbnail: string) {
    // Reserved for future use
  }

  static async saveShaderBackground(
    title: string,
    code: string,
    thumbnail: string,
  ) {
    // thumbnail 是 base64 字符串，去掉前缀（如 "data:image/png;base64,"）
    const base64Data = thumbnail.includes("base64,")
      ? thumbnail.split("base64,")[1]
      : thumbnail;

    try {
      const shaderPath = await invoke("save_wallpaper_shader", {
        folderName: title,
        glsl: code,
        thumbnail: base64Data,
      });
      console.log("Shader saved to:", shaderPath);
      return shaderPath;
    } catch (e) {
      console.error("Failed to save shader:", e);
      throw e;
    }
  }

  static async getGlslContent(filePath: string, fullPath = false) {
    if (fullPath) {
      return await invoke("read_file", { path: filePath });
    } else {
      return await invoke("read_file", { path: filePath });
    }
  }

  static async getLocalShaderList() {
    try {
      const folders = await invoke("read_wallpaper_shader");
      if (folders instanceof Array === false) {
        throw new Error("Expected an array from read_wallpaper_shader");
      }
      // 使用时间戳作为 cache busting，避免浏览器缓存旧的缩略图
      const cacheBuster = Date.now();
      return folders.map((folderPath: any, index: number) => ({
        id: `${folderPath}`,
        title: folderPath.split("/").pop() || `本地图片 ${index + 1}`,
        thumbnail:
          convertFileSrc(`${folderPath}/thumbnail.png`) + `?t=${cacheBuster}`,
        // url: convertFileSrc(`${folderPath}/shader.glsl`),
        url: `${folderPath}/shader.glsl`,
      }));
    } catch (e) {
      console.log("Failed to read local shader list: " + e);
      return [];
    }
  }
}

export default {
  initBabylon,
  CodemirrorShaderEditor,
};
