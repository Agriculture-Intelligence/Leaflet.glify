#version 300 es
precision highp float;

in vec2 vTexCoord;
in vec4 vColor;

uniform sampler2D fontTexture;
uniform float smoothing;
uniform vec2 atlasSize;

uniform float pxRangeConst; 

out vec4 fragColor;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
    vec2 unitRange = vec2(pxRangeConst) / vec2(textureSize(fontTexture, 0));
    vec2 screenTexSize = vec2(1.0) / fwidth(vTexCoord);
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

void main() {
    vec2 msdfUnit = 1.0 / atlasSize;
    vec2 texCoord = vTexCoord;
    
    // Adjust texture sampling to be pixel-perfect
    texCoord = floor(texCoord * atlasSize) / atlasSize;
    
    // Super-sampling
    vec3 s0 = texture(fontTexture, texCoord).rgb;
    vec3 s1 = texture(fontTexture, texCoord + vec2(msdfUnit.x, 0.0)).rgb;
    vec3 s2 = texture(fontTexture, texCoord + vec2(0.0, msdfUnit.y)).rgb;
    vec3 s3 = texture(fontTexture, texCoord + msdfUnit).rgb;
    
    vec3 textureSample = 0.25 * (s0 + s1 + s2 + s3);
    
    float signedDistance = median(textureSample.r, textureSample.g, textureSample.b);
    
    float pxRange = screenPxRange();
    float screenPxDistance = pxRange * (signedDistance - 0.5);
    float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);
    
    // Apply subtle smoothing
    opacity = smoothstep(0.48 - smoothing, 0.52 + smoothing, opacity);

    fragColor = vec4(vColor.rgb, vColor.a * opacity);
}
