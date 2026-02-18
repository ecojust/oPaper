import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { sleep } from "@/utils/util";
import Config from "@/service/config";

import * as BABYLON from "@babylonjs/core";
import * as monaco from "monaco-editor";
import * as prettier from "prettier";
import glslParser from "prettier-plugin-glsl";

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

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
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
  let start = Date.now();

  // update material/resolution when canvas resizes
  const resizeHandler = () => {
    try {
      engine.resize();
    } catch (e) {}
    try {
      setOrtho();
    } catch (e) {}
    try {
      if (material && (material as any).setVector2) {
        (material as any).setVector2(
          "iResolution",
          new BABYLON.Vector2(canvas.width, canvas.height),
        );
      }
    } catch (e) {}
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
    const now = (Date.now() - start) / 1000;
    try {
      material &&
        (material as any).setFloat &&
        (material as any).setFloat("iTime", now);
    } catch (e) {}
    try {
      material &&
        (material as any).setVector2 &&
        (material as any).setVector2(
          "iResolution",
          new BABYLON.Vector2(canvas.width, canvas.height),
        );
    } catch (e) {}
    scene.render();
  };

  engine.runRenderLoop(renderFn);

  const dispose = () => {
    try {
      engine.stopRenderLoop(renderFn);
    } catch (e) {}
    try {
      if (material) {
        material.dispose();
        material = null;
      }
    } catch (e) {}
    try {
      plane.dispose();
    } catch (e) {}
    try {
      scene.dispose();
    } catch (e) {}
    try {
      engine.dispose();
    } catch (e) {}
    try {
      window.removeEventListener("resize", resizeHandler);
    } catch (e) {}
    // cleanup shaders store
    try {
      delete (BABYLON as any).Effect.ShadersStore[
        shaderName + "FragmentShader"
      ];
      delete (BABYLON as any).Effect.ShadersStore[shaderName + "VertexShader"];
    } catch (e) {}
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

export class MonacoShaderEditor {
  private monacoEditor: monaco.editor.IStandaloneCodeEditor = null as any;
  private monacoModel: monaco.editor.ITextModel = null as any;

  constructor(
    container: HTMLElement,
    initialCode: string,
    onChange: (code: string) => void,
  ) {
    try {
      monaco.languages.register({ id: "glsl" });
      monaco.languages.setMonarchTokensProvider("glsl", {
        defaultToken: "",
        tokenPostfix: ".glsl",
        keywords: ["if", "else", "for", "while", "return", "discard"],
        types: [
          "float",
          "int",
          "bool",
          "void",
          "vec2",
          "vec3",
          "vec4",
          "mat3",
          "mat4",
          "sampler2D",
        ],
        symbols: /[=><!~?:&|+\-*\/%^]+/,
        tokenizer: {
          root: [
            [/\/\/.*$/, "comment"],
            [/\/\*/, "comment", "@comment"],
            [/#\s*[a-zA-Z_][\w]*/, "keyword"],
            [/[a-zA-Z_][\w]*(?=\s*\()/, "identifier"],
            [
              /[a-zA-Z_][\w]*/,
              {
                cases: {
                  "@keywords": "keyword",
                  "@types": "type",
                  "@default": "identifier",
                },
              },
            ],
            [/\d+\.\d+([eE][\-+]?\d+)?/, "number.float"],
            [/\d+/, "number"],
            [/[{}()\[\]]/, "delimiter"],
            [/[,;.]/, "delimiter"],
            [/@symbols/, "operator"],
          ],
          comment: [
            [/[^/*]+/, "comment"],
            [/\*\//, "comment", "@pop"],
            [/[/*]/, "comment"],
          ],
        },
      });
    } catch (e) {}

    try {
      monaco.editor.defineTheme("shaderTheme", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955" },
          { token: "keyword", foreground: "569CD6" },
          { token: "type", foreground: "4EC9B0" },
          { token: "number", foreground: "B5CEA8" },
          { token: "operator", foreground: "D4D4D4" },
          { token: "identifier", foreground: "9CDCFE" },
        ],
        colors: { "editor.background": "#0f1724" },
      });
    } catch (e) {}

    this.initEditor(container, initialCode, onChange);
  }

  // GLSL formatter using prettier with glsl parser
  async formatCode(editor: monaco.editor.ICodeEditor) {
    const model = editor.getModel();
    if (!model) return;

    const code = model.getValue();

    try {
      console.log("Formatting code with prettier...", prettier);
      const formatted = await prettier.format(code, {
        parser: "glsl-parser",
        plugins: [glslParser],
      });
      editor.setValue(formatted);
    } catch (e) {
      console.warn("Failed to format code with prettier:", e);
    }

    // Trigger change event
    const listener = editor.onDidChangeModelContent(() => {
      listener.dispose();
    });
  }

  initEditor(
    container: HTMLElement,
    initialCode: string,
    onChange: (code: string) => void,
  ) {
    try {
      this.monacoModel = monaco.editor.createModel(initialCode, "glsl");
      this.monacoEditor = monaco.editor.create(container, {
        model: this.monacoModel,
        theme: "shaderTheme",
        language: "glsl",
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
      });
      this.monacoEditor.onDidChangeModelContent(() => {
        try {
          const code = this.monacoEditor.getValue();
          onChange && onChange(code);
        } catch (e) {}
      });

      // Register format action using prettier
      this.monacoEditor.addAction({
        id: "format-glsl",
        label: "Format",
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        ],
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        run: () => {
          this.formatCode(this.monacoEditor);
        },
      });
    } catch (e) {}
  }

  dispose() {
    try {
      this.monacoEditor.dispose();
    } catch (e) {}
    try {
      this.monacoModel.dispose();
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

  static async saveDefaultShaderBackground(code: string, thumbnail: string) {
    //
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
        url: convertFileSrc(`${folderPath}/shader.glsl`),
      }));
    } catch (e) {
      console.log("Failed to read local shader list: " + e);
      return [];
    }
  }
}

export default {
  initBabylon,
  MonacoShaderEditor,
};
