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

vec3 getCellIndex(vec3 p) {
    vec3 cellIndex = round(p / spacing);
    return clamp(cellIndex, -limit, limit);
}

float map(vec3 p) {
    vec3 cellIndex = getCellIndex(p);
    vec3 q = p - cellIndex * spacing; // shift p back into that cell's local space
    return sdRoundBox(q, vec3(0.5), 0.1);
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
    return 45 + (1 - y) * 3 + (1 - x); // B (-Z)
}

// R U R' U' — from your own toFacelets golden test
const int FACELETS[54] = int[54](
        0, 0, 4, 0, 0, 2, 0, 0, 2, 1, 1, 0, 5, 1, 1, 0, 1, 1, 2, 2, 3, 2, 2, 0, 2, 2, 2,
        3, 3, 1, 3, 3, 3, 3, 3, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 5, 1, 1, 5, 5, 5, 5, 5, 5);

// Kociemba face order: U,R,F,D,L,B == +Y,+X,+Z,-Y,-X,-Z
int getFaceID(vec3 N) {
    vec3 a = abs(N);
    if (a.x > a.y && a.x > a.z)
        return N.x > 0.0 ? 1 : 4; // R / L
    if (a.y > a.z)
        return N.y > 0.0 ? 0 : 3; // U / D
    return N.z > 0.0 ? 2 : 5; // F / B
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
    return faceColorAux(FACELETS[faceletIndex(cellIndex, faceID)]);
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
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

        vec3 cellIndex = getCellIndex(p);
        int faceID = getFaceID(N);

        col = faceColor(cellIndex, faceID);

        // Diffuse lighting (lambertian)
        vec3 lightDir = normalize(vec3(0.6, 0.8, 0.4));
        float NdotL = dot(N, lightDir);
        float diff = max(NdotL, 0.0);
        col *= 0.35 + 0.65 * diff;

        // specular (Blinn-Phong)
        vec3 viewDir = normalize(ro - p); // direction from surface point back to camera
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
