#version 300 es

uniform mat4 matrix;
uniform float uScale;
uniform float uGlobalScale;
uniform vec2 atlasSize;

in vec2 position;
in vec2 instancePosition;
in float instanceOffsetX;
in vec4 instanceTexCoord;
in vec4 instanceColor;
in vec2 instanceOffset;
in vec2 instanceTextOffset;

in float offsetZ;

out vec2 vTexCoord;
out vec4 vColor;

void main() {
  vec2 pos = ((position * (instanceTexCoord.zw * uGlobalScale) / uScale) + (instancePosition + vec2((instanceOffsetX * uGlobalScale) / uScale, 0.0))) + (instanceOffset / uScale) + ((vec2(instanceTextOffset.x, instanceTextOffset.y) * uGlobalScale) / uScale);

  gl_Position = matrix * vec4(pos, 1.0  - offsetZ, 1.0);

  vec2 pixelPos = position * instanceTexCoord.zw + instanceTexCoord.xy;
  vTexCoord = (pixelPos + 0.5) / atlasSize;

  vColor = instanceColor;
}

// // VERTEX SHADER
// attribute vec2 position;
// // attribute vec2 texCoord;
// attribute vec2 instancePosition;
// attribute float instanceOffsetX;
// attribute vec4 instanceTexCoord;
// attribute vec4 instanceColor;
// attribute vec2 instanceOffset;

// uniform mat4 matrix;
// uniform float uScale;
// uniform vec2 atlasSize;

// varying vec2 vTexCoord;
// varying vec4 vColor;

// void main() {
//   vec2 pos = ((position * (instanceTexCoord.zw / uScale)) + (instancePosition + vec2((instanceOffsetX / uScale), 0.0))) + (instanceOffset / uScale);
//   gl_Position = matrix * vec4(pos, 0.0, 1.0);
//   vTexCoord = (position * instanceTexCoord.zw + instanceTexCoord.xy) / atlasSize;
//   vColor = instanceColor;
// }