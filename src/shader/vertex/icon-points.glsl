uniform mat4 matrix;
attribute vec2 vertex;
attribute vec4 color;
attribute float pointSize;
attribute vec2 texCoord;
attribute float offsetZ;
varying vec4 _color;
varying vec2 _texCoord;

void main() {
  gl_PointSize = pointSize;
  gl_Position = matrix * vec4(vertex, 1.0  - offsetZ, 1.0);
  _color = color;
  _texCoord = texCoord;
}