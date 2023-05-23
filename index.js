class Cube {
    constructor(gl, size, color, cubePosition) {
        this.gl = gl;
        this.positions = ([
            // Front face
            -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0, -1.0, -1.0,
            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0, -1.0,
            // Bottom face
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
            // Right face
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
            1.0, -1.0,  1.0,
            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,
        ]).map((point) => point * size);
        this.position = cubePosition;
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.positions), this.gl.STATIC_DRAW);

        this.faceColors = new Array(6).fill(color);
        this.colors = this.faceColors.flatMap(color => [...color, ...color, ...color, ...color]);
        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.colors), this.gl.STATIC_DRAW);

        this.triangles = [
            0,  1,  2,      0,  2,  3,    // front
            4,  5,  6,      4,  6,  7,    // back
            8,  9,  10,     8,  10, 11,   // top
            12, 13, 14,     12, 14, 15,   // bottom
            16, 17, 18,     16, 18, 19,   // right
            20, 21, 22,     20, 22, 23,   // left
        ];
        this.triangleBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.triangles), this.gl.STATIC_DRAW);

        this.normals = [
            [0, 0, 1],    // front
            [0, 0, -1],   // back
            [0, 1, 0],    //
            [0, -1, 0],
            [1, 0, 0],
            [-1, 0, 0],
        ];
        this.normals = [].concat.apply([], this.normals.map(n => [...n, ...n, ...n, ...n]));
        this.normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.normals), this.gl.STATIC_DRAW);
    }

    getBuffers() {
        return {
            position: this.positionBuffer,
            color: this.colorBuffer,
            indices: this.triangleBuffer,
            normal: this.normalBuffer,

            raw_position: this.positions,
            raw_color: this.faceColors,
            raw_indices: this.triangles,
            raw_normals: this.normals,
        };
    }

    setVertexes(programInfo) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition,3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexColor,4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

        gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(programInfo.attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.normal);
    }

    toPosition(Matrix) {
        this.translate(Matrix, this.position);
    }

    translate(Matrix, translation) {
        return mat4.translate(Matrix, Matrix, translation);
    }

    rotate(Matrix, rad, axis) {
        return mat4.rotate(Matrix, Matrix, rad, axis);
    }

    rotateAround(Matrix, rad, point) {
        const translation = this.position.map((p, i) => p - point[i]);
        this.translate(Matrix, translation.map(p => -p));
        this.rotate(Matrix, rad, [0, 1, 0]);
        this.translate(Matrix, translation);
    }
}

const shaderFunctions = `
float positive_dot(vec3 left, vec3 right) {
    return max(dot(left, right), 0.0);
}
        
float lambert(vec3 normal, vec3 lightPosition, float power) {
    return max(dot(normal, normalize(lightPosition)), 0.0) * power;
}
        
float phong(vec3 normal, vec3 lightDir, vec3 viewPosition, float power, float shininess) {
    float diffuseLightDot = positive_dot(normal, lightDir);
    vec3 reflectionVector = normalize(reflect(-lightDir, normal));
    float specularLightDot = positive_dot(reflectionVector, -normalize(viewPosition));
    float specularLightParam = pow(specularLightDot, shininess);
    return (diffuseLightDot + specularLightParam) * power;
}
        
float selShaded(vec3 normal, vec3 lightPosition, float power) {
    float coef = lambert(normal, lightPosition, power);
    if (coef >= 0.95) {
        coef = 1.0;
    } else if (coef >= 0.5) {
        coef = 0.7;
    } else if (coef >= 0.2) {
        coef = 0.4;
    } else {
        coef = 0.1;
    }

    return coef;
}
        
float evaluateLighting(int shading, int current, int lightModel, vec3 normal, vec4 vertex,
                        vec3 lightDir, vec3 viewPosition, float power, float shininess) 
{
    float light = 1.0;
    if (shading == current) 
{
        if (lightModel == 0) {
            light = lambert(normal, lightDir, power);   
        } else if (lightModel == 1) {
            light = phong(normal, lightDir, viewPosition, power, shininess);
        } else if (lightModel == 2){
            light = selShaded(normal, lightDir, power);
        }
    }
    return light;
}
        
float dampLight(int dampingFunction, float light) {
    float new_light = light;
        
    if (dampingFunction == 0) {
        new_light = light;   
    }
    else if (dampingFunction == 1) {
        new_light = light*light;
    }
            
    return new_light;
}`

