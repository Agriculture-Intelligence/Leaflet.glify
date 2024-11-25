precision mediump float;
varying vec4 _color;
varying vec2 _texCoord;
uniform sampler2D uTexture;
uniform vec2 u_textureSize;
uniform float u_outlineThickness;

const float FEATHER_RADIUS = 0.3;
const float OUTLINE_INTENSITY = 0.99;
const float OUTLINE_THRESHOLD = 0.01;
const float EDGE_BLEND = 0.5; // Controls how much the outline blends at the edge

const bool ENABLE_COLOR_REPLACE = false;
const bool ENABLE_OUTLINE = false;

vec4 sampleTexture(vec2 uv, vec2 offset) {
    vec2 sampleCoord = clamp(uv + offset, 0.0, 1.0);
    return texture2D(uTexture, sampleCoord);
}

void main() {
    vec2 adjustedTexCoord = gl_PointCoord - _texCoord;
    adjustedTexCoord = clamp(adjustedTexCoord, 0.0, 1.0);
    
    float pixelSize = 1.0 / max(u_textureSize.x, u_textureSize.y);
    float offset = pixelSize * u_outlineThickness * FEATHER_RADIUS;
    
    vec4 centerColor = sampleTexture(adjustedTexCoord, vec2(0.0, 0.0));
    vec4 color = centerColor;
    float alpha = centerColor.a;
    
    if (ENABLE_OUTLINE) {
        // Sample neighboring pixels
        color += sampleTexture(adjustedTexCoord, vec2(-offset, -offset));
        color += sampleTexture(adjustedTexCoord, vec2(-offset, offset));
        color += sampleTexture(adjustedTexCoord, vec2(offset, -offset));
        color += sampleTexture(adjustedTexCoord, vec2(offset, offset));
        
        // Average the samples
        color /= 5.0;
        
        // Outline check
        float outlineCheck = 0.0;
        for (float i = -1.0; i <= 1.0; i += 1.0) {
            for (float j = -1.0; j <= 1.0; j += 1.0) {
                vec2 sampleCoord = adjustedTexCoord + vec2(i, j) * pixelSize * u_outlineThickness;
                outlineCheck += sampleTexture(sampleCoord, vec2(0.0, 0.0)).a;
            }
        }
        
        // Normalize and adjust outline check
        outlineCheck = outlineCheck / 9.0;
        outlineCheck = smoothstep(OUTLINE_THRESHOLD, OUTLINE_THRESHOLD + FEATHER_RADIUS, outlineCheck);
        
        // Calculate outline strength with edge blending
        float outlineStrength = outlineCheck * OUTLINE_INTENSITY;
        float edgeBlend = smoothstep(0.0, EDGE_BLEND, alpha);
        
        // Blend outline with the texture
        vec4 outlineColor = vec4(0.0, 0.0, 0.0, 1.0);
        vec4 finalColor = mix(outlineColor, color, edgeBlend);
        
        // Apply outline only where needed
        if (alpha < OUTLINE_THRESHOLD) {
            finalColor = mix(vec4(0.0, 0.0, 0.0, outlineStrength), finalColor, edgeBlend);
        }
        
        color = finalColor;
    }
    
    if (ENABLE_COLOR_REPLACE) {
        // Replace black pixels with the chosen color
        float threshold = 0.01;
        if (color.r < threshold && color.g < threshold && color.b < threshold && alpha > OUTLINE_THRESHOLD) {
            color.rgb = _color.rgb;
        }
    }
    
    gl_FragColor = color * _color;
}