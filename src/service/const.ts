import img1 from "@/assets/builtinShaderBackgrounds/1.png";
import img2 from "@/assets/builtinShaderBackgrounds/2.png";
import img3 from "@/assets/builtinShaderBackgrounds/3.png";

const builtinShaderBackgrounds = [
  {
    title: "变化的三原色",
    code: `
    precision mediump float;
varying vec2 vUV;

uniform float iTime;
uniform vec2 iResolution;
void main(void) {
  vec2 uv = vUV;
  vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0,2.0,4.0));
  gl_FragColor = vec4(col, 1.0);
}

    
    `,
    thumbnail: img2,
  },
  {
    title: " 动态波纹",
    code: `
    precision highp float;
varying vec2 vUV;
uniform float iTime;
uniform vec2 iResolution;



void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float t = iTime * 0.5;
  float color = 0.0;
  color += sin(uv.x * 10.0 + t);
  color += sin((uv.y + uv.x) * 10.0 + t * 1.3);
  color += sin(length(uv - 0.5) * 40.0 - t * 0.5);
  color = color / 3.0;
  gl_FragColor = vec4(vec3(0.5 + 0.5 * sin(color * 3.1415 + vec3(0.0, 2.0, 4.0))), 1.0);
}

    
    `,
    thumbnail: img1,
  },

  {
    title: "三维立体动画",
    code: `
    // CC0: Let's self reflect
//  Always enjoyed the videos of Platonic solids with inner mirrors
//  I made some previous attempts but thought I make another attempt it

// Reducing the alias effects on the inner reflections turned out to be a bit tricky.
//  Simplest solution is just to run run fullscreen on a 4K screen ;)

// Function to generate the solid found here: https://www.shadertoy.com/view/MsKGzw

// Tinker with these parameters to create different solids
// -------------------------------------------------------

precision highp float;
varying vec2 vUV;
uniform float iTime;
uniform vec2 iResolution;

const float rotation_speed = 0.25;
const float poly_U = 1.0; // [0, inf]
const float poly_V = 0.5; // [0, inf]
const float poly_W = 1.0; // [0, inf]
const int poly_type = 3; // [2, 5]
const float poly_zoom = 2.0;
const float inner_sphere = 1.0;
const float refr_index = 0.9;

#define MAX_BOUNCES2 6
#define PI 3.141592654
#define TAU (2.0 * PI)

// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
// License: WTFPL, author: sam hocevar, found: https://stackoverflow.com/a/17897228/418488
//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)                                                             \
  ((c).z *                                                                     \
    mix(                                                                       \
      hsv2rgb_K.xxx,                                                           \
      clamp(                                                                   \
        abs(fract((c).xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) -            \
          hsv2rgb_K.xxx,                                                       \
        0.0,                                                                   \
        1.0                                                                    \
      ),                                                                       \
      (c).y                                                                    \
    ))

#define TOLERANCE2 0.0005
//#define MAX_RAY_LENGTH2   10.0
#define MAX_RAY_MARCHES2 50
#define NORM_OFF2 0.005
#define BACKSTEP2

#define TOLERANCE3 0.0005
#define MAX_RAY_LENGTH3 10.0
#define MAX_RAY_MARCHES3 90
#define NORM_OFF3 0.005

const vec3 rayOrigin = vec3(0.0, 1.0, -5.0);
const vec3 sunDir = normalize(-rayOrigin);

const vec3 sunCol = HSV2RGB(vec3(0.06, 0.9, 1e-2)) * 1.0;
const vec3 bottomBoxCol = HSV2RGB(vec3(0.66, 0.8, 0.5)) * 1.0;
const vec3 topBoxCol = HSV2RGB(vec3(0.6, 0.9, 1.0)) * 1.0;
const vec3 glowCol0 = HSV2RGB(vec3(0.05, 0.7, 1e-3)) * 1.0;
const vec3 glowCol1 = HSV2RGB(vec3(0.95, 0.7, 1e-3)) * 1.0;
const vec3 beerCol = -HSV2RGB(vec3(0.15 + 0.5, 0.7, 2.0));
const float rrefr_index = 1.0 / refr_index;

// License: Unknown, author: knighty, found: https://www.shadertoy.com/view/MsKGzw
const float poly_cospin = cos(PI / float(poly_type));
const float poly_scospin = sqrt(0.75 - poly_cospin * poly_cospin);
const vec3 poly_nc = vec3(-0.5, -poly_cospin, poly_scospin);
const vec3 poly_pab = vec3(0.0, 0.0, 1.0);
const vec3 poly_pbc_ = vec3(poly_scospin, 0.0, 0.5);
const vec3 poly_pca_ = vec3(0.0, poly_scospin, poly_cospin);
const vec3 poly_p = normalize(
  poly_U * poly_pab + poly_V * poly_pbc_ + poly_W * poly_pca_
);
const vec3 poly_pbc = normalize(poly_pbc_);
const vec3 poly_pca = normalize(poly_pca_);

mat3 g_rot;
vec2 g_gd;

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/noacos/
mat3 rot(vec3 d, vec3 z) {
  vec3 v = cross(z, d);
  float c = dot(z, d);
  float k = 1.0 / (1.0 + c);

  return mat3(
    v.x * v.x * k + c,
    v.y * v.x * k - v.z,
    v.z * v.x * k + v.y,
    v.x * v.y * k + v.z,
    v.y * v.y * k + c,
    v.z * v.y * k - v.x,
    v.x * v.z * k - v.y,
    v.y * v.z * k + v.x,
    v.z * v.z * k + c
  );
}

// License: Unknown, author: Matt Taylor (https://github.com/64), found: https://64.github.io/tonemapping/
vec3 aces_approx(vec3 v) {
  v = max(v, 0.0);
  v *= 0.6;
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp(v * (a * v + b) / (v * (c * v + d) + e), 0.0, 1.0);
}

float sphere(vec3 p, float r) {
  return length(p) - r;
}

// License: MIT, author: Inigo Quilez, found: https://iquilezles.org/articles/distfunctions/
float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// License: Unknown, author: knighty, found: https://www.shadertoy.com/view/MsKGzw
void poly_fold(inout vec3 pos) {
  vec3 p = pos;

  for (int i = 0; i < poly_type; ++i) {
    p.xy = abs(p.xy);
    p -= 2.0 * min(0.0, dot(p, poly_nc)) * poly_nc;
  }

  pos = p;
}

float poly_plane(vec3 pos) {
  float d0 = dot(pos, poly_pab);
  float d1 = dot(pos, poly_pbc);
  float d2 = dot(pos, poly_pca);
  float d = d0;
  d = max(d, d1);
  d = max(d, d2);
  return d;
}

float poly_corner(vec3 pos) {
  float d = length(pos) - 0.0125;
  return d;
}

float dot2(vec3 p) {
  return dot(p, p);
}

float poly_edge(vec3 pos) {
  float dla = dot2(pos - min(0.0, pos.x) * vec3(1.0, 0.0, 0.0));
  float dlb = dot2(pos - min(0.0, pos.y) * vec3(0.0, 1.0, 0.0));
  float dlc = dot2(pos - min(0.0, dot(pos, poly_nc)) * poly_nc);
  return sqrt(min(min(dla, dlb), dlc)) - 2e-3;
}

vec3 shape(vec3 pos) {
  pos *= g_rot;
  pos /= poly_zoom;
  poly_fold(pos);
  pos -= poly_p;

  return vec3(poly_plane(pos), poly_edge(pos), poly_corner(pos)) * poly_zoom;
}

vec3 render0(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);

  float srd = sign(rd.y);
  float tp = -(ro.y - 6.0) / abs(rd.y);

  if (srd < 0.0) {
    col += bottomBoxCol * exp(-0.5 * length((ro + tp * rd).xz));
  }

  if (srd > 0.0) {
    vec3 pos = ro + tp * rd;
    vec2 pp = pos.xz;
    float db = box(pp, vec2(5.0, 9.0)) - 3.0;

    col += topBoxCol * rd.y * rd.y * smoothstep(0.25, 0.0, db);
    col += 0.2 * topBoxCol * exp(-0.5 * max(db, 0.0));
    col += 0.05 * sqrt(topBoxCol) * max(-db, 0.0);
  }

  col += sunCol / (1.001 - dot(sunDir, rd));
  return col;
}

float df2(vec3 p) {
  vec3 ds = shape(p);
  float d2 = ds.y - 5e-3;
  float d0 = min(-ds.x, d2);
  float d1 = sphere(p, inner_sphere);
  g_gd = min(g_gd, vec2(d2, d1));
  float d = min(d0, d1);
  return d;
}

float rayMarch2(vec3 ro, vec3 rd, float tinit) {
  float t = tinit;
  #if defined(BACKSTEP2)
  vec2 dti = vec2(1e10, 0.0);
  #endif
  int i;
  for (i = 0; i < MAX_RAY_MARCHES2; ++i) {
    float d = df2(ro + rd * t);
    #if defined(BACKSTEP2)
    if (d < dti.x) {
      dti = vec2(d, t);
    }
    #endif
    // Bouncing in a closed shell, will never miss
    if (
      d <
      TOLERANCE2 /* || t > MAX_RAY_LENGTH3 */
    ) {
      break;
    }
    t += d;
  }
  #if defined(BACKSTEP2)
  if (i == MAX_RAY_MARCHES2) {
    t = dti.y;
  }
  ;
  #endif
  return t;
}

vec3 normal2(vec3 pos) {
  vec2 eps = vec2(NORM_OFF2, 0.0);
  vec3 nor;
  nor.x = df2(pos + eps.xyy) - df2(pos - eps.xyy);
  nor.y = df2(pos + eps.yxy) - df2(pos - eps.yxy);
  nor.z = df2(pos + eps.yyx) - df2(pos - eps.yyx);
  return normalize(nor);
}

vec3 render2(vec3 ro, vec3 rd, float db) {
  vec3 agg = vec3(0.0);
  float ragg = 1.0;
  float tagg = 0.0;

  for (int bounce = 0; bounce < MAX_BOUNCES2; ++bounce) {
    if (ragg < 0.1) break;
    g_gd = vec2(1e3);
    float t2 = rayMarch2(ro, rd, min(db + 0.05, 0.3));
    vec2 gd2 = g_gd;
    tagg += t2;

    vec3 p2 = ro + rd * t2;
    vec3 n2 = normal2(p2);
    vec3 r2 = reflect(rd, n2);
    vec3 rr2 = refract(rd, n2, rrefr_index);
    float fre2 = 1.0 + dot(n2, rd);

    vec3 beer = ragg * exp(0.2 * beerCol * tagg);
    agg +=
      glowCol1 *
      beer *
      ((1.0 + tagg * tagg * 4e-2) *
        6.0 /
        max(gd2.x, 5e-4 + tagg * tagg * 2e-4 / ragg));
    vec3 ocol = 0.2 * beer * render0(p2, rr2);
    if (gd2.y <= TOLERANCE2) {
      ragg *= 1.0 - 0.9 * fre2;
    } else {
      agg += ocol;
      ragg *= 0.8;
    }

    ro = p2;
    rd = r2;
    db = gd2.x;
  }

  return agg;
}

float df3(vec3 p) {
  vec3 ds = shape(p);
  g_gd = min(g_gd, ds.yz);
  const float sw = 0.02;
  float d1 = min(ds.y, ds.z) - sw;
  float d0 = ds.x;
  d0 = min(d0, ds.y);
  d0 = min(d0, ds.z);
  return d0;
}

float rayMarch3(vec3 ro, vec3 rd, float tinit, out int iter) {
  float t = tinit;
  int i;
  for (i = 0; i < MAX_RAY_MARCHES3; ++i) {
    float d = df3(ro + rd * t);
    if (d < TOLERANCE3 || t > MAX_RAY_LENGTH3) {
      break;
    }
    t += d;
  }
  iter = i;
  return t;
}

vec3 normal3(vec3 pos) {
  vec2 eps = vec2(NORM_OFF3, 0.0);
  vec3 nor;
  nor.x = df3(pos + eps.xyy) - df3(pos - eps.xyy);
  nor.y = df3(pos + eps.yxy) - df3(pos - eps.yxy);
  nor.z = df3(pos + eps.yyx) - df3(pos - eps.yyx);
  return normalize(nor);
}

vec3 render3(vec3 ro, vec3 rd) {
  int iter;

  vec3 skyCol = render0(ro, rd);
  vec3 col = skyCol;

  g_gd = vec2(1e3);
  float t1 = rayMarch3(ro, rd, 0.1, iter);
  vec2 gd1 = g_gd;
  vec3 p1 = ro + t1 * rd;
  vec3 n1 = normal3(p1);
  vec3 r1 = reflect(rd, n1);
  vec3 rr1 = refract(rd, n1, refr_index);
  float fre1 = 1.0 + dot(rd, n1);
  fre1 *= fre1;

  float ifo = mix(
    0.5,
    1.0,
    smoothstep(1.0, 0.9, float(iter) / float(MAX_RAY_MARCHES3))
  );

  if (t1 < MAX_RAY_LENGTH3) {
    col = render0(p1, r1) * (0.5 + 0.5 * fre1) * ifo;
    vec3 icol = render2(p1, rr1, gd1.x);
    if (gd1.x > TOLERANCE3 && gd1.y > TOLERANCE3 && rr1 != vec3(0.0)) {
      col += icol * (1.0 - 0.75 * fre1) * ifo;
    }
  }

  col += (glowCol0 + 1.0 * fre1 * glowCol0) / max(gd1.x, 3e-4);
  return col;

}

vec3 effect(vec2 p, vec2 pp) {
  const float fov = 2.0;

  const vec3 up = vec3(0.0, 1.0, 0.0);
  const vec3 la = vec3(0.0);

  const vec3 ww = normalize(normalize(la - rayOrigin));
  const vec3 uu = normalize(cross(up, ww));
  const vec3 vv = cross(ww, uu);

  vec3 rd = normalize(-p.x * uu + p.y * vv + fov * ww);

  vec3 col = vec3(0.0);
  col = render3(rayOrigin, rd);

  col -= 2e-2 * vec3(2.0, 3.0, 1.0) * (length(p) + 0.25);
  col = aces_approx(col);
  col = sqrt(col);
  return col;
}

void main() {
  vec2 q = gl_FragCoord.xy / iResolution.xy;
  vec2 p = -1.0 + 2.0 * q;
  vec2 pp = p;
  p.x *= iResolution.x / iResolution.y;

  float a = iTime * rotation_speed;
  vec3 r0 = vec3(1.0, sin(vec2(sqrt(0.5), 1.0) * a));
  vec3 r1 = vec3(cos(vec2(sqrt(0.5), 1.0) * 0.913 * a), 1.0);
  mat3 rot = rot(normalize(r0), normalize(r1));
  g_rot = rot;

  vec3 col = effect(p, pp);

  gl_FragColor = vec4(col, 1.0);
}


    
    `,
    thumbnail: img3,
  },
];

