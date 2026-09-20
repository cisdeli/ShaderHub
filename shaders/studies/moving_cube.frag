#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

// camera orbit parameters
const float radius = 10.0;
const float speed = 0.5;
const vec3 target = vec3(0.0);

// colors
const vec3 RED = vec3(0.90, 0.15, 0.15);
const vec3 GREEN = vec3(0.10, 0.75, 0.35);
const vec3 BLUE = vec3(0.15, 0.35, 0.90);
const vec3 WHITE = vec3(0.92, 0.92, 0.90);
const vec3 YELLOW = vec3(0.95, 0.85, 0.20);
const vec3 ORANGE = vec3(0.95, 0.50, 0.10);

// cube
const float spacing = 1.05;
// how many cubes on each side of center, per axis
// e.g. 1.0 -> cells at index -1,0,1 -> 3 cubes along that axis
const vec3 limit = vec3(1.0, 1.0, 1.0); // 3 cubes along X, 3 along Y and Z

float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// animation
int turnAxis;    // 0=X 1=Y 2=Z
float turnLayer; // +1 or -1 : which layer moves
float turnAngle; // radians
int seqStep;     // which move of the sequence is playing

// (R U R' U') six times so it loops
const int SEQ_LEN = 24;
const float TURN_SECONDS = 0.45;

