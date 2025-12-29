"use strict";

let gl, canvas;
let surface;
let shProgram;
let spaceball;

let uSteps = 40;
let vSteps = 40;

let diffuseTexture;
let specularTexture;
let normalTexture;

let rotationCenter = { u: 0.5, v: 0.5 };
let textureRotation = 0.0;

// Texture loading with error handling
function loadTexture(url, name) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    let defaultPixel;
    if (name === 'diffuse') {
        defaultPixel = new Uint8Array([200, 120, 20, 255]);
    } else if (name === 'specular') {
        defaultPixel = new Uint8Array([255, 255, 255, 255]);
    } else {
        defaultPixel = new Uint8Array([128, 128, 255, 255]);
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, defaultPixel);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    const image = new Image();
    image.crossOrigin = "anonymous";
    
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        const isPowerOf2 = (value) => (value & (value - 1)) === 0;
        
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    
    image.src = url;
    return texture;
}

// Creating a procedural texture
function createProceduralTexture(texture, name) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const idx = (i * size + j) * 4;
            
            if (name === 'diffuse') {
                const pattern = Math.sin(i * 0.1) * Math.cos(j * 0.1);
                data[idx] = 200 + pattern * 20;
                data[idx + 1] = 120 + pattern * 20;
                data[idx + 2] = 20;
                data[idx + 3] = 255;
            } else if (name === 'specular') {
                const noise = Math.random() * 50 + 200;
                data[idx] = noise;
                data[idx + 1] = noise;
                data[idx + 2] = noise;
                data[idx + 3] = 255;
            } else if (name === 'normal') {
                data[idx] = 128;
                data[idx + 1] = 128;
                data[idx + 2] = 255;
                data[idx + 3] = 255;
            }
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function handleKeyDown(event) {    
    const step = 0.05;
    
    switch(event.key.toLowerCase()) {
        case 'a':
            rotationCenter.u = Math.max(0, rotationCenter.u - step);
            event.preventDefault();
            break;
        case 'd':
            rotationCenter.u = Math.min(1, rotationCenter.u + step);
            event.preventDefault();
            break;
        case 'w':
            rotationCenter.v = Math.max(0, rotationCenter.v - step);
            event.preventDefault();
            break;
        case 's':
            rotationCenter.v = Math.min(1, rotationCenter.v + step);
            event.preventDefault();
            break;
        case 'q':
            textureRotation -= 0.1;
            event.preventDefault();
            break;
        case 'e':
            textureRotation += 0.1;
            event.preventDefault();
            break;
    }
}

// Init WEBGL
function initGL() {
    
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    
    shProgram = new ShaderProgram("Basic", prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "tangent");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "u_lightPosition");
    
    shProgram.iDiffuseTexture = gl.getUniformLocation(prog, "u_diffuseTexture");
    shProgram.iSpecularTexture = gl.getUniformLocation(prog, "u_specularTexture");
    shProgram.iNormalTexture = gl.getUniformLocation(prog, "u_normalTexture");

    shProgram.iRotationCenter = gl.getUniformLocation(prog, "u_rotationCenter");
    shProgram.iTextureRotation = gl.getUniformLocation(prog, "u_textureRotation");

    gl.enable(gl.DEPTH_TEST);

    diffuseTexture = loadTexture("diffuse.jpg", "diffuse");
    specularTexture = loadTexture("specular.jpg", "specular");
    normalTexture = loadTexture("normal.jpg", "normal");

    surface = new Model("Surface");
    rebuildSurface();

    spaceball = new TrackballRotator(canvas, draw, 0);
    
}

// Model class
function Model(name) {
    this.name = name;

    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.indexCount = 0;

    this.BufferData = function(vertices, normals, texCoords, tangents, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.indexCount = indices.length;
    };

    this.Draw = function() {
        if (shProgram.iAttribVertex !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
            gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribVertex);
        }

        if (shProgram.iAttribNormal !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
            gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribNormal);
        }

        if (shProgram.iAttribTexCoord !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
            gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
        }

        if (shProgram.iAttribTangent !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
            gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(shProgram.iAttribTangent);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}

