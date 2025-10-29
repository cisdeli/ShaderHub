<div align="center">

# ShaderHub
<p align="center">
  <a href="#">
    <img alt="Tested on" src="https://img.shields.io/badge/Ubuntu%20-%2024.04%20(WSL2)-0A7ACA?logo=ubuntu">
  </a>
  <a href="#">
    <img alt="OpenGL" src="https://img.shields.io/badge/OpenGL-4.5%20Core%20(3.3%2B%20OK)-008FBA?logo=opengl">
  </a>
</p>

A minimal Shadertoy-style GLSL runner for local development.  
Write fragment shaders, save the file, and see changes live.

![demo](github/demo.gif)

</div>

---

## Why?

I prefer writing code with my Neovim setup. If you do too, this runner lets you stay in your editor and still get instant visual feedback.

## Features

- Run standalone `.frag` files (Shadertoy-style `mainImage` or regular `main`)
- Hot reload on file save
- Directory browsing to switch between multiple shaders
- Shadertoy-like uniforms: `iResolution`, `iTime`, `iFrame`, `iMouse`
- Fullscreen triangle, no VBOs required

---

## Requirements

- CMake ≥ 3.15  
- C++17 compiler (g++/clang++)  
- OpenGL 3.3+ capable GPU/driver  
- GLFW (via system package)  
- GLAD (vendored in `external/glad/`)

### Ubuntu / WSL2 Setup

```bash
sudo apt update
sudo apt install build-essential cmake libglfw3-dev xorg-dev
```

---

## Build

```bash
git clone https://github.com/cisdeli/ShaderHub.git
cd ShaderHub
cmake -B build
cmake --build build -j
```

---

## Run

Run with a directory to browse multiple shaders:

```bash
./build/ShadersHub shaders/
```

Run a single shader file:

```bash
./build/ShadersHub shaders/demo.frag
```

---

## Usage

Your fragment shader can either:

1. Define `mainImage(out vec4 fc, in vec2 fragCoord)` and rely on the wrapper-added `main()`, or  
2. Provide its own `main()`.

Uniforms provided each frame:

```glsl
uniform vec3  iResolution; // (width, height, 1.0)
uniform float iTime;       // seconds since start
uniform int   iFrame;      // frame count
uniform vec4  iMouse;      // xy: current pos (pixels), zw: click pos (pixels) while held
```

Controls:

- `[` and `]` — switch shaders (when running with a directory)  
- `R` — force reload  
- `ESC` — quit

---

## Example Shader (`shaders/demo.frag`)

```glsl
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
    vec3 col = 0.6 + 0.4 * cos(vec3(0.0, 2.0, 4.0) + 6.2831 * v + t*0.2);
    col *= 1.0 / (1.0 + 3.0 * r*r);
    fc = vec4(col, 1.0);
}

void main() { mainImage(fragColor, gl_FragCoord.xy); }
```

---

## Demo

Add a GIF or screenshot of `demo.frag` in `docs/demo.gif` to replace the placeholder at the top.
