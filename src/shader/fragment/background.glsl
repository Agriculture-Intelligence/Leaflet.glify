#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vPosition;
in vec2 vSize;
out vec4 fragColor;

uniform float uCornerRadius;
uniform float uOutlineThickness;
uniform float uScale;
uniform float uGlobalScale;

float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
  return length(max(abs(centerPosition) - size + radius, 0.0)) - radius;
}

void main() {
  // Scale the position and size back to screen pixels
  vec2 scaledPosition = vPosition * uScale;
  vec2 scaledSize = vSize * uScale;
  
  // Use the original (unscaled) corner radius and outline thickness
  float scaledDistance = roundedBoxSDF(scaledPosition - scaledSize / 2.0, scaledSize / 2.0, (uCornerRadius / 1.5) * uGlobalScale);
  
  // Convert the distance back to world units
  float dist = scaledDistance / uScale;
  
  float outerEdge = 0.0;
  float innerEdge = -(uOutlineThickness * uGlobalScale) / uScale;
  
  // Adjust the smoothstep range based on the scale
  float smoothRange = 0.5 / uScale;
  float outerRegion = smoothstep(-smoothRange, smoothRange, dist - outerEdge);
  float innerRegion = smoothstep(-smoothRange*5.0, smoothRange*0.75, dist - innerEdge);
  
  vec4 outlineColor = vec4(0.0, 0.0, 0.0, 1.0);
  
  vec4 color = mix(vColor, outlineColor, innerRegion);
  color = mix(color, vec4(0.0, 0.0, 0.0, 0.0), outerRegion);

  float alpha = smoothstep(-(2.0 / uScale), (2.0 / uScale), -dist);
  fragColor = vec4(color.rgb, color.a * alpha);
}

// #version 300 es
// precision highp float;
// in vec4 vColor;
// in vec2 vPosition;
// in vec2 vSize;
// out vec4 fragColor;
// uniform float uCornerRadius;
// uniform float uOutlineThickness;
// uniform float uScale;

// float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
//   return length(max(abs(centerPosition) - size + radius, 0.0)) - radius;
// }

// void main() {
//   float uCornerRadius = uCornerRadius;

//   // Scale the position and size back to screen pixels
//   vec2 scaledPosition = vPosition * uScale;
//   vec2 scaledSize = vSize * uScale;
  
//   // Use the original (unscaled) corner radius and outline thickness
//   float scaledDistance = roundedBoxSDF(scaledPosition - scaledSize / 2.0, scaledSize / 2.0, (uCornerRadius / 1.5));
  
//   // Convert the distance back to world units
//   float distance = scaledDistance / uScale ;
  
//   float outerEdge = 0.0;
//   float innerEdge = -uOutlineThickness / uScale;
  
//   // Adjust the smoothstep range based on the scale
//   float smoothRange = 0.5 / uScale;
//   float outerRegion = smoothstep(-smoothRange, smoothRange, distance - outerEdge);
//   float innerRegion = smoothstep(-smoothRange, smoothRange, distance - innerEdge);
  
//   vec4 outlineColor = vec4(0.0, 0.0, 0.0, 1.0);
  
//   vec4 color = mix(vColor, outlineColor, innerRegion);
//   color = mix(color, vec4(0.0, 0.0, 0.0, 0.0), outerRegion);
  
//   fragColor = color;
// }