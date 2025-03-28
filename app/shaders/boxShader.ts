export const vertexShader = `
  varying vec2 v_uv;
  
  void main() {
    v_uv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const fragmentShader = `
  precision mediump float;

  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec2 u_resolution;
  uniform int u_pattern;
  varying vec2 v_uv;

  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  vec2 rotate2D(vec2 p, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
      vec2 uv = v_uv;
      vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
      uv = uv * aspect;
      
      float dist = distance(u_mouse * aspect, uv);
      float mouseInfluence = exp(-dist * 8.0);
      
      vec2 rotatedUV = rotate2D(uv - 0.5 * aspect, u_time * 0.2);
      
      float n = noise(rotatedUV * 2.0 + u_time * 0.2);
      n += noise(rotatedUV * 4.0 - u_time * 0.3) * 0.5;
      n += noise(rotatedUV * 8.0 + u_time * 0.4) * 0.25;
      
      n = n * (1.0 + mouseInfluence);
      
      vec3 color1 = vec3(0.1);    // dark gray
      vec3 color2 = vec3(0.0);    // black
      vec3 finalColor;

      if (u_pattern == 0) {
          // Original pattern
          finalColor = mix(color1, color2, n);
      } 
      else if (u_pattern == 1) {
          // Dithering
          float dither = random(gl_FragCoord.xy / 2.0);
          float pattern = step(dither, n);
          finalColor = mix(color1, color2, pattern);
      }
      else if (u_pattern == 2) {
          // Dot pattern
          vec2 center = fract(uv * 20.0) - 0.5;
          float dots = length(center);
          dots = 1.0 - smoothstep(0.1 + n * 0.2, 0.11 + n * 0.2, dots);
          finalColor = mix(color2, color1, dots);
      }
      else if (u_pattern == 3) {
          // Line pattern
          float lines = sin(uv.x * 50.0 + n * 10.0) * sin(uv.y * 50.0 + n * 10.0);
          lines = smoothstep(0.0, 0.1, abs(lines));
          finalColor = mix(color1, color2, lines);
      }
      else if (u_pattern == 4) {
          // Cellular pattern
          vec2 cell = fract(uv * 8.0) - 0.5;
          float cells = length(cell);
          cells = smoothstep(0.4 + n * 0.2, 0.41 + n * 0.2, cells);
          finalColor = mix(color1, color2, cells);
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
  }
`