var cubeVertexShader = `precision mediump float;
attribute vec4 aVertexPosition;
attribute vec4 aVertexColor;
attribute vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec4 vPosition;
varying vec4 vColor;
varying vec3 vNormal;

uniform float uLightPower;
uniform vec3 uLightDirection;
uniform lowp int uDampingFunction;
uniform lowp int uShading;
uniform lowp int uLightModel;
uniform float uLightShininess;
${shaderFunctions}
void main(void) {
    vec3 normal = normalize(mat3(uModelViewMatrix) * aNormal);
    vec3 position = vec3(uModelViewMatrix * aVertexPosition);
    vec3 lightDirection = normalize(uLightDirection - position);

    int current = 1;
    float light = evaluateLighting(
        uShading, current, uLightModel, normal, aVertexPosition,
        lightDirection, position, uLightPower, uLightShininess);
    light = dampLight(uDampingFunction, light);

    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    vColor = aVertexColor;
    vColor.rgb *= light;
    vPosition = aVertexPosition;
    vNormal = normal;
}`

var cubeFragmentShader = `precision mediump float;
uniform mat4 uModelViewMatrix;

varying vec4 vPosition;
varying vec4 vColor;
varying vec3 vNormal;

uniform float uLightPower;
uniform vec3 uLightDirection;
uniform lowp int uDampingFunction;
uniform lowp int uShading;
uniform lowp int uLightModel;
uniform float uLightShininess;
${shaderFunctions}
void main(void) {
    vec3 positionEye3 = vec3(uModelViewMatrix * vPosition);
    vec3 lightDirection = normalize(uLightDirection - positionEye3);

    int current = 0;

    float light = evaluateLighting(
        uShading, current, uLightModel, vNormal, vPosition,
        lightDirection, positionEye3, uLightPower, uLightShininess);
    light = dampLight(uDampingFunction, light);

    gl_FragColor = vColor;
    gl_FragColor.rgb *= light;
}`

const sceneState = {
    lightPower: NaN,
    dampingFunction: NaN,
    lightDirection: NaN,
    shading: NaN,
    lightModel: NaN,

    lightAmbient: NaN,
    lightDiffuse: NaN,
    lightSpecular: NaN,

    lightShininess: NaN,    
}
function update() {
    sceneState.lightPower = parseFloat(document.querySelector('#lightPower').value);
    sceneState.dampingFunction = parseInt(document.querySelector('.dampingFunction').value)
    sceneState.lightDirection = [0, 0, 0];
    sceneState.lightShininess = 16

    sceneState.shading = parseInt(document.querySelector('.shading').value)
    sceneState.lightModel = parseInt(document.querySelector('.lightModel').value)
}
//==========================================================================================

//rotation===================================================================================================
const ROTATION_SPEED = 0.015;
let currentSpeed = 0;
let currentMode = 0;
curRotations = [0.0, 0.0, 0.0];
window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'a' || event.key === 'ArrowLeft') // A, Left
        currentSpeed = -ROTATION_SPEED;
    else if (event.key.toLowerCase() === 'd' || event.key === 'ArrowRight') // D, Right
        currentSpeed = ROTATION_SPEED;
});
window.addEventListener('keyup', event => {
    if (event.key.toLowerCase() === 'a' || event.key === 'ArrowLeft') // A, Left
        currentSpeed = 0;
    else if (event.key.toLowerCase() === 'd' || event.key === 'ArrowRight') // D, Right
        currentSpeed = 0;
});
[...document.querySelectorAll('input[type="radio"]')].forEach(el => el.addEventListener('change', event => {
    if (event.target.checked) {
        currentMode = Number(event.target.value);
    }
}));
const rotateEachCube = (obj, Matrix, rad) => obj.rotate(Matrix, rad, [0, 1, 0]);
const rotatePedestalAroundSelfCenter = (obj, Matrix, rad) => {
    obj.rotateAround(Matrix, rad, [0, 0, -10]);
}
const rotatePedestalAroundWorldCenter = (obj, Matrix, rad) => {
    obj.rotateAround(Matrix, rad, [0, 0, 0]);
}

