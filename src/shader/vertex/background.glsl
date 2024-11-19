#version 300 es

uniform mat4 matrix;
uniform float uScale;
uniform float uGlobalScale;

in vec4 position;
in vec2 size;
in vec4 color;
in vec2 offset;
in float offsetZ;
in vec2 rangeXY;

out vec4 vColor;
out vec2 vPosition;
out vec2 vSize;

void main() {

  vec2 transformedSize = size + ((position.zw * vec2(uGlobalScale)) * vec2(2.0)) + (rangeXY * vec2(uGlobalScale));

  vec2 sizeOffset = vec2(
    float(gl_VertexID % 2),
    float(gl_VertexID / 2)
  ) * (transformedSize * uGlobalScale) / uScale;

  vec2 transformedOffset = offset - (position.zw / (1.0 / uGlobalScale)) * uGlobalScale + (rangeXY / 2.0) * uGlobalScale;

  vec2 scaledOffset = transformedOffset / uScale;
  
  vec4 pos = vec4(position.xy, 0.0, 0.0) + vec4(sizeOffset, 0.0, 0.0) + vec4(scaledOffset, 0.0, 0.0);

  gl_Position = matrix * vec4(pos.xy, 1.0 - offsetZ, 1.0);
  
  vColor = color;
  vPosition = pos.xy - position.xy - scaledOffset;
  vSize = (transformedSize / uScale) * uGlobalScale;
}