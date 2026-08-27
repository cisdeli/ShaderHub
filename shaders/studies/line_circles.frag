#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

float sdSegment(vec2 a, vec2 b, vec2 c) {
    vec2 ac = c - a;
    vec2 ab = b - a;
    float h = clamp(dot(ac, ab) / dot(ab, ab), 0.0, 1.0);
    return length(ac - ab * h);
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float d1 = sdSegment(vec2(0.0, 0.0), vec2(1.0, 5.5), uv);
    // float d1 = length(uv - vec2(-0.2, 0.0)) - 0.05;
    float d2 = length(uv - vec2( 0.2, 0.0)) - 0.25;
    float d = min(d1, d2);      // union

    // float d = length(uv) - 0.3; // circle, radius = 0.3
    float aa = fwidth(d);       // antialiasing
    float thickness = 0.01;
    float line = 1.0 - smoothstep(thickness - aa, thickness + aa, d);
    vec3 col = mix(vec3(0.05), vec3(1.0), line);

    fc = vec4(col, 1.0);
    // fc = vec4(vec3(d < 0.0 ? 1.0 : 0.0), 1.0);
    // fc = vec4(vec3(0.5 + 5.0 * d), 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
