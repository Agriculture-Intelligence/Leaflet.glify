precision mediump float;
varying vec4 _color;
varying vec2 _texCoord;
uniform sampler2D uTexture;
uniform vec2 u_textureSize;
uniform float u_outlineThickness;

void main() {
  vec2 adjustedTexCoord = gl_PointCoord - _texCoord;
  adjustedTexCoord = clamp(adjustedTexCoord, 0.0, 1.0);
  
  vec4 texColor = texture2D(uTexture, adjustedTexCoord);
  
  // Replace black pixels with the chosen color
  float threshold = 0.01;
  if (texColor.r < threshold && texColor.g < threshold && texColor.b < threshold) {
    texColor.rgb = _color.rgb;
  }
  
  // Simple outline check
  float pixelSize = 1.0 / max(u_textureSize.x, u_textureSize.y);
  float outlineCheck = 0.0;
  
  for (float i = -1.0; i <= 1.0; i += 1.0) {
    for (float j = -1.0; j <= 1.0; j += 1.0) {
      vec2 sampleCoord = adjustedTexCoord + vec2(i, j) * pixelSize * u_outlineThickness;
      outlineCheck += texture2D(uTexture, sampleCoord).a;
    }
  }
  
  // If current pixel is transparent but has non-transparent neighbors, it's part of the outline
  if (texColor.a < 0.1 && outlineCheck > 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black outline
  } else {
    gl_FragColor = texColor * _color;
  }
}