// Surface generation
function CreateIndexedSurfaceData(U, V) {
    const R1 = 1.0;
    const R2 = 3.0 * R1;
    const b = 3.0 * R1;

    let vertices = [];
    let texCoords = [];
    let indices = [];

    for (let i = 0; i <= U; i++) {
        let a = (2 * b * i) / U;
        let u = i / U;

        for (let j = 0; j <= V; j++) {
            let beta = (2 * Math.PI * j) / V;
            let v = j / V;

            let r = (R2 - R1) * Math.pow(Math.sin((Math.PI * a) / (4 * b)), 2) + R1;

            let x = r * Math.cos(beta);
            let y = r * Math.sin(beta);
            let z = a;

            vertices.push(x, y, z);
            texCoords.push(u * 3, v * 3);
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
        return L>1e-9? [v[0]/L, v[1]/L, v[2]/L] : [0,0,1];
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

    // Tangents
    let tangentAccum = Array(nv).fill(0).map(() => [0,0,0]);
    
    for (let i=0; i<indices.length; i+=3) {
        let i0=indices[i], i1=indices[i+1], i2=indices[i+2];

        let p0 = [vertices[i0*3], vertices[i0*3+1], vertices[i0*3+2]];
        let p1 = [vertices[i1*3], vertices[i1*3+1], vertices[i1*3+2]];
        let p2 = [vertices[i2*3], vertices[i2*3+1], vertices[i2*3+2]];

        let uv0 = [texCoords[i0*2], texCoords[i0*2+1]];
        let uv1 = [texCoords[i1*2], texCoords[i1*2+1]];
        let uv2 = [texCoords[i2*2], texCoords[i2*2+1]];

        let edge1 = sub(p1, p0);
        let edge2 = sub(p2, p0);
        let deltaUV1 = [uv1[0]-uv0[0], uv1[1]-uv0[1]];
        let deltaUV2 = [uv2[0]-uv0[0], uv2[1]-uv0[1]];

        let det = deltaUV1[0] * deltaUV2[1] - deltaUV2[0] * deltaUV1[1];
        let f = Math.abs(det) > 1e-6 ? 1.0 / det : 0.0;
        
        let tangent = [
            f * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]),
            f * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]),
            f * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2])
        ];

        tangentAccum[i0][0] += tangent[0]; tangentAccum[i0][1] += tangent[1]; tangentAccum[i0][2] += tangent[2];
        tangentAccum[i1][0] += tangent[0]; tangentAccum[i1][1] += tangent[1]; tangentAccum[i1][2] += tangent[2];
        tangentAccum[i2][0] += tangent[0]; tangentAccum[i2][1] += tangent[1]; tangentAccum[i2][2] += tangent[2];
    }

    let tangents = [];
    for (let k=0; k<nv; k++){
        let t = norm(tangentAccum[k]);
        tangents.push(t[0], t[1], t[2]);
    }

    return { vertices, indices, normals, texCoords, tangents };
}

function rebuildSurface() {
    let data = CreateIndexedSurfaceData(uSteps, vSteps);
    surface.BufferData(data.vertices, data.normals, data.texCoords, data.tangents, data.indices);
}

function draw() {
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

    gl.uniform2f(shProgram.iRotationCenter, rotationCenter.u, rotationCenter.v);
    gl.uniform1f(shProgram.iTextureRotation, textureRotation);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    gl.uniform1i(shProgram.iDiffuseTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.uniform1i(shProgram.iSpecularTexture, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(shProgram.iNormalTexture, 2);

    surface.Draw();
    requestAnimationFrame(draw);
}

function updateUSteps(v) {
    uSteps = Math.max(3, parseInt(v));
    rebuildSurface();
}

function updateVSteps(v) {
    vSteps = Math.max(3, parseInt(v));
    rebuildSurface();
}

function createShader(gl, type, src) {
    let s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
}

function createProgram(gl, vsSrc, fsSrc) {
    let vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    let fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);

    if (!vs || !fs) return null;

    let p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    return p;
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.Use = function() { gl.useProgram(this.prog); };
}

function init() {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    initGL();
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(draw);
}
