#version 300 es
precision highp float;

in vec2 vTexCoord;
in vec4 vColor;

uniform sampler2D fontTexture;
uniform float smoothing;
uniform vec2 atlasSize;
uniform float uGlobalScale;
uniform float pxRangeConst; 

uniform float uScale;

out vec4 fragColor;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float screenPxRange() {
    vec2 unitRange = vec2(pxRangeConst) / atlasSize;
    // TODO improve this. 
    vec2 screenTexSize = vec2(1.0) / (fwidth(vTexCoord) * (uScale * 256.0));
    return max(0.5 * dot(unitRange, screenTexSize), 1.0);
}

void main() {
    vec2 msdfUnit = 1.0 / atlasSize;
    vec2 texCoord = vTexCoord;

    // 3x3 Super-sampling
        vec3 sum = vec3(0.0);
        for(int i = -1; i <= 1; i++) {
            for(int j = -1; j <= 1; j++) {
                vec2 offset = vec2(float(i), float(j)) * msdfUnit;
                sum += texture(fontTexture, texCoord + offset).rgb;
            }
        }
        vec3 textureSample = sum / 9.0;
    
    float signedDistance = median(textureSample.r, textureSample.g, textureSample.b);
    
    float pxRange = screenPxRange();
    float screenPxDistance = pxRange * (signedDistance - 0.5);

    float opacity = smoothstep(0.0, 1.0, screenPxDistance + 0.5);
    
    // Apply subtle smoothing
    opacity = smoothstep(0.5 - smoothing, 0.5 + smoothing, opacity);

    fragColor = vec4(vColor.rgb, vColor.a * opacity);
}
// POTENTIALLY ONLY WEBGL2 COMPATIBLE

// INFO THIS ONE IS FOR SURE COMPATIBLE EVERYWHERE
// // FRAGMENT SHADER
// precision highp float;

// varying vec2 vTexCoord;
// varying vec4 vColor;

// uniform sampler2D fontTexture;
// uniform float smoothing;

// float median(float r, float g, float b) {
//     return max(min(r, g), min(max(r, g), b));
// }

// void main() {
//     // Sample all three channels of the MSDF texture
//     vec3 sample = texture2D(fontTexture, vTexCoord).rgb;
    
//     // Calculate the signed distance using the median of the three channels
//     float signedDistance = median(sample.r, sample.g, sample.b);
    
//     // Apply smoothstep thresholding (kept as in the original shader)
//     float alpha = smoothstep(0.5 - smoothing, 0.5 + smoothing, signedDistance);
    
//     gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
// }