const builtinHTMLBackgrounds = [
  {
    title: "",
    code: `
    <!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>System Monitor</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
          Cantarell, sans-serif;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .panel {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 24px;
        padding: 32px;
        width: 380px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .panel-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 28px;
      }

      .panel-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .panel-icon svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      .panel-title {
        color: white;
        font-size: 22px;
        font-weight: 600;
      }

      .panel-subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin-top: 2px;
      }

      .stat-item {
        margin-bottom: 24px;
      }

      .stat-item:last-child {
        margin-bottom: 0;
      }

      .stat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .stat-label {
        color: rgba(255, 255, 255, 0.8);
        font-size: 15px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .stat-label svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }

      .stat-value {
        color: white;
        font-size: 15px;
        font-weight: 600;
      }

      .progress-bar {
        height: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 5px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        border-radius: 5px;
        transition: width 0.5s ease;
      }

      .progress-fill.cpu {
        background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
      }

      .progress-fill.memory {
        background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
      }

      .stat-details {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
      }

      .loading {
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        padding: 40px;
        font-size: 15px;
      }

      .error {
        color: #ff6b6b;
        text-align: center;
        padding: 20px;
        font-size: 14px;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .loading {
        animation: pulse 1.5s ease-in-out infinite;
      }

      .test-button {
        margin-top: 20px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition:
          transform 0.2s,
          box-shadow 0.2s;
      }

      .test-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .test-button:active {
        transform: translateY(0);
      }

      .click-feedback {
        margin-top: 12px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #4facfe;
        font-size: 13px;
        text-align: center;
        display: none;
      }

      .click-feedback.show {
        display: block;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <!-- Loading State -->
      <div id="loading" class="loading">Loading system info...</div>

      <!-- Main Panel (Hidden until data loads) -->
      <div id="panel" class="panel" style="display: none">
        <div class="panel-header">
          <div class="panel-icon">
            <svg viewBox="0 0 24 24">
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm3-6c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"
              />
            </svg>
          </div>
          <div>
            <div class="panel-title">System Monitor</div>
            <div class="panel-subtitle">Real-time system statistics</div>
          </div>
        </div>

        <!-- CPU Stats -->
        <div class="stat-item">
          <div class="stat-header">
            <div class="stat-label">
              <svg viewBox="0 0 24 24">
                <path
                  d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"
                />
              </svg>
              CPU Usage
            </div>
            <div class="stat-value" id="cpu-value">0.0%</div>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill cpu"
              id="cpu-progress"
              style="width: 0%"
            ></div>
          </div>
        </div>

        <!-- Memory Stats -->
        <div class="stat-item">
          <div class="stat-header">
            <div class="stat-label">
              <svg viewBox="0 0 24 24">
                <path
                  d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"
                />
              </svg>
              Memory Usage
            </div>
            <div class="stat-value" id="memory-value">0.0%</div>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill memory"
              id="memory-progress"
              style="width: 0%"
            ></div>
          </div>
          <div class="stat-details">
            <span>Used: <span id="memory-used">0 MB</span></span>
            <span>Total: <span id="memory-total">0 MB</span></span>
          </div>
        </div>

        <!-- Test Button for Click Event -->
        <button class="test-button" id="test-button">
          🧪 Test Click Event
        </button>
        <div class="click-feedback" id="click-feedback">
          Click event triggered! 🎉
        </div>
      </div>

      <!-- Error State (Hidden by default) -->
      <div id="error" class="error" style="display: none"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>

    <!-- Region built-sdk, please don't remove it!!!  -->
    <!-- 内置的用于通信的sdk不要移除 -->
    <script>
      const pendingCallbacks = new Map();

      const generateId = () =>
        "msg_" + Date.now() + "_" + +Math.random().toString(36).substr(2, 9);

      window.addEventListener("message", async (event) => {
        const data = event.data;

        if (data && data.id) {
          const callback = pendingCallbacks.get(data.id);
          if (callback) {
            // 有回调，说明是响应消息
            if (data.code === 200) {
              callback.resolve(data);
            } else {
              callback.reject(new Error(data.msg));
            }
            pendingCallbacks.delete(data.id);
          } else {
            // 没有回调，说明是请求消息，需要处理
            console.log("收到消息----", data.method);

            // action from shell
            switch (data.method) {
              case "screenshot":
                const canvas = await html2canvas(document.body, {
                  backgroundColor: "#1a1a2e",
                  scale: 0.5,
                });
                window.parent.postMessage(
                  {
                    id: data.id,
                    method: data.method,
                    code: 200,
                    data: canvas.toDataURL("image/png"),
                  },
                  "*",
                );
                break;

              default:
                window.parent.postMessage(
                  {
                    id: data.id,
                    method: data.method,
                    code: 404,
                    data: null,
                    msg: "unknown method",
                  },
                  "*",
                );
                break;
            }
          }
          return;
        }
      });

      async function invoke(data_type, payload) {
        return new Promise((resolve, reject) => {
          const id = generateId();
          pendingCallbacks.set(id, { resolve, reject });
          parent.postMessage({ id, method: data_type, payload }, "*");
          setTimeout(() => {
            if (pendingCallbacks.has(id)) {
              pendingCallbacks.delete(id);
              reject(new Error("Request timeout"));
            }
          }, 10000);
        });
      }
    </script>
    <!-- Endregion -->

    <script>
      function formatBytes(mb) {
        if (mb >= 1024) {
          return (mb / 1024).toFixed(2) + " GB";
        }
        return mb + " MB";
      }

      // DOM elements cache
      const elements = {
        loading: document.getElementById("loading"),
        panel: document.getElementById("panel"),
        error: document.getElementById("error"),
        cpuValue: document.getElementById("cpu-value"),
        cpuProgress: document.getElementById("cpu-progress"),
        memoryValue: document.getElementById("memory-value"),
        memoryProgress: document.getElementById("memory-progress"),
        memoryUsed: document.getElementById("memory-used"),
        memoryTotal: document.getElementById("memory-total"),
        testButton: document.getElementById("test-button"),
        clickFeedback: document.getElementById("click-feedback"),
      };

      function updatePanel(data) {
        const {
          cpu_usage_percent,
          memory_used,
          memory_total,
          memory_usage_percent,
        } = data;

        // Update CPU
        elements.cpuValue.textContent = cpu_usage_percent.toFixed(1) + "%";
        elements.cpuProgress.style.width =
          Math.min(cpu_usage_percent, 100) + "%";

        // Update Memory
        elements.memoryValue.textContent =
          memory_usage_percent.toFixed(1) + "%";
        elements.memoryProgress.style.width =
          Math.min(memory_usage_percent, 100) + "%";
        elements.memoryUsed.textContent = formatBytes(memory_used);
        elements.memoryTotal.textContent = formatBytes(memory_total);
      }

      function showLoading() {
        elements.loading.style.display = "block";
        elements.panel.style.display = "none";
        elements.error.style.display = "none";
      }

      function showPanel() {
        elements.loading.style.display = "none";
        elements.panel.style.display = "block";
        elements.error.style.display = "none";
      }

      function showError(message) {
        elements.loading.style.display = "none";
        elements.panel.style.display = "none";
        elements.error.style.display = "block";
        elements.error.textContent = "Error: " + message;
      }

      async function updateStats() {
        try {
          const result = await invoke("get_system_stats");

          if (result.code === 200) {
            // First load - show panel
            if (elements.loading.style.display !== "none") {
              showPanel();
            }
            updatePanel(result.data);
          } else {
            showError(result.message || "Failed to get system info");
          }
        } catch (error) {
          showError(error.message);
        }
      }

      window.onload = async () => {
        // Initial load
        await updateStats();

        // Refresh every 2 seconds
        setInterval(updateStats, 2000);

        // invoke("open_executable", { path: "/Applications/Google Chrome.app" });

        // Test button click event
        if (elements.testButton) {
          elements.testButton.addEventListener("click", () => {
            // Show feedback
            elements.clickFeedback.classList.add("show");

            // Log to console for debugging
            console.log("Test button clicked! Click event is working.");

            // Optional: Send event to backend
            invoke("on_wallpaper_click", { source: "test-button" }).catch(
              (err) => {
                console.log(
                  "Could not invoke on_wallpaper_click:",
                  err.message,
                );
              },
            );

            // Hide feedback after 2 seconds
            setTimeout(() => {
              elements.clickFeedback.classList.remove("show");
            }, 2000);
          });
        }
      };
    </script>
  </body>
</html>

    `,
  },
];

export { builtinShaderBackgrounds, builtinHTMLBackgrounds };
