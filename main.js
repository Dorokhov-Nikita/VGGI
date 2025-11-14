'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;

    this.U = [];
    this.V = [];

    this.iVertexBuffer = gl.createBuffer();

    this.SetSurfaceData = function (surfaceData) {
        this.U = surfaceData.U;
        this.V = surfaceData.V;
    };

    this.Draw = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

        for (let i = 0; i < this.U.length; i++) {
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.U[i]), gl.STREAM_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, this.U[i].length / 3);
        }

        gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

        for (let i = 0; i < this.V.length; i++) {
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.V[i]), gl.STREAM_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, this.V[i].length / 3);
        }
    };
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0.25, 0.15, 0.4, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 5, 20); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let scaleDown = m4.scaling(0.4, 0.4, 0.4); // зменшує фігуру вдвічі
    let translateToPointZero = m4.translation(0,0,-35);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
    let matAccum2 = m4.multiply(scaleDown, matAccum1); // застосовує масштабування
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum2 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    
    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1,1,0,1] );

    surface.Draw();
}

function CreateSurfaceData() {
    const R1 = 1.0;
    const R2 = 3.0 * R1;
    const b = 3.0 * R1;

    const aSteps = 40;
    const betaSteps = 40;

    let U = [];
    let V = [];

    for (let i = 0; i <= aSteps; i++) {
        let a = (2 * b * i) / aSteps;
        let polyline = [];

        for (let j = 0; j <= betaSteps; j++) {
            let beta = (2 * Math.PI * j) / betaSteps;

            let r = (R2 - R1) * Math.pow(Math.sin((Math.PI * a) / (4 * b)), 2) + R1;

            let x = r * Math.cos(beta);
            let y = r * Math.sin(beta);
            let z = a;

            polyline.push(x, y, z);
        }

        U.push(polyline);
    }

    for (let j = 0; j <= betaSteps; j++) {
        let beta = (2 * Math.PI * j) / betaSteps;
        let polyline = [];

        for (let i = 0; i <= aSteps; i++) {
            let a = (2 * b * i) / aSteps;

            let r = (R2 - R1) * Math.pow(Math.sin((Math.PI * a) / (4 * b)), 2) + R1;

            let x = r * Math.cos(beta);
            let y = r * Math.sin(beta);
            let z = a;

            polyline.push(x, y, z);
        }

        V.push(polyline);
    }

    return { U, V };
}



/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    surface.SetSurfaceData(CreateSurfaceData());

    gl.enable(gl.DEPTH_TEST);
}



/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
