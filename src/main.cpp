// ShaderHub - Minimal Shadertoy-style runner with hot reload
// Build: GLFW + GLAD (OpenGL 3.3+)

#include <GLFW/glfw3.h>
#include <glad/glad.h>

#include <algorithm>
#include <map>
#include <thread>

#include <cctype>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

// ============ Utility: read an entire text file ============
static bool readTextFile(const fs::path &p, std::string &out) {
    std::ifstream ifs(p, std::ios::in | std::ios::binary);
    if (!ifs)
        return false;
    ifs.seekg(0, std::ios::end);
    const auto len = ifs.tellg();
    ifs.seekg(0, std::ios::beg);
    out.resize(static_cast<size_t>(len));
    if (len > 0)
        ifs.read(&out[0], len);
    return true;
}

// ============ Shader compile/link helpers ============
static GLuint compile(GLenum type, const char *src) {
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);
    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        GLint len = 0;
        glGetShaderiv(s, GL_INFO_LOG_LENGTH, &len);
        std::string log(len, '\0');
        glGetShaderInfoLog(s, len, nullptr, log.data());
        std::cerr << "[Shader compile error]\n"
                  << log << std::endl;
        glDeleteShader(s);
        return 0;
    }
    return s;
}

static GLuint link(GLuint vs, GLuint fs) {
    if (!vs || !fs)
        return 0;
    GLuint p = glCreateProgram();
    glAttachShader(p, vs);
    glAttachShader(p, fs);
    glLinkProgram(p);
    GLint ok = 0;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    glDetachShader(p, vs);
    glDetachShader(p, fs);
    glDeleteShader(vs);
    glDeleteShader(fs);
    if (!ok) {
        GLint len = 0;
        glGetProgramiv(p, GL_INFO_LOG_LENGTH, &len);
        std::string log(len, '\0');
        glGetProgramInfoLog(p, len, nullptr, log.data());
        std::cerr << "[Program link error]\n"
                  << log << std::endl;
        glDeleteProgram(p);
        p = 0;
    }
    return p;
}

// Fullscreen triangle vertex shader (no VBO; uses gl_VertexID)
static const char *VERT_SRC = R"GLSL(
#version 330 core
const vec2 verts[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2( 3.0, -1.0),
    vec2(-1.0,  3.0)
);
void main() {
    gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}
)GLSL";

// Wrap a raw fragment body if user only wrote mainImage.
// If the fragment already defines main(), use it as-is.
// Otherwise append a tiny main() that calls mainImage.
static std::string maybeWrapFragment(const std::string &src) {
    if (src.find("void main(") != std::string::npos)
        return src;
    std::string wrapped = src;
    wrapped += R"GLSL(

#ifndef SHADERS_HUB_MAIN_DEFINED
out vec4 fragColor;
void main(){
    mainImage(fragColor, gl_FragCoord.xy);
}
#endif
)GLSL";
    return wrapped;
}

// True if `name` appears as an actual uniform declaration, not merely as a use.
// Checking for a bare mention would skip declaring a uniform the shader uses
// but never declares, which is exactly the case the prelude exists to cover.
static bool declaresUniform(const std::string &src, const std::string &name) {
    auto isIdentChar = [](char c) { return std::isalnum((unsigned char)c) || c == '_'; };
    for (size_t at = src.find(name); at != std::string::npos; at = src.find(name, at + 1)) {
        if (at > 0 && isIdentChar(src[at - 1]))
            continue;
        const size_t end = at + name.size();
        if (end < src.size() && isIdentChar(src[end]))
            continue;
        const size_t lineStart = src.rfind('\n', at);
        const size_t from = (lineStart == std::string::npos) ? 0 : lineStart + 1;
        const size_t kw = src.find("uniform", from);
        if (kw != std::string::npos && kw < at)
            return true;
    }
    return false;
}

// Add a #version directive and any Shadertoy uniforms the file leaves out.
// Declarations must follow #version, so they are spliced in after that line
// when the shader already has one.
static std::string injectPrelude(const std::string &src) {
    std::string decls;
    if (!declaresUniform(src, "iResolution"))
        decls += "uniform vec3  iResolution;\n";
    if (!declaresUniform(src, "iTime"))
        decls += "uniform float iTime;\n";
    if (!declaresUniform(src, "iFrame"))
        decls += "uniform int   iFrame;\n";
    if (!declaresUniform(src, "iMouse"))
        decls += "uniform vec4  iMouse;\n";

    const auto versionPos = src.find("#version");
    if (versionPos == std::string::npos)
        return "#version 330 core\n" + decls + src;
    if (decls.empty())
        return src;
    const auto eol = src.find('\n', versionPos);
    if (eol == std::string::npos)
        return src + "\n" + decls;
    return src.substr(0, eol + 1) + decls + src.substr(eol + 1);
}

