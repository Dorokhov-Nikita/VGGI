"use strict";

let gl, canvas;;
let surface;
let shProgram;
let spaceball;

let uSteps = 40;
let vSteps = 40;

// Imit WEBGL
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram("Basic", prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "u_lightPosition");

    gl.enable(gl.DEPTH_TEST);

    surface = new Model("Surface");
    rebuildSurface();

    spaceball = new TrackballRotator(canvas, draw, 0);
}

// Model class
function Model(name) {
    this.name = name;

    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.indexCount = 0;

    this.BufferData = function(vertices, normals, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.indexCount = indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}

// Surface generation — indexed triangles + facet average vertex normals
function CreateIndexedSurfaceData(U, V) {
    const R1 = 1.0;
    const R2 = 3.0 * R1;
    const b = 3.0 * R1;

    let vertices = [];
    let indices = [];

    for (let i = 0; i <= U; i++) {
        let a = (2 * b * i) / U;

        for (let j = 0; j <= V; j++) {
            let beta = (2 * Math.PI * j) / V;

            let r = (R2 - R1) * Math.pow(Math.sin((Math.PI * a) / (4 * b)), 2) + R1;

            let x = r * Math.cos(beta);
            let y = r * Math.sin(beta);
            let z = a;

            vertices.push(x, y, z);
        }
    }

    const row = V + 1;
    for (let i = 0; i < U; i++) {
        for (let j = 0; j < V; j++) {
            let p0 = i * row + j;
            let p1 = p0 + 1;
            let p2 = p0 + row;
            let p3 = p2 + 1;

            indices.push(p0, p1, p2);
            indices.push(p1, p3, p2);
        }
    }

    // Facet average normals
    const nv = vertices.length / 3;
    let accum = Array(nv).fill(0).map(() => [0,0,0]);

    const sub = (a,b)=>[a[0]-b[0], a[1]-b[1], a[2]-b[2]];
    const cross=(a,b)=>[
        a[1]*b[2]-a[2]*b[1],
        a[2]*b[0]-a[0]*b[2],
        a[0]*b[1]-a[1]*b[0]
    ];
    const norm = v=>{
        let L = Math.hypot(v[0],v[1],v[2]);
        return L>1e-9? [v[0]/L, v[1]/L, v[2]/L] : [0,0,0];
    };

    for (let i=0; i<indices.length; i+=3) {
        let i0=indices[i], i1=indices[i+1], i2=indices[i+2];

        let p0 = vertices.slice(i0*3, i0*3+3);
        let p1 = vertices.slice(i1*3, i1*3+3);
        let p2 = vertices.slice(i2*3, i2*3+3);

        let fn = norm(cross(sub(p1,p0), sub(p2,p0)));

        accum[i0][0]+=fn[0]; accum[i0][1]+=fn[1]; accum[i0][2]+=fn[2];
        accum[i1][0]+=fn[0]; accum[i1][1]+=fn[1]; accum[i1][2]+=fn[2];
        accum[i2][0]+=fn[0]; accum[i2][1]+=fn[1]; accum[i2][2]+=fn[2];
    }

    let normals=[];
    for (let k=0;k<nv;k++){
        let n = norm(accum[k]);
        normals.push(n[0],n[1],n[2]);
    }

    return { vertices, indices, normals };
}

// Rebuild surface
function rebuildSurface() {
    let data = CreateIndexedSurfaceData(uSteps, vSteps);
    surface.BufferData(data.vertices, data.normals, data.indices);
}

// Draw
function draw() {
    requestAnimationFrame(draw);

    gl.clearColor(0.25, 0.15, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    let projection = m4.perspective(Math.PI/8, aspect, 0.1, 1000);

    let view = spaceball.getViewMatrix();

    let rotate = m4.axisRotation([0.707,0.707,0], 0.7);
    let scale = m4.scaling(0.4,0.4,0.4);
    let translate = m4.translation(0,0,-35);

    let mv = m4.multiply(rotate, view);
    mv = m4.multiply(translate, mv);
    mv = m4.multiply(scale, mv);

    let mvp = m4.multiply(projection, mv);
    let normalMatrix = m4.transpose(m4.inverse(mv));

    shProgram.Use();
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, mv);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    const t = performance.now() * 0.001;
    const R = 10.0;
    const lightWorld = [Math.cos(t)*R, Math.sin(t)*R, 0];
    const lightView = m4.transformPoint(mv, lightWorld);

    gl.uniform3fv(shProgram.iLightPosition, lightView);

    surface.Draw();
}

// Slider allbacks (HTML)
function updateUSteps(v) {
    uSteps = Math.max(3, parseInt(v));
    rebuildSurface();
}

function updateVSteps(v) {
    vSteps = Math.max(3, parseInt(v));
    rebuildSurface();
}

// Shader utils
function createShader(gl, type, src) {
    let s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(s));
        return null;
    }
    return s;
}

function createProgram(gl, vsSrc, fsSrc) {
    let vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    let fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);

    let p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        alert(gl.getProgramInfoLog(p));

    return p;
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.Use = function() { gl.useProgram(this.prog); };
}

// Main initialization function
function init() {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
        alert("WebGL not supported");
        return;
    }
    initGL();

    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
    });

    requestAnimationFrame(draw);
}
