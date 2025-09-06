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
  uniform float u_ditherScale;
  uniform float u_ditherThreshold;
  uniform float u_bayerLevel;
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

  // Define Bayer matrices first
  float bayer2(vec2 coord) {
      mat2 m = mat2(
          0.0, 0.5,
          0.75, 0.25
      );
      return m[int(coord.x)][int(coord.y)];
  }

  float bayer4(vec2 coord) {
      mat4 m = mat4(
          0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
          12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
          3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
          15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
      );
      return m[int(coord.x)][int(coord.y)];
  }

  float bayer8(vec2 coord) {
      return bayer4(mod(coord, 4.0)); // Simplified 8x8 pattern
  }

  // Now define the bayerMatrix function that uses them
  float bayerMatrix(vec2 coord, float level) {
      vec2 bayerCoord = floor(mod(coord, level));
      if(level == 2.0) return bayer2(bayerCoord);
      if(level == 4.0) return bayer4(bayerCoord);
      if(level == 8.0) return bayer8(bayerCoord);
      return 0.0;
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
      
      // Obra Dinn style dithering
      float dither = bayerMatrix(gl_FragCoord.xy / u_ditherScale, u_bayerLevel);
      float pattern = step(dither, n + u_ditherThreshold);
      
      // Change to Obra Dinn's green-tinted monochrome
      vec3 darkColor = vec3(0.85, 1.0, 0.8);  // Dark olive green
      vec3 lightColor = vec3(0.05, 0.07, 0.03);  // Slightly green-tinted white
      vec3 color = mix(darkColor, lightColor, pattern);
      
      gl_FragColor = vec4(color, 1.0);
  }
`