class Scene {
    constructor(webgl_context, vertex_shader, fragment_shader, store) {
        this.gl = webgl_context;

        this.state = store;
        const shaderProgram = this.initShadersProgram(vertex_shader, fragment_shader);
        this.programInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: this.gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
                vertexColor: this.gl.getAttribLocation(shaderProgram, 'aVertexColor'),
                normal: this.gl.getAttribLocation(shaderProgram, 'aNormal'),
            },
            uniformLocations: {
                projectionMatrix: this.gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: this.gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),

                lightPower: this.gl.getUniformLocation(shaderProgram, 'uLightPower'),
                lightDirection: this.gl.getUniformLocation(shaderProgram, 'ulightDirection'),
                lightAmbient: this.gl.getUniformLocation(shaderProgram, 'uLightAmbient'),
                lightDiffuse: this.gl.getUniformLocation(shaderProgram, 'uLightDiffuse'),
                lightSpecular: this.gl.getUniformLocation(shaderProgram, 'uLightSpecular'),
                dampingFunction: this.gl.getUniformLocation(shaderProgram, 'uDampingFunction'),

                viewPosition: this.gl.getUniformLocation(shaderProgram, 'uViewPosition'),
                lightModel: this.gl.getUniformLocation(shaderProgram, 'uLightModel'),
                shading: this.gl.getUniformLocation(shaderProgram, 'uShading'),
                
                lightShininess: this.gl.getUniformLocation(shaderProgram, 'uLightShininess'),
            }
        }
        this.objects = [
            new Cube(this.gl, 1, [221/255, 1, 0, 1], [0, 0, -10]),
            new Cube(this.gl, 0.9, [192/255, 192/255, 192/255, 1], [-1.9, -0.1, -10]),
            new Cube(this.gl, 0.8, [166/255, 124/255, 0, 1], [1.8, -0.2, -10]),
        ];
        this.then = 0;
        this.fieldOfView = 45 * Math.PI / 180;
        this.aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
        this.zNear = 0.1;
        this.zFar = 100.0;
    }

    start() {
        const render = () => {
            this.drawScene();
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }

    drawScene() {
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, this.fieldOfView, this.aspect, this.zNear, this.zFar);
        this.objects.forEach(obj => {
            var modelViewMatrix = mat4.create();
            obj.toPosition(modelViewMatrix);
            rotatePedestalAroundWorldCenter(obj, modelViewMatrix, curRotations[2]);
            rotatePedestalAroundSelfCenter(obj, modelViewMatrix, curRotations[1]);
            rotateEachCube(obj, modelViewMatrix, curRotations[0]);
            
            obj.setVertexes(this.programInfo);

            const buffers = obj.getBuffers();
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
            this.gl.useProgram(this.programInfo.program);
            this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
            this.gl.uniformMatrix4fv(this.programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

            this.gl.uniform1f(this.programInfo.uniformLocations.lightPower, this.state.lightPower);
            this.gl.uniform3fv(this.programInfo.uniformLocations.lightDirection, this.state.lightDirection);
            this.gl.uniform1i(this.programInfo.uniformLocations.dampingFunction, this.state.dampingFunction);
            this.gl.uniform3fv(this.programInfo.uniformLocations.viewPosition, [0, 0, 10]);
            this.gl.uniform1i(this.programInfo.uniformLocations.lightModel, this.state.lightModel);
            this.gl.uniform1i(this.programInfo.uniformLocations.shading, this.state.shading);
            this.gl.uniform1f(this.programInfo.uniformLocations.lightShininess, this.state.lightShininess);

            this.gl.drawElements(this.gl.TRIANGLES, buffers.raw_indices.length, this.gl.UNSIGNED_SHORT, 0);
        });
        curRotations[currentMode] += currentSpeed;
    }

    initShadersProgram(vertexShaderCode, fragmentShaderCode) {
        const vertexShader = this.loadShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderCode);
        const fragmentShader = this.loadShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderCode);
        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }
    loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}

function main() {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }
    new Scene(gl, cubeVertexShader, cubeFragmentShader, sceneState).start();
}
update();
main();