const int SEQ_AXIS[24] = int[24](0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1);
const float SEQ_LAYER[24] = float[24](1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
const float SEQ_TURNS[24] = float[24](-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0);
const int SEQ_FACELETS[1296] = int[1296](
    0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    0, 0, 2, 0, 0, 2, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 0, 5, 5, 0, 5, 5,
    0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 5, 2, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 5, 5, 0, 5, 5,
    0, 0, 0, 0, 0, 0, 2, 2, 4, 5, 1, 1, 5, 1, 1, 0, 1, 1, 1, 1, 0, 2, 2, 0, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 2, 3, 4, 4, 4, 4, 4, 4, 5, 4, 4, 5, 5, 5, 5, 5, 5,
    0, 0, 4, 0, 0, 2, 0, 0, 2, 1, 1, 0, 5, 1, 1, 0, 1, 1, 2, 2, 3, 2, 2, 0, 2, 2, 2, 3, 3, 1, 3, 3, 3, 3, 3, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 1, 1, 5, 5, 5, 5, 5, 5,
    0, 0, 3, 0, 0, 0, 0, 0, 2, 0, 5, 1, 1, 1, 1, 1, 1, 0, 2, 2, 1, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 2, 1, 1, 2, 5, 5, 4, 5, 5,
    0, 0, 0, 0, 0, 0, 2, 0, 3, 2, 1, 1, 1, 1, 1, 1, 1, 0, 0, 5, 1, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 5, 2, 2, 1, 4, 4, 4, 4, 4, 4, 5, 4, 4, 2, 5, 5, 4, 5, 5,
    0, 0, 4, 0, 0, 2, 2, 0, 5, 1, 1, 0, 1, 1, 1, 2, 1, 1, 0, 5, 0, 2, 2, 0, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 2, 2, 1, 4, 4, 4, 4, 4, 4, 5, 4, 4, 5, 5, 5, 5, 5, 5,
    4, 2, 5, 0, 0, 0, 0, 0, 2, 0, 5, 0, 1, 1, 1, 2, 1, 1, 2, 2, 1, 2, 2, 0, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 0, 5, 5, 5, 5, 5, 5,
    4, 2, 1, 0, 0, 0, 0, 0, 3, 2, 1, 0, 1, 1, 5, 1, 1, 0, 2, 2, 1, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 1, 5, 4, 4, 4, 4, 4, 4, 4, 4, 2, 1, 0, 0, 5, 5, 5, 5, 5,
    0, 0, 4, 0, 0, 2, 3, 0, 1, 2, 1, 0, 1, 1, 5, 1, 1, 0, 2, 1, 0, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 1, 2, 2, 1, 4, 4, 4, 4, 4, 4, 5, 4, 4, 0, 5, 5, 5, 5, 5,
    0, 0, 5, 0, 0, 0, 3, 0, 5, 0, 5, 0, 1, 1, 1, 2, 1, 1, 2, 1, 4, 2, 2, 2, 2, 2, 1, 3, 3, 0, 3, 3, 3, 3, 3, 3, 2, 2, 1, 4, 4, 4, 4, 4, 4, 1, 4, 4, 5, 5, 5, 5, 5, 5,
    5, 0, 5, 0, 0, 0, 0, 0, 3, 2, 1, 4, 1, 1, 1, 2, 1, 1, 2, 2, 1, 2, 2, 2, 2, 2, 1, 3, 3, 0, 3, 3, 3, 3, 3, 3, 1, 4, 4, 4, 4, 4, 4, 4, 4, 0, 5, 0, 5, 5, 5, 5, 5, 5,
    5, 0, 1, 0, 0, 2, 0, 0, 1, 2, 1, 2, 1, 1, 1, 1, 1, 4, 2, 2, 0, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 0, 1, 4, 4, 4, 4, 4, 4, 4, 4, 3, 5, 0, 0, 5, 5, 5, 5, 5,
    0, 0, 5, 0, 0, 0, 1, 2, 1, 3, 5, 0, 1, 1, 1, 1, 1, 4, 2, 1, 2, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 0, 2, 2, 0, 4, 4, 4, 4, 4, 4, 1, 4, 4, 0, 5, 5, 5, 5, 5,
    0, 0, 5, 0, 0, 0, 1, 2, 1, 0, 1, 4, 5, 1, 1, 3, 1, 1, 2, 1, 5, 2, 2, 0, 2, 2, 1, 3, 3, 2, 3, 3, 3, 3, 3, 3, 2, 2, 0, 4, 4, 4, 4, 4, 4, 0, 4, 4, 5, 5, 5, 5, 5, 5,
    5, 0, 1, 0, 0, 2, 0, 0, 1, 2, 1, 5, 5, 1, 1, 3, 1, 1, 2, 2, 0, 2, 2, 0, 2, 2, 1, 3, 3, 2, 3, 3, 3, 3, 3, 3, 0, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 4, 5, 5, 5, 5, 5, 5,
    5, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 2, 1, 1, 1, 1, 1, 5, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 2, 5, 5, 1, 5, 5,
    0, 0, 5, 0, 0, 0, 1, 0, 0, 1, 1, 4, 1, 1, 1, 1, 1, 5, 3, 5, 2, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 0, 2, 2, 2, 4, 4, 4, 4, 4, 4, 0, 4, 4, 2, 5, 5, 1, 5, 5,
    0, 0, 1, 0, 0, 2, 1, 0, 0, 4, 1, 5, 1, 1, 1, 1, 1, 1, 3, 5, 5, 2, 2, 0, 2, 2, 0, 3, 3, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 4, 4, 4, 4, 4, 4, 0, 4, 4, 5, 5, 5, 5, 5, 5,
    1, 2, 0, 0, 0, 0, 0, 0, 1, 3, 5, 5, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 0, 2, 2, 0, 3, 3, 2, 3, 3, 3, 3, 3, 3, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 5, 5, 5, 5, 5, 5, 5,
    1, 2, 2, 0, 0, 0, 0, 0, 0, 1, 1, 3, 1, 1, 5, 1, 1, 5, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 5, 0, 5, 5, 0, 5, 5,
    0, 0, 1, 0, 0, 2, 0, 0, 2, 1, 1, 5, 1, 1, 5, 1, 1, 5, 1, 1, 3, 2, 2, 3, 2, 2, 3, 3, 3, 5, 3, 3, 5, 3, 3, 4, 2, 2, 2, 4, 4, 4, 4, 4, 4, 0, 4, 4, 0, 5, 5, 0, 5, 5,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5);

void setupTurn() {
    float phase = iTime / TURN_SECONDS;
    seqStep = int(mod(floor(phase), float(SEQ_LEN)));
    float t = fract(phase);
    float e = t * t * (3.0 - 2.0 * t);
    turnAxis = SEQ_AXIS[seqStep];
    turnLayer = SEQ_LAYER[seqStep];
    turnAngle = e * SEQ_TURNS[seqStep] * 1.57079633;
}

vec2 rot2(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec3 unrotate(vec3 p) {
    vec3 q = p;
    if (turnAxis == 0)
        q.yz = rot2(p.yz, -turnAngle);
    else if (turnAxis == 1)
        q.xz = rot2(p.xz, -turnAngle);
    else
        q.xy = rot2(p.xy, -turnAngle);
    return q;
}

// Which cells belong to the moving layer, and which to the rest.
void layerBounds(out vec3 mLo, out vec3 mHi, out vec3 sLo, out vec3 sHi) {
    mLo = -limit;
    mHi = limit;
    sLo = -limit;
    sHi = limit;
    if (turnAxis == 0) {
        mLo.x = mHi.x = turnLayer;
        if (turnLayer > 0.0)
            sHi.x = 0.0;
        else
            sLo.x = 0.0;
    } else if (turnAxis == 1) {
        mLo.y = mHi.y = turnLayer;
        if (turnLayer > 0.0)
            sHi.y = 0.0;
        else
            sLo.y = 0.0;
    } else {
        mLo.z = mHi.z = turnLayer;
        if (turnLayer > 0.0)
            sHi.z = 0.0;
        else
            sLo.z = 0.0;
    }
}

vec3 cellIn(vec3 p, vec3 lo, vec3 hi) {
    return clamp(round(p / spacing), lo, hi);
}

float boxAt(vec3 p, vec3 cell) {
    return sdRoundBox(p - cell * spacing, vec3(0.5), 0.1);
}

float map(vec3 p) {
    vec3 mLo, mHi, sLo, sHi;
    layerBounds(mLo, mHi, sLo, sHi);
    vec3 q = unrotate(p);
    float moving = boxAt(q, cellIn(q, mLo, mHi));
    float still = boxAt(p, cellIn(p, sLo, sHi));
    return min(moving, still);
}

void shadeFrame(vec3 p, vec3 N, out vec3 cell, out vec3 Nlocal) {
    vec3 mLo, mHi, sLo, sHi;
    layerBounds(mLo, mHi, sLo, sHi);
    vec3 q = unrotate(p);
    vec3 movingCell = cellIn(q, mLo, mHi);
    vec3 stillCell = cellIn(p, sLo, sHi);
    if (boxAt(q, movingCell) < boxAt(p, stillCell)) {
        cell = movingCell;
        Nlocal = N;
        if (turnAxis == 0)
            Nlocal.yz = rot2(N.yz, -turnAngle);
        else if (turnAxis == 1)
            Nlocal.xz = rot2(N.xz, -turnAngle);
        else
            Nlocal.xy = rot2(N.xy, -turnAngle);
    } else {
        cell = stillCell;
        Nlocal = N;
    }
}

vec3 calcNormal(vec3 p) {
    float eps = 0.001;
    vec2 h = vec2(eps, 0.0);
    return normalize(vec3(
        map(p + h.xyy) - map(p - h.xyy),
        map(p + h.yxy) - map(p - h.yxy),
        map(p + h.yyx) - map(p - h.yyx)));
}

// (cell, face) -> facelet index 0..53
int faceletIndex(vec3 cell, int faceID) {
    int x = int(cell.x), y = int(cell.y), z = int(cell.z);
    if (faceID == 0)
        return 0 + (z + 1) * 3 + (x + 1); // U (+Y)
    if (faceID == 1)
        return 9 + (1 - y) * 3 + (1 - z); // R (+X)
    if (faceID == 2)
        return 18 + (1 - y) * 3 + (x + 1); // F (+Z)
    if (faceID == 3)
        return 27 + (1 - z) * 3 + (x + 1); // D (-Y)
    if (faceID == 4)
        return 36 + (1 - y) * 3 + (z + 1); // L (-X)
    return 45 + (1 - y) * 3 + (1 - x);     // B (-Z)
}

// Kociemba face order: U,R,F,D,L,B == +Y,+X,+Z,-Y,-X,-Z
int getFaceID(vec3 N) {
    vec3 a = abs(N);
    if (a.x > a.y && a.x > a.z)
        return N.x > 0.0 ? 1 : 4; // R / L
    if (a.y > a.z)
        return N.y > 0.0 ? 0 : 3; // U / D
    return N.z > 0.0 ? 2 : 5;     // F / B
}
vec3 faceColorAux(int faceID) { // U R F D L B
    if (faceID == 0)
        return WHITE;
    if (faceID == 1)
        return RED;
    if (faceID == 2)
        return GREEN;
    if (faceID == 3)
        return YELLOW;
    if (faceID == 4)
        return ORANGE;
    return BLUE;
}
vec3 faceColor(vec3 cellIndex, int faceID) {
    vec3 interiorColor = vec3(0.1);
    if (faceID == 0 && cellIndex.y < limit.y)
        return interiorColor; // U
    if (faceID == 1 && cellIndex.x < limit.x)
        return interiorColor; // R
    if (faceID == 2 && cellIndex.z < limit.z)
        return interiorColor; // F
    if (faceID == 3 && cellIndex.y > -limit.y)
        return interiorColor; // D
    if (faceID == 4 && cellIndex.x > -limit.x)
        return interiorColor; // L
    if (faceID == 5 && cellIndex.z > -limit.z)
        return interiorColor; // B
    return faceColorAux(SEQ_FACELETS[seqStep * 54 + faceletIndex(cellIndex, faceID)]);
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    setupTurn();

    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // mouse-driven offset
    float mouseYaw = 0.0;
    float mousePitch = 0.0;
    // if (iMouse.z > 0.0) {
    vec2 m = iMouse.xy / iResolution.xy;
    mouseYaw = (m.x - 0.5) * 6.2831;
    mousePitch = clamp((m.y - 0.5) * 3.1415, -1.45, 1.45);

    // }

    float autoYaw = iTime * speed;
    float yaw = autoYaw + mouseYaw;

    // point
    vec3 ro = vec3(
        radius * sin(yaw) * cos(mousePitch),
        radius * sin(mousePitch) + 0.0, // adding something here makes the camera act funny
        radius * cos(yaw) * cos(mousePitch));

    // look-at
    vec3 forward = normalize(target - ro);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(forward, worldUp));
    vec3 up = cross(right, forward);

    float fov = 1.5;
    // vector
    vec3 rd = normalize(uv.x * right + uv.y * up + fov * forward);

    // raymarch loop
    float dist = 0.0; // scalar
    float d;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * dist; // ray
        d = map(p);
        if (d < 0.001 || dist > 50.0)
            break;
        dist += d;
    }

    vec3 col = vec3(0.0);
    if (d < 0.001) {
        vec3 p = ro + rd * dist; // ray
        vec3 N = calcNormal(p);

        vec3 cellIndex;
        vec3 Nlocal;
        shadeFrame(p, N, cellIndex, Nlocal);
        int faceID = getFaceID(Nlocal);

        col = faceColor(cellIndex, faceID);

        // Diffuse lighting (lambertian)
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
        float NdotL = dot(N, lightDir);
        float diff = max(NdotL, 0.0);
        col *= 0.35 + 0.65 * diff;

        // specular (Blinn-Phong)
        vec3 viewDir = normalize(ro - p);             // direction from surface point back to camera
        vec3 halfVec = normalize(lightDir + viewDir); // "halfway" vector between light and view
        float NdotH = max(dot(N, halfVec), 0.0);
        float spec = pow(NdotH, 32.0); // exponent controls glossiness

        col += vec3(1.0) * spec * 0.5;
    }
    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
