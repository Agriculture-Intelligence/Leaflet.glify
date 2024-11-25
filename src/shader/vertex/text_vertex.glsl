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

out vec2 vTexCoord;
out vec4 vColor;

void main() {
  vec2 pos = ((position * (instanceTexCoord.zw * uGlobalScale) / uScale) + (instancePosition + vec2((instanceOffsetX * uGlobalScale) / uScale, 0.0))) + (instanceOffset / uScale) + ((vec2(instanceTextOffset.x, -instanceTextOffset.y) * uGlobalScale) / uScale);
  gl_Position = matrix * vec4(pos, 0.0, 1.0);

  vec2 pixelPos = position * instanceTexCoord.zw + instanceTexCoord.xy;
  vTexCoord = (pixelPos + 0.5) / atlasSize;

  vColor = instanceColor;
}