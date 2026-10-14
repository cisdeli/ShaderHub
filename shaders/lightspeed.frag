#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

const vec2 TORUS_PARAMS = vec2(8.0, 0.3);
const int NUM_LAYERS = 3;
const float LAYER_SPACING = 0.05;
const float TAU = 6.2832;
const int MAX_STEPS = 200;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

bool is_dot_layer(float u, float v, float fl, out float dot_seed) {
    float dots_u = 200.0 + fl * 47.0;
    float dots_v = 50.0 + fl * 11.0;
    float layer_phase = fl * 37.0;

    vec2 raw = vec2(u / TAU * dots_u - iTime * (6.0 - fl * 0.8) + layer_phase,
            v / TAU * dots_v + layer_phase);

    vec2 cell_id = floor(raw) + fl * 1000.0;
    dot_seed = hash(cell_id);

    if (hash(cell_id + vec2(91.0, 47.0)) > 0.6) return false;

    vec2 jitter = vec2(hash(cell_id + 5.0), hash(cell_id + 9.0)) - 0.5;
    vec2 cell = fract(raw) - 0.5 - jitter * 0.3;

    float stretch = mix(2.0, 6.0, hash(cell_id + 3.0));
    float r = mix(0.04, 0.06, dot_seed);

    vec2 e = vec2(cell.x / stretch, cell.y);
    return dot(e, e) < r * r;
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    //Color palette ref: https://iquilezles.org/articles/palettes/
    vec3 pa = vec3(0.5, 0.4, 0.6), pb = vec3(0.5, 0.4, 0.4);
    vec3 pc = vec3(1.0, 1.0, 0.7), pd = vec3(0.0, 0.2, 0.5);

    float theta = iTime * 0.5;
    vec3 radial = vec3(cos(theta), 0.0, sin(theta));
    // Raymarching and putting the camera inside the torus
    vec3 ro = radial * TORUS_PARAMS.x;
    vec3 fwd = vec3(-radial.z, 0.0, radial.x);
    vec3 rd = normalize(uv.x * radial + vec3(0.0, uv.y, 0.0) + 1.2 * fwd);

    int steps = int(min(iTime * 10.0, float(MAX_STEPS)));
    float flick_t = iTime * 3.0;

    vec3 col = vec3(0.0);
    float dist = 0.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= steps) break;

        vec3 p = ro + rd * dist;
        vec2 q = vec2(length(p.xz) - TORUS_PARAMS.x, p.y);
        float lq = length(q);

        float fl = clamp(floor((lq - TORUS_PARAMS.y) / LAYER_SPACING + 0.5),
                0.0, float(NUM_LAYERS - 1));
        float ad = abs(lq - (TORUS_PARAMS.y + fl * LAYER_SPACING));

        if (ad < 0.02) {
            float dot_seed;
            if (is_dot_layer(atan(p.z, p.x), atan(q.y, q.x), fl, dot_seed)) {
                float flicker = sin(flick_t + dot_seed * 50.0) * 0.5 + 0.5;
                float depth_fade = 1.0 - fl / float(NUM_LAYERS);
                float glow = 0.10 / (ad + 0.01);
                col += palette(dot_seed, pa, pb, pc, pd) * glow
                        * mix(0.5, 1.0, flicker) * mix(0.6, 1.0, depth_fade) * 0.15;
            }
        }

        dist += max(ad, 0.01);
        if (dist > 50.0) break;
    }

    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
