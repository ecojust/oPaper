precision highp float;
        varying vec2 vUV;
        uniform float iTime;
        uniform vec2 iResolution;
        void main(void) {
          vec2 uv = vUV;
          vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0,2.0,4.0));
          gl_FragColor = vec4(col, 1.0);
        }