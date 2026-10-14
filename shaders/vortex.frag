#version 330 core
out vec4 fragColor;

uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;

#define PHI 1.618034
#define G_A 2.399963 //Golden Angle, Tau*(2-Phi)
#define HPI 1.570796 //Half pi, Tau/4.0
#define PI  3.141592

//Simple HSV to RGB for the rainbow coloring
vec3 hue(float t){
    vec3 p = abs(fract(t + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return clamp(p - 1.0, 0.0, 1.0);
}

vec2 rotate(vec2 p, float a){
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * p;
}


void mainImage(out vec4 fc, in vec2 fragCoord) {
    // vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float zoom = 1.0 + 0.5 * sin(iTime * 0.3);
    vec2 fit = uv / zoom;

    // ping pong
    float period = 20.0;
    float t = fract(iTime/period);
    float pingpong = 1.0 - abs(2.0 * t - 1.0);
    float angle = mix(0.0, 1.0, pingpong);
    
    float n = 250.0 * sin(angle);
    float w = 1.0;
    float h = 1.0;
    
    float r = 1.0;
    
    vec3 col = vec3(0);
    for(float i = 0.0; i < n; i++){
    
        vec2 dir = cos(i * G_A + iTime + vec2(0, HPI));
        float rad = sqrt(i/n) * r;
        vec2 pos = cos(dir * cos(iTime + i * 0.05)) * rad;
        //vec2 pos = cos(dir * cos(u_time + rad * 4.0)) * rad;
    
        pos = rotate(pos, -0.785);
        pos = pos + vec2(.5 , -.5);
       
        float d = length(fit - pos);
        float glow = 0.0005 / d;   
        col += glow * hue(i/n);
    }

    fc = vec4(col, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
