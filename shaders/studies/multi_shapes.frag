#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

// == Signed distance geometric functions
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ap = p - a;
    vec2 ab = b - a;
    float h = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    return length(ap - ab * h);
}

float sdCircle(vec2 p, vec2 center, float r) {
    return length(p - center) - r;
}

// == Shading
float fill(float d) {
    float aa = fwidth(d);                 // antialiasing
    return 1.0 - smoothstep(-aa, +aa, d); // solid
}

float stroke(float d, float w) {
    float aa = fwidth(d);                 // antialiasing
    return 1.0 - smoothstep(w - aa, w + aa, abs(d)); // outline if not a line
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float dLine1 = sdSegment(uv, vec2(0.0, 0.0), vec2(1.0, 5.5));
    float dLine2 = sdSegment(uv, vec2(0.0, 0.0), vec2(1.0, -5.5));
    float dCircle1 = sdCircle(uv, vec2(-0.2, 0.0), 0.05);
    float dCircle2 = sdCircle(uv, vec2(0.0, 0.0), 0.3);

    // mixing method 1: same color
    float scene = min(dLine1, dCircle1); // union
    float filledScene = fill(scene);
    vec3 col = mix(vec3(0.05), vec3(1.0), filledScene);

    // mixing method 2: different colors
    col = mix(col, vec3(1.0, 0.0, 0.0), stroke(dLine2, 0.001));
    col = mix(col, vec3(0.0, 1.0, 0.0), stroke(dCircle2, 0.001));

    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