// Create program from a fragment file, returns 0 if compile/link fails.
static GLuint createProgramFromFragmentFile(const fs::path &fragPath) {
    std::string fragSource;
    if (!readTextFile(fragPath, fragSource)) {
        std::cerr << "[IO] Failed to read " << fragPath << "\n";
        return 0;
    }
    fragSource = injectPrelude(fragSource);
    fragSource = maybeWrapFragment(fragSource);

    GLuint vs = compile(GL_VERTEX_SHADER, VERT_SRC);
    GLuint fs = compile(GL_FRAGMENT_SHADER, fragSource.c_str());
    GLuint prog = link(vs, fs);
    return prog;
}

// ============ Input: fire once per physical key press ============
// glfwGetKey is level-triggered, so polling it directly repeats every frame
// while the key is held. `alt` lets one action watch two keys (e.g. [ and KP_4).
static bool keyPressedOnce(GLFWwindow *win, int key, int alt = GLFW_KEY_UNKNOWN) {
    static std::map<int, bool> wasDown;
    bool edge = false;
    for (int k : {key, alt}) {
        if (k == GLFW_KEY_UNKNOWN)
            continue;
        const bool down = glfwGetKey(win, k) == GLFW_PRESS;
        bool &prev = wasDown[k];
        edge = edge || (down && !prev);
        prev = down;
    }
    return edge;
}

// ============ File discovery (accepts files or a directory) ============
static bool hasShaderExtension(const fs::path &p) {
    const auto ext = p.extension().string();
    return ext == ".frag" || ext == ".glsl" || ext == ".fs";
}

static std::vector<fs::path> shadersInDirectory(const fs::path &dir) {
    std::vector<fs::path> out;
    std::error_code ec;
    for (auto it = fs::directory_iterator(dir, ec);
         !ec && it != fs::directory_iterator(); it.increment(ec)) {
        if (it->is_regular_file() && hasShaderExtension(it->path()))
            out.push_back(it->path());
    }
    std::sort(out.begin(), out.end());
    return out;
}

// Given a directory, returns every shader in it starting at the first.
// Given a file, returns that file's siblings and starts on the named file, so
// that opening one shader still lets [ and ] page through the rest of the
// folder. Falls back to the lone file when it has no shader siblings (an
// unrecognised extension, say) so an explicit path always loads.
static std::vector<fs::path> collectShaderFiles(const fs::path &input, size_t &startIndex) {
    startIndex = 0;
    if (fs::is_directory(input))
        return shadersInDirectory(input);

    if (fs::is_regular_file(input)) {
        const fs::path dir = input.has_parent_path() ? input.parent_path() : fs::path(".");
        std::vector<fs::path> siblings = shadersInDirectory(dir);
        // All entries share a directory, so filenames are enough to identify
        // the one that was named, without normalising "./" prefixes.
        for (size_t i = 0; i < siblings.size(); ++i) {
            if (siblings[i].filename() == input.filename()) {
                startIndex = i;
                return siblings;
            }
        }
        return {input};
    }
    return {};
}

// ============ GPU selection ============
// Under WSL2, Mesa defaults to llvmpipe -- a software rasterizer that runs the
// fragment shader on the CPU. That is roughly 30x slower here: xorworld.frag at
// 1080p measures 2.9 fps on llvmpipe vs 87 fps on the discrete GPU.
//
// When the WSL GPU passthrough device is present, opt into the d3d12 gallium
// driver and prefer the discrete adapter. Both setenv calls pass overwrite=0, so
// anything already in the environment wins and this stays a default, not a
// policy. Mesa reads these when the context is created, which is after main()
// starts, so setting them here works.
static void preferHardwareGL() {
    if (!fs::exists("/dev/dxg"))
        return;
    setenv("GALLIUM_DRIVER", "d3d12", 0);
    // Mesa matches this against the adapter description; without it the
    // integrated GPU is picked. Harmless if no adapter matches.
    setenv("MESA_D3D12_DEFAULT_ADAPTER_NAME", "NVIDIA", 0);
}

