#version 330 core
out vec4 fragColor;

uniform vec3  iResolution;
uniform float iTime;
uniform int   iFrame;

vec4 C; // Julia constant

vec4 quaternion_mult(vec4 q) {
	return vec4(q.x * q.x - dot(q.yzw, q.yzw), 2.0 * q.x * q.yzw);
}

// Distance estimator, same as the 2D version: 0.5 * |z| * log|z| / |dz|
float map(vec3 p, out float trap) {
	vec4 z = vec4(p, 0.0); // 3D slice of 4D at w = 0
	float mz2 = dot(z, z); // |z|^2
	float md2 = 1.0; // |dz|^2
	trap = 1e10;

	for (int i = 0; i < 11; i++) {
		md2 *= 4.0 * mz2; // dz' = 2zdz; |dz'|^2 = 4|z|^2 |dz|^2
		z = quaternion_mult(z) + C;
		mz2 = dot(z, z);
		trap = min(trap, length(z.xz));
		if (mz2 > 256.0) break;
	}
	return 0.25 * sqrt(mz2 / md2) * log(mz2);
}

vec3 calc_normal(vec3 p) {
	const vec2 k = vec2(1, -1) * 0.0005;
	float t;
	return normalize(k.xyy * map(p + k.xyy, t) + k.yyx * map(p + k.yyx, t) +
	k.yxy * map(p + k.yxy, t) + k.xxx * map(p + k.xxx, t));
}

void mainImage(out vec4 fc, in vec2 fragCoord) {
    vec2 uv = 2.0 * (fragCoord - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);

	float time = iTime * 0.3;
	C = 0.45 * cos(vec4(0.5, 3.9, 1.4, 1.1) + time * vec4(1.2, 1.7, 1.3, 2.5)) - vec4(0.3, 0.0, 0.0, 0.0);

	// Camera params
	float an = time * 0.5;
	vec3 ro = 2.6 * vec3(cos(an), 0.4, sin(an));
	vec3 ww = normalize(-ro);
	vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
	vec3 vv = cross(uu, ww);
	vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.8 * ww);

	vec3 col = vec3(0.02, 0.02, 0.03) * (1.0 - 0.3 * uv.y);

	// Bounding sphere skiping empty spaces
	// the radius of the sphere is computed (R) instead of hardcoding a guess
	// overkill to be honest
	float R = 0.5 + sqrt(0.25 + length(C));
	float b = dot(ro, rd);
	float h = b * b - (dot(ro, ro) - R * R);
	if (h > 0.0) {
		h = sqrt(h);
		float t = max(-b - h, 0.0);
		float tmax = -b + h;
		float trap;
		bool hit = false;
		float steps = 0.0;

		for (int i = 0; i < 200; i++) {
			float d = map(ro + rd * t, trap);
			if (d < 0.0005 * t) {
				hit = true;
				break;
			}
			t += d;
			steps += 1.0;
			if (t > tmax) break;
		}

		if (hit) {
			vec3 pos = ro + rd * t;
			vec3 n = calc_normal(pos);
			map(pos, trap);

			vec3 L = normalize(vec3(0.6, 0.8, -0.4));
			vec3 H = normalize(L - rd);
			float dif = clamp(dot(n, L), 0.0, 1.0);
			float spe = pow(clamp(dot(n, H), 0.0, 1.0), 32.0);
			float ao = clamp(1.0 - steps / 120.0, 0.0, 1.0);

			// Orbit trap palette
			vec3 alb = 0.5 + 0.5 * cos(6.2831 * (0.8 * trap + vec3(0.0, 0.33, 0.67)));

			col = alb * (0.15 + 0.85 * dif) * ao + 0.4 * spe * dif;
		}
	}

	fc = vec4(pow(col, vec3(0.4)), 1.0);
}

void main(){
    mainImage(fragColor, gl_FragCoord.xy);
}

