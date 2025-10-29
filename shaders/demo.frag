#version 330 core
out vec4 fragColor;

uniform vec3  iResolution;
uniform float iTime;
uniform int   iFrame;
uniform vec4  iMouse;

void mainImage(out vec4 fc, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    float a = atan(uv.y, uv.x);
    float r = length(uv);
    float v = 0.0;
    for (int i = 0; i < 4; ++i) {
        float k = float(i+1);
        v += 0.25 * sin(10.0 * r * k - t * (1.5 + k) + 6.0 * sin(a * (2.0 + k)));
    }
    v = 0.5 + 0.5 * v;
    vec3 col = 0.6 + 0.4 * cos(vec3(0.0, 9.0, 4.0) + 6.2831 * v + t*0.2);
    col *= 1.0 / (1.0 + 3.0 * r*r);
    fc = vec4(col, 1.5);
}

void main(){
    mainImage(fragColor, gl_FragCoord.xy);
}