// ============ Frame pacing ============
// glfwSwapInterval(1) is only a request, and under WSLg it is ignored: the loop
// measured ~674 fps on a trivial shader with vsync "on", identical to vsync off.
// Redrawing hundreds of frames a second that the display never shows is pure
// heat -- demo.frag alone held the GPU at 35% and 12W. So pace the loop here.
//
// The margin matters. Where vsync *is* honoured, glfwSwapBuffers already blocks
// until the next refresh, so the frame has consumed its whole budget by the time
// we get here and we sleep for nothing. Undershooting the deadline slightly
// means we never add a second wait on top of the driver's, which would beat
// against the refresh and halve the rate.
static void limitFrameRate(std::chrono::steady_clock::time_point frameStart, int targetFps) {
    if (targetFps <= 0)
        return;
    const auto budget = std::chrono::duration<double>(1.0 / targetFps);
    const auto margin = std::chrono::duration<double>(0.001);
    const auto deadline = frameStart +
        std::chrono::duration_cast<std::chrono::steady_clock::duration>(budget - margin);
    if (std::chrono::steady_clock::now() < deadline)
        std::this_thread::sleep_until(deadline);
}

// ============ Main ============
int main(int argc, char **argv) {
    fs::path target = "shaders/demo.frag";
    int targetFps = 60;
    bool sawTarget = false;
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--fps" && i + 1 < argc) {
            targetFps = std::atoi(argv[++i]);  // 0 or less uncaps the loop
        } else if (!sawTarget) {
            target = fs::path(arg);
            sawTarget = true;
        } else {
            std::cerr << "[Args] Ignoring unexpected argument: " << arg << "\n";
        }
    }

    preferHardwareGL();

    if (!glfwInit()) {
        std::cerr << "Failed to init GLFW\n";
        return 1;
    }
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow *win = glfwCreateWindow(960, 540, "ShaderHub", nullptr, nullptr);
    if (!win) {
        std::cerr << "Failed to create window\n";
        glfwTerminate();
        return 1;
    }
    glfwMakeContextCurrent(win);
    glfwSwapInterval(1);  // honoured on some drivers; limitFrameRate covers the rest

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to init GLAD\n";
        return 1;
    }

    // Report the device: a silent fall back to software rendering is otherwise
    // very easy to miss, and looks like a slow shader rather than a slow driver.
    std::cout << "[GL] " << glGetString(GL_RENDERER) << "  |  "
              << glGetString(GL_VERSION) << "\n";

    GLuint vao = 0;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glClearColor(0.02f, 0.02f, 0.03f, 1.0f);

    // Mouse tracking (Shadertoy-ish, needs testing)
    static double mouseX = 0.0, mouseY = 0.0, clickX = 0.0, clickY = 0.0;
    static bool mouseDown = false;
    glfwSetCursorPosCallback(win, [](GLFWwindow *, double x, double y) { mouseX = x; mouseY = y; });
    glfwSetMouseButtonCallback(win, [](GLFWwindow *w, int b, int a, int) {
        if (b == GLFW_MOUSE_BUTTON_LEFT) {
            if (a == GLFW_PRESS) {
                mouseDown = true;
                glfwGetCursorPos(w, &clickX, &clickY);
            } else if (a == GLFW_RELEASE)
                mouseDown = false;
        }
    });

    // Shader file loading
    size_t currentIndex = 0;
    auto shaderFiles = collectShaderFiles(target, currentIndex);
    if (shaderFiles.empty()) {
        std::cerr << "[IO] No shader files found in: " << target << "\n";
        return 1;
    }
    fs::path currentFrag = shaderFiles[currentIndex];
    std::error_code ec;
    auto lastWrite = fs::last_write_time(currentFrag, ec);
    if (ec)
        lastWrite = fs::file_time_type::min();

    GLuint prog = createProgramFromFragmentFile(currentFrag);
    if (!prog) {
        std::cerr << "[GL] Failed to build initial shader\n";
        return 1;
    }

    // Uniform locations
    GLint locRes = glGetUniformLocation(prog, "iResolution");
    GLint locTime = glGetUniformLocation(prog, "iTime");
    GLint locFrame = glGetUniformLocation(prog, "iFrame");
    GLint locMouse = glGetUniformLocation(prog, "iMouse");

    auto t0 = std::chrono::steady_clock::now();
    int frame = 0;
    bool hotReloadEnabled = true;  // Toggle hot reload on/off

    auto bindUniforms = [&](int fbw, int fbh, float timeSec) {
        glUniform3f(locRes, (float)fbw, (float)fbh, 1.0f);
        glUniform1f(locTime, timeSec);
        glUniform1i(locFrame, frame);
        float mx = (float)mouseX, my = (float)(fbh - mouseY);
        float mz = mouseDown ? (float)clickX : 0.0f;
        float mw = mouseDown ? (float)(fbh - clickY) : 0.0f;
        glUniform4f(locMouse, mx, my, mz, mw);
    };

    auto reloadProgram = [&]() {
        GLuint newProg = createProgramFromFragmentFile(currentFrag);
        if (newProg) {
            glDeleteProgram(prog);
            prog = newProg;
            locRes = glGetUniformLocation(prog, "iResolution");
            locTime = glGetUniformLocation(prog, "iTime");
            locFrame = glGetUniformLocation(prog, "iFrame");
            locMouse = glGetUniformLocation(prog, "iMouse");
            std::cout << "[Reload] " << currentFrag.string() << "  ("
                      << (currentIndex + 1) << "/" << shaderFiles.size() << ")\n";
        } else {
            std::cerr << "[Reload] Keeping previous program due to errors.\n";
        }
    };

    std::cout << "Loaded: " << currentFrag << "  (" << (currentIndex + 1) << "/"
              << shaderFiles.size() << ")\n"
              << "Controls: [ / ] switch shader, R reload, H toggle hot-reload, ESC quit\n"
              << "Hot-reload: ENABLED (press H to toggle)\n";
    if (shaderFiles.size() == 1)
        std::cout << "[Note] Only one shader here, so [ and ] have nothing to switch to.\n";
    std::cout << "Frame cap: " << (targetFps > 0 ? std::to_string(targetFps) + " fps" : "uncapped")
              << "  (--fps N to change, --fps 0 to uncap)\n";

    while (!glfwWindowShouldClose(win)) {
        const auto frameStart = std::chrono::steady_clock::now();

        // Nothing is visible while minimised, so stop drawing entirely and block
        // on events instead of spinning. The timeout keeps hot-reload responsive
        // once the window comes back.
        if (glfwGetWindowAttrib(win, GLFW_ICONIFIED)) {
            glfwWaitEventsTimeout(0.25);
            continue;
        }

        // Poll keys for switching / reload
        auto switchTo = [&](size_t next) {
            if (next == currentIndex)
                return;
            currentIndex = next;
            currentFrag = shaderFiles[currentIndex];
            lastWrite = fs::last_write_time(currentFrag, ec);
            reloadProgram();
        };
        if (keyPressedOnce(win, GLFW_KEY_LEFT_BRACKET, GLFW_KEY_KP_4))
            switchTo((currentIndex + shaderFiles.size() - 1) % shaderFiles.size());
        if (keyPressedOnce(win, GLFW_KEY_RIGHT_BRACKET, GLFW_KEY_KP_6))
            switchTo((currentIndex + 1) % shaderFiles.size());
        if (keyPressedOnce(win, GLFW_KEY_R))
            reloadProgram();

        // Toggle hot reload
        if (keyPressedOnce(win, GLFW_KEY_H)) {
            hotReloadEnabled = !hotReloadEnabled;
            std::cout << "[Hot-reload] " << (hotReloadEnabled ? "ENABLED" : "DISABLED") << "\n";
        }

        // Hot reload if file changed on disk
        if (hotReloadEnabled) {
            auto curWrite = fs::last_write_time(currentFrag, ec);
            if (!ec && curWrite != lastWrite) {
                lastWrite = curWrite;
                reloadProgram();
            }
        }

        int fbw, fbh;
        glfwGetFramebufferSize(win, &fbw, &fbh);
        glViewport(0, 0, fbw, fbh);
        glClear(GL_COLOR_BUFFER_BIT);

        auto now = std::chrono::steady_clock::now();
        float timeSec = std::chrono::duration<float>(now - t0).count();

        glUseProgram(prog);
        bindUniforms(fbw, fbh, timeSec);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        ++frame;

        glfwSwapBuffers(win);
        glfwPollEvents();

        if (glfwGetKey(win, GLFW_KEY_ESCAPE) == GLFW_PRESS)
            glfwSetWindowShouldClose(win, 1);

        limitFrameRate(frameStart, targetFps);
    }

    glDeleteProgram(prog);
    glDeleteVertexArrays(1, &vao);
    glfwDestroyWindow(win);
    glfwTerminate();
    return 0;
}
