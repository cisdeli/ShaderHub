cmake_minimum_required(VERSION 3.15)
project(ShaderHub LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_C_STANDARD 11)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

add_executable(ShaderHub
    src/main.cpp
    external/glad/src/glad.c
)

target_include_directories(ShaderHub PRIVATE
    external/glad/include
)

target_compile_definitions(ShaderHub PRIVATE GLFW_INCLUDE_NONE)

find_package(PkgConfig REQUIRED)
pkg_check_modules(GLFW3 REQUIRED glfw3)
target_include_directories(ShaderHub PRIVATE ${GLFW3_INCLUDE_DIRS})
target_link_libraries(ShaderHub PRIVATE ${GLFW3_LIBRARIES})

target_link_libraries(ShaderHub PRIVATE dl)
