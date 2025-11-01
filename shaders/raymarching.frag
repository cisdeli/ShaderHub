
#version 330 core
out vec4 fragColor;

uniform vec3  iResolution;
uniform float iTime;
uniform int   iFrame;
uniform vec4  iMouse;


float sdSphere( vec3 p, float s ){
  return length(p)-s;
}

float sdBox( vec3 p, vec3 b ){
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdOctahedron( vec3 p, float s ){
  p = abs(p);
  float m = p.x+p.y+p.z-s;
  vec3 q;
       if( 3.0*p.x < m ) q = p.xyz;
  else if( 3.0*p.y < m ) q = p.yzx;
  else if( 3.0*p.z < m ) q = p.zxy;
  else return m*0.57735027;
    
  float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
  return length(vec3(q.x,q.y-s+k,q.z-k)); 
}

float smin( float a, float b, float k ){
    float h = max(k - abs(a - b), 0.0)/k;
    return min(a, b) - h*h*h*k*(1.0/6.0);
}

vec3 rotate(vec3 p, vec3 axis, float angle){
    // rodriguez rotation formula
    return mix(dot(axis, p) * axis, p, cos(angle)) + cross(axis, p) * sin(angle);
}

mat2 rot2D(float angle){
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}


vec3 palette(float t) {
    // vec3 a = vec3(0.5, 0.5, 0.5);
    // vec3 b = vec3(0.5, 0.5, 0.5);
    // vec3 c = vec3(1.0, 1.0, 1.0);
    // vec3 d = vec3(0.263, 0.416, 0.557);
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.9, 0.5);
    vec3 c = vec3(1.0, 1.0, 0.5);
    vec3 d = vec3(0.8, 0.7, 0.5);
    return a + b * cos(6.28318 * (c * t + d));
}

float map(vec3 p){
    p.z += iTime * 0.4;

    p.xy = (fract(p.xy) - 0.5);
    p.z = mod(p.z, 0.25) - 0.125;
    float octa = sdOctahedron(p, 0.15);
    return octa;
}

void mainImage(out vec4 fc, in vec2 fragCoord){
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    // vec2 mouse = (iMouse.xy * 2.0 - iResolution.xy) / iResolution.y;

    vec3 ray_origin = vec3(0, 0, -3);
    vec3 ray_direction = normalize(vec3(uv, 1));
    vec3 col = vec3(0);

    float distance_traveled = 0.0;

    int i;
    for(i = 0; i < 80; i++){
        vec3 position = ray_origin + ray_direction * distance_traveled;

        position.xy *= rot2D(distance_traveled * 0.2);
        // position.y += sin(distance_traveled * (mouse.y + 1.0) * 0.5) *.35;
        position.y += sin(distance_traveled * (sin(iTime * 0.4) + 0.5) * 0.5) *.35;
        float distance_to_closest = map(position);
        if(distance_to_closest < 0.001 || distance_traveled > 100.0){
            break;
        }
        distance_traveled += distance_to_closest;
    }

    col = palette(distance_traveled * 0.05 + float(i) * 0.005 - iTime * 0.2);
    fc = vec4(col, 1);

}

void main(){
    mainImage(fragColor, gl_FragCoord.xy);
}

