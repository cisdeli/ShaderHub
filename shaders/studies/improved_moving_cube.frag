#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

// Camera ==
const float RADIUS = 10.0;
const float SPEED = 0.5;
const vec3 TARGET = vec3(0.0);
//==

//Cube ==
//Colors
const vec3 RED = vec3(0.90, 0.15, 0.15);
const vec3 GREEN = vec3(0.10, 0.75, 0.35);
const vec3 BLUE = vec3(0.15, 0.35, 0.90);
const vec3 WHITE = vec3(0.92, 0.92, 0.90);
const vec3 YELLOW = vec3(0.95, 0.85, 0.20);
const vec3 ORANGE = vec3(0.95, 0.50, 0.10);
const vec3 INTERIOR = vec3(0.1);
//Params
const float SPACING = 1.05;
const float HALF = 0.5;
const float ROUNDING = 0.1;
// Rendering sphere r
const float BOUND_R = (SPACING + HALF) * 1.7320508 + 0.01;

//Animation
// R U R' U' six times so it loops
const int SEQ_LEN = 24;
const float TURN_SECONDS = 0.45;
const int SEQ_AXIS[24] = int[24](0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1);
const float SEQ_LAYER[24] = float[24](1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
const float SEQ_TURNS[24] = float[24](-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0);
int seq_step;
int turn_axis;
float turn_c, turn_s; // cos/sin of the current turn angle
vec3 m_lo, m_hi, s_lo, s_hi; // moving / still cell bounds
//==

void setup_turn() {
    float phase = iTime / TURN_SECONDS;
    seq_step = int(mod(floor(phase), float(SEQ_LEN)));
    float t = fract(phase);
    float e = t * t * (3.0 - 2.0 * t);
    turn_axis = SEQ_AXIS[seq_step];
    float layer = SEQ_LAYER[seq_step];
    float a = e * SEQ_TURNS[seq_step] * 1.57079633;
    turn_c = cos(a);
    turn_s = sin(a);

    m_lo = vec3(-1.0);
    m_hi = vec3(1.0);
    s_lo = vec3(-1.0);
    s_hi = vec3(1.0);
    m_lo[turn_axis] = layer;
    m_hi[turn_axis] = layer;
    if (layer > 0.0) s_hi[turn_axis] = 0.0;
    else s_lo[turn_axis] = 0.0;
}

vec2 unrot2(vec2 v) {
    return vec2(turn_c * v.x + turn_s * v.y, -turn_s * v.x + turn_c * v.y);
}

vec3 unrotate(vec3 p) {
    if (turn_axis == 0) p.yz = unrot2(p.yz);
    else if (turn_axis == 1) p.xz = unrot2(p.xz);
    else p.xy = unrot2(p.xy);
    return p;
}

vec3 cell_in(vec3 p, vec3 lo, vec3 hi) {
    return clamp(round(p / SPACING), lo, hi);
}

float sd_round_box(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float box_at(vec3 p, vec3 cell) {
    return sd_round_box(p - cell * SPACING, vec3(HALF), ROUNDING);
}

float map(vec3 p) {
    vec3 q = unrotate(p);
    float moving = box_at(q, cell_in(q, m_lo, m_hi));
    float still = box_at(p, cell_in(p, s_lo, s_hi));
    return min(moving, still);
}

vec3 get_normal(vec3 p) {
    const vec2 k = vec2(1.0, -1.0);
    const float EPS = 0.001;
    return normalize(
        k.xyy * map(p + k.xyy * EPS) +
        k.yyx * map(p + k.yyx * EPS) +
        k.yxy * map(p + k.yxy * EPS) +
        k.xxx * map(p + k.xxx * EPS));
}

void shade_frame(vec3 p, vec3 N, out vec3 cell, out vec3 nlocal) {
    vec3 q = unrotate(p);
    vec3 moving_cell = cell_in(q, m_lo, m_hi);
    vec3 still_cell = cell_in(p, s_lo, s_hi);
    if (box_at(q, moving_cell) < box_at(p, still_cell)) {
        cell = moving_cell;
        nlocal = unrotate(N);
    } else {
        cell = still_cell;
        nlocal = N;
    }
}

vec3 snap_axis(vec3 n) {
    vec3 a = abs(n);
    if (a.x > a.y && a.x > a.z) return vec3(sign(n.x), 0.0, 0.0);
    if (a.y > a.z) return vec3(0.0, sign(n.y), 0.0);
    return vec3(0.0, 0.0, sign(n.z));
}

vec2 rot90(vec2 v, float s) {
    return s > 0.0 ? vec2(-v.y, v.x) : vec2(v.y, -v.x);
}

vec3 sticker_color(vec3 cell, vec3 n) {
    if (dot(cell, n) < 0.5) return INTERIOR;

    for (int j = seq_step - 1; j >= 0; --j) {
        int ax = SEQ_AXIS[j];
        if (cell[ax] != SEQ_LAYER[j]) continue;
        float s = -SEQ_TURNS[j];
        if (ax == 0) {
            cell.yz = rot90(cell.yz, s);
            n.yz = rot90(n.yz, s);
        } else if (ax == 1) {
            cell.xz = rot90(cell.xz, s);
            n.xz = rot90(n.xz, s);
        } else {
            cell.xy = rot90(cell.xy, s);
            n.xy = rot90(n.xy, s);
        }
    }

    if (n.y > 0.5) return WHITE; // U
    if (n.x > 0.5) return RED; // R
    if (n.z > 0.5) return GREEN; // F
    if (n.y < -0.5) return YELLOW; // D
    if (n.x < -0.5) return ORANGE; // L
    return BLUE; // B
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    setup_turn();
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    //mouse control
    vec2 m = iMouse.xy / iResolution.xy;
    float mouse_yaw = (m.x - 0.5) * 6.2831;
    float mouse_pitch = (m.y - 0.5) * 3.1415;

    float yaw = SPEED * iTime + mouse_yaw;
    float cp = cos(mouse_pitch);
    vec3 ro = vec3(RADIUS * sin(yaw) * cp, RADIUS * sin(mouse_pitch), RADIUS * cos(yaw) * cp);

    vec3 forward = normalize(TARGET - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);

    vec3 col = vec3(0.0);

    // Only march inside the bounding sphere: skips empty space for free.
    float b = dot(ro, rd);
    float h = b * b - (dot(ro, ro) - BOUND_R * BOUND_R);
    if (h > 0.0) {
        h = sqrt(h);
        float t = max(-b - h, 0.0);
        float t_far = -b + h;
        bool hit = false;
        for (int i = 0; i < 64; i++) {
            float d = map(ro + rd * t);
            if (d < 0.001) {
                hit = true;
                break;
            }
            t += d;
            if (t > t_far) break;
        }

        if (hit) {
            vec3 p = ro + rd * t;
            vec3 N = get_normal(p);

            vec3 cell_index, n_local;
            shade_frame(p, N, cell_index, n_local);
            col = sticker_color(cell_index, snap_axis(n_local));

            // lighting
            vec3 light_dir = normalize(vec3(0.6, 0.8, 0.4));
            col *= 0.35 + 0.65 * max(dot(N, light_dir), 0.0);
            float spec = pow(max(dot(N, normalize(light_dir + normalize(ro - p))), 0.0), 32.0);
            col += vec3(spec * 0.3);
        }
    }
    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
