precision mediump float;
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
