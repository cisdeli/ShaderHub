#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

// == Signed distance geometric functions
float sdPlane(vec3 p, vec3 n, float h) { // n must be normalized
    return dot(p, n) - h;
}

float map(vec3 p) {
    return sdPlane(p, vec3(0.0, 1.0, 0.0), -1.0);
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // Pinhole camera
    vec3 ro = vec3(0.0, 0.0, -3.0);     // Camera position; ray origin; eye
    vec3 rd = normalize(vec3(uv, 1.0)); // Ray direction, through this pixel

    // Sphere tracing
    float ds = 0.0;   // distance travelled along the ray
    float dist = 0.0; // how far to the nearest surface
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * ds; // current position
        dist = map(p);   // distance to the nearest surface
        if (dist < 0.0001)
            break; // hit
        if (ds > 100.0)
            break; // miss

        ds += dist;
    }
    vec3 col = (dist < 0.0001) ? vec3(1.0) : vec3(0.05);
    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
