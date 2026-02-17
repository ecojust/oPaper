import * as BABYLON from "@babylonjs/core";
import * as monaco from "monaco-editor";

type BabylonHandle = {
  dispose: () => void;
  updateCode?: (code: string) => void;
};

function makeUniqueName() {
  return (
    "customShader_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)
  );
}

export function initBabylon(
  canvas: HTMLCanvasElement,
  getFragmentSource: () => string,
): BabylonHandle {
  const shaderName = makeUniqueName();

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.FreeCamera(
    "cam",
    new BABYLON.Vector3(0, 0, -5),
    scene,
  );
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  const plane = BABYLON.MeshBuilder.CreatePlane(
    "plane",
    { width: 4, height: 2.25 },
    scene,
  );

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

  const createMaterialFromSource = (src: string) => {
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

    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = fragSource;

    const mat = new BABYLON.ShaderMaterial(
      "mat",
      scene,
      {
        vertex: shaderName,
        fragment: shaderName,
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

  material = createMaterialFromSource(getFragmentSource());
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
      // dispose old material and recreate
      if (material) {
        material.dispose();
        material = null;
      }
      const newMat = createMaterialFromSource(code);
      material = newMat;
      plane.material = material;
    } catch (e) {
      console.warn("failed to update shader code", e);
    }
  };

  return { dispose, updateCode };
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

export default {
  initBabylon,
  MonacoShaderEditor,
};
