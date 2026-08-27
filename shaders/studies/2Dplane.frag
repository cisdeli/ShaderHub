#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

// == Signed distance geometric functions
float sdPlane(vec2 p, vec2 n, float h) { // n must be normalized
    return dot(p, n) - h;
}

// == Shading
float fill(float d) {
    float aa = fwidth(d);
    return 1.0 - smoothstep(-aa, aa, d);
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    vec2 b = vec2(0.0, 0.0);
    vec2 a = vec2(1.0, 0.0);
    // vec2 dir = normalize(b - a);
    // vec2 n = vec2(-dir.y, dir.x);
    // float h = dot(a, n);

    float ang = iTime * 0.5;
    vec2 n = vec2(cos(ang), sin(ang));
    float h = 0.0;
    // float h = sin(iTime) * 0.5;
    float dPlane = sdPlane(uv, n, h);

    float scene = fill(dPlane);

    vec3 col = mix(vec3(0.05), vec3(1.0), scene);
    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
