//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789_
// (JT: why the numbers? counts columns, helps me keep 80-char-wide listings)
//
// Chapter 5: ColoredTriangle.js (c) 2012 matsuda  AND
// Chapter 4: RotatingTriangle_withButtons.js (c) 2012 matsuda
// became:
//
// BasicShapes.js  MODIFIED for EECS 351-1, 
//									Northwestern Univ. Jack Tumblin
//		--converted from 2D to 4D (x,y,z,w) vertices
//		--extend to other attributes: color, surface normal, etc.
//		--demonstrate how to keep & use MULTIPLE colored shapes in just one
//			Vertex Buffer Object(VBO). 
//		--create several canonical 3D shapes borrowed from 'GLUT' library:
//		--Demonstrate how to make a 'stepped spiral' tri-strip,  and use it
//			to build a cylinder, sphere, and torus.
//
// Vertex shader program----------------------------------
var VSHADER_SOURCE = 
  'uniform mat4 u_ModelMatrix;\n' +

  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +

  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_ModelMatrix * a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program----------------------------------
var FSHADER_SOURCE = 
//  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
//  '#endif GL_ES\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_Color;\n' +
  '}\n';

// Global Variables
//var ANGLE_STEP = 45.0;		// Rotation angle rate (degrees/second)
var floatsPerVertex = 7;	// # of Float32Array elements used for each vertex
													// (x,y,z,w)position + (r,g,b)color
													// Later, see if you can add:
													// (x,y,z) surface normal + (tx,ty) texture addr.

var cam_x = 0, cam_y = 6.5, cam_z = 4;
var foc_x = 0, foc_y = 0, foc_z = 0;
var angle_between = 90 * Math.PI / 180;

var g_angle01Rate = 45;
var g_angle02 = 0;
var g_angle02Rate = 10;
var g_angle03 = 0;
var g_angle03Rate = 17;


// Global vars for mouse click-and-drag for rotation.
var isDrag=false;		// mouse-drag: true when user holds down mouse button
var xMclik=0.0;			// last mouse button-down position (in CVV coords)
var yMclik=0.0;   
var xMdragTot=0.0;	// total (accumulated) mouse-drag amounts (in CVV coords).
var yMdragTot=0.0;  

var qNew = new Quaternion(0,0,0,1); // most-recent mouse drag's rotation
var qTot = new Quaternion(0,0,0,1);	// 'current' orientation (made from qNew)
var quatMatrix = new Matrix4();				// rotation matrix, made from latest qTot


function main() {
//==============================================================================
  // Retrieve <canvas> element
  	var canvas = document.getElementById('webgl');
	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
  	canvas.width = innerWidth - xtraMargin;
  	canvas.height = innerHeight * 0.7;

  	// Get the rendering context for WebGL
  	var gl = getWebGLContext(canvas);
  	if (!gl) {
    	console.log('Failed to get the rendering context for WebGL');
    	return;
  	}

  	// Initialize shaders
  	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    	console.log('Failed to intialize shaders.');
    	return;
  	}

  	// 
  	var n = initVertexBuffer(gl);
  	if (n < 0) {
    	console.log('Failed to set the vertex information');
    	return;
  	}
	
	// Register the Mouse & Keyboard Event-handlers-------------------------------
	// If users press any keys on the keyboard or move, click or drag the mouse,
	// the operating system records them as 'events' (small text strings that 
	// can trigger calls to functions within running programs). JavaScript 
	// programs running within HTML webpages can respond to these 'events' if we:
	//		1) write an 'event handler' function (called when event happens) and
	//		2) 'register' that function--connect it to the desired HTML page event. //
	// Here's how to 'register' all mouse events found within our HTML-5 canvas:
	canvas.onmousedown	=	function(ev){myMouseDown( ev, gl, canvas) }; 
	// when user's mouse button goes down, call mouseDown() function
	canvas.onmousemove = 	function(ev){myMouseMove( ev, gl, canvas) };
						  // when the mouse moves, call mouseMove() function					
	canvas.onmouseup = 		function(ev){myMouseUp(   ev, gl, canvas)};
	// NOTE! 'onclick' event is SAME as on 'mouseup' event
	// in Chrome Brower on MS Windows 7, and possibly other 
	// operating systems; thus I use 'mouseup' instead.

	// END Mouse & Keyboard Event-Handlers-----------------------------------


	window.addEventListener("keydown", myKeyDown, false);
	window.addEventListener("keyup", myKeyUp, false);

  	// Specify the color for clearing <canvas>
  	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	// NEW!! Enable 3D depth-test when drawing: don't over-draw at any pixel 
	// unless the new Z value is closer to the eye than the old one..
	//	gl.depthFunc(gl.LESS);			 // WebGL default setting: (default)
	gl.enable(gl.DEPTH_TEST); 	 


  	// Get handle to graphics system's storage location of u_ModelMatrix
 	var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  	if (!u_ModelMatrix) { 
    	console.log('Failed to get the storage location of u_ModelMatrix');
    	return;
  	}
  	// Create a local version of our model matrix in JavaScript 
  	var modelMatrix = new Matrix4();
  
  	// Create, init current rotation angle value in JavaScript
  	var currentAngle = 0.0;
	//-----------------  
  	var tick = function() {
    	currentAngle = animate(currentAngle);  // Update the rotation angle
		drawAll(gl, canvas, n, currentAngle, modelMatrix, u_ModelMatrix);   // Draw shapes
    	// report current angle on console
    	requestAnimationFrame(tick, canvas);   
    									// Request that the browser re-draw the webpage
  	};
  	tick();							// start (and continue) animation: draw current image
}

function initVertexBuffer(gl) {
//==============================================================================
// Create one giant vertex buffer object (VBO) that holds all vertices for all
// shapes.
	var c60 = Math.sqrt(3);	
 
 	// Make each 3D shape in its own array of vertices:
  	makeGroundGrid();				// create, fill the gndVerts array
	makeAxes();
	makeA();
	makePlus();
	makePlatform();
	makeSphere();
	makeNuggets();
	makeStar();
  	// how many floats total needed to store all shapes?
	var mySiz = (gndVerts.length + axisVerts.length + AVerts.length + 
				 PlusVerts.length + PlatformVerts.length + sphVerts.length + 
				 NuggetVerts.length + StarVerts.length);						

	// How many vertices total?
	var nn = mySiz / floatsPerVertex;
	console.log('nn is', nn, 'mySiz is', mySiz, 'floatsPerVertex is', floatsPerVertex);
	// Copy all shapes into one big Float32 array:
  	var colorShapes = new Float32Array(mySiz);
	gndStart = 0;						// next we'll store the ground-plane;
	for(i = 0, j = 0; j < gndVerts.length; i++, j++) {
		colorShapes[i] = gndVerts[j];
	}

	axisStart = i;
	for (j = 0; j < axisVerts.length; i++, j++) {
		colorShapes[i] = axisVerts[j];
	}

	AStart = i;
	for (j = 0; j < AVerts.length; i++, j++) {
		colorShapes[i] = AVerts[j];
	}

	plusStart = i;
	for (j = 0; j < PlusVerts.length; i++, j++) {
		colorShapes[i] = PlusVerts[j];
	}

	platformStart = i;
	for (j = 0; j < PlatformVerts.length; i++, j++) {
		colorShapes[i] = PlatformVerts[j];
	}

	sphStart = i;						// next, we'll store the sphere;
	for(j = 0; j < sphVerts.length; i++, j++) {// don't initialize i -- reuse it!
	 	colorShapes[i] = sphVerts[j];
	}

	nuggetStart = i;
	for (j = 0; j < NuggetVerts.length; i++, j++) {
		colorShapes[i] = NuggetVerts[j];
	}

	starStart = i;
	for (j = 0; j < StarVerts.length; i++, j++) {
		colorShapes[i] = StarVerts[j];
	}

	// Create a buffer object on the graphics hardware:
  	var shapeBufferHandle = gl.createBuffer();  
  	if (!shapeBufferHandle) {
    	console.log('Failed to create the shape buffer object');
    	return false;
  	}

  	// Bind the the buffer object to target:
	gl.bindBuffer(gl.ARRAY_BUFFER, shapeBufferHandle);
	// Transfer data from Javascript array colorShapes to Graphics system VBO
  	// (Use sparingly--may be slow if you transfer large shapes stored in files)
  	gl.bufferData(gl.ARRAY_BUFFER, colorShapes, gl.STATIC_DRAW);
    
  	//Get graphics system's handle for our Vertex Shader's position-input variable: 
  	var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  	if (a_Position < 0) {
		console.log('Failed to get the storage location of a_Position');
		return -1;
  	}

  	var FSIZE = colorShapes.BYTES_PER_ELEMENT; // how many bytes per stored value?

  	// Use handle to specify how to retrieve **POSITION** data from our VBO:
 	 gl.vertexAttribPointer(
  		a_Position, 	// choose Vertex Shader attribute to fill with data
  		4, 						// how many values? 1,2,3 or 4.  (we're using x,y,z,w)
  		gl.FLOAT, 		// data type for each value: usually gl.FLOAT
  		false, 				// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * floatsPerVertex, // Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		0);						// Offset -- now many bytes from START of buffer to the
  									// value we will actually use?
  	gl.enableVertexAttribArray(a_Position);  
  									// Enable assignment of vertex buffer object's position data

  	// Get graphics system's handle for our Vertex Shader's color-input variable;
  	var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
  	if(a_Color < 0) {
    	console.log('Failed to get the storage location of a_Color');
    	return -1;
  	}
  	// Use handle to specify how to retrieve **COLOR** data from our VBO:
  	gl.vertexAttribPointer(
  		a_Color, 				// choose Vertex Shader attribute to fill with data
  		3, 							// how many values? 1,2,3 or 4. (we're using R,G,B)
  		gl.FLOAT, 			// data type for each value: usually gl.FLOAT
  		false, 					// did we supply fixed-point data AND it needs normalizing?
  		FSIZE * 7, 			// Stride -- how many bytes used to store each vertex?
  									// (x,y,z,w, r,g,b) * bytes/value
  		FSIZE * 4);			// Offset -- how many bytes from START of buffer to the
  									// value we will actually use?  Need to skip over x,y,z,w
  									
  	gl.enableVertexAttribArray(a_Color);  
  									// Enable assignment of vertex buffer object's position data

	//--------------------------------DONE!
  	// Unbind the buffer object 
  	gl.bindBuffer(gl.ARRAY_BUFFER, null);

  	return nn;
}

// simple & quick-- 
// I didn't use any arguments such as color choices, # of verts,slices,bars, etc.
// YOU can improve these functions to accept useful arguments...
//
function makeAxes() {
//==============================================================================
// make the 3D axes
	axisVerts = new Float32Array([
		-100, 0, 0, 1, 1, 0, 0,
		100,  0, 0, 1, 1, 0, 0,
		0, -100, 0, 1, 0, 1, 0,
		0,  100, 0, 1, 0, 1, 0,
		0, 0, -100, 1, 0, 0, 1,
		0, 0,  100, 1, 0, 0, 1,
	]);
}

function makeA() {
//==============================================================================
// Make a 4-cornered pyramid from one OpenGL TRIANGLE_STRIP primitive.
// All vertex coords are +/1 or zero; pyramid base is in xy plane.
    AVerts = new Float32Array([
		-3, 0, 0, 1, 1, 0, 0,
		-3, 0, -1, 1, 1, 0, 0,
		-2, 0, 0, 1, 1, 1, 0,
		-2, 0, -1, 1, 1, 1, 0,
		0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		-0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		-0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		-3, 0, 0, 1, 1, 0, 0,
		-3, 0, -1, 1, 1, 0, 0,

		// right slash
		3, 0, 0, 1, 1, 0, 0,
		3, 0, -1, 1, 1, 0, 0,
		2, 0, 0, 1, 1, 1, 0,
		2, 0, -1, 1, 1, 1, 0,
		-0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		-0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		3, 0, 0, 1, 1, 0, 0,
		3, 0, -1, 1, 1, 0, 0,
	
		// middle stripe front
		-1.5, 1.5, -0.1, 1, 0.3, 0.7, 0.2,
		-1.5, 2.5, -0.1, 1, 0.5, 0.3, 0.8,
		1.5,  1.5, -0.1, 1, 0.6, 0.3, 0.6,
		1.5,  2.5, -0.1, 1, 0.9, 1.0, 0.3,
	
		// middle stripe back
		-1.5, 1.5, -0.9, 1, 0.3, 0.7, 0.2,
		-1.5, 2.5, -0.9, 1, 0.5, 0.3, 0.8,
		1.5,  1.5, -0.9, 1, 0.6, 0.3, 0.6,
		1.5,  2.5, -0.9, 1, 0.9, 1.0, 0.3,
	
		// middle strip top
		-1.5, 2.5, -0.1, 1, 0.5, 0.3, 0.8,
		-1.5, 2.5, -0.9, 1, 0.5, 0.3, 0.8,
		1.5,  2.5, -0.1, 1, 0.9, 1.0, 0.3,
		1.5,  2.5, -0.9, 1, 0.9, 1.0, 0.3,
	
		// middle strip bottom
		-1.5, 1.5, -0.1, 1, 0.3, 0.7, 0.2,
		-1.5, 1.5, -0.9, 1, 0.3, 0.7, 0.2,
		1.5,  1.5, -0.1, 1, 0.6, 0.3, 0.6,
		1.5,  1.5, -0.9, 1, 0.6, 0.3, 0.6,
	
		// left front and back
		-3, 0, 0, 1, 1, 0, 0,
		-2, 0, 0, 1, 1, 1, 0,
		-0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		0.5, 6, 0, 1, 0.6, 0.5, 0.4,
		-3, 0, -1, 1, 1, 0, 0,
		-2, 0, -1, 1, 1, 1, 0,
		-0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		0.5, 6, -1, 1, 0.6, 0.5, 0.4,
	
		// right front and back
		3, 0, 0, 1, 1, 0, 0,
		2, 0, 0, 1, 1, 1, 0,
		0.5, 6, 0, 1, 0.4, 0.5, 0.6,
		-0.5, 6, 0, 1, 0.6, 0.5, 0.4,
		3, 0, -1, 1, 1, 0, 0,
		2, 0, -1, 1, 1, 1, 0,
		0.5, 6, -1, 1, 0.4, 0.5, 0.6,
		-0.5, 6, -1, 1, 0.6, 0.5, 0.4,
	]);
  	// YOU write this one...
}

function makePlus() {
	//==============================================================================
	// Make a 4-cornered pyramid from one OpenGL TRIANGLE_STRIP primitive.
	// All vertex coords are +/1 or zero; pyramid base is in xy plane.
	PlusVerts = new Float32Array([
		0, 0, 0, 1, 1, 1, 1,
		-0.5, 1.5, 0, 1, 1, 0, 0,
		0.5, 1.5, 0, 1, 1, 1, 0,
		0.5, 0.5, 0, 1, 1, 0.5, 0.3,
		1.5, 0.5, 0, 1, 0, 1, 1,
		1.5, -0.5, 0, 1, 0, 0, 1,
		0.5, -0.5, 0, 1, 1, 0.5, 0.3,
		0.5, -1.5, 0, 1, 1, 1, 0,
		-0.5, -1.5, 0, 1, 1, 0, 0,
		-0.5, -0.5, 0, 1, 1, 0.5, 0.3,
		-1.5, -0.5, 0, 1, 0, 0, 1,
		-1.5, 0.5, 0, 1, 0, 1, 1,
		-0.5, 0.5, 0, 1, 1, 0.5, 0.3,
		-0.5, 1.5, 0, 1, 1, 0, 0,
	
		0, 0, -1, 1, 1, 1, 1,
		-0.5, 1.5, -1, 1, 1, 0, 0,
		0.5, 1.5, -1, 1, 1, 1, 0,
		0.5, 0.5, -1, 1, 1, 0.5, 0.3,
		1.5, 0.5, -1, 1, 0, 1, 1,
		1.5, -0.5, -1, 1, 0, 0, 1,
		0.5, -0.5, -1, 1, 1, 0.5, 0.3,
		0.5, -1.5, -1, 1, 1, 1, 0,
		-0.5, -1.5, -1, 1, 1, 0, 0,
		-0.5, -0.5, -1, 1, 1, 0.5, 0.3,
		-1.5, -0.5, -1, 1, 0, 0, 1,
		-1.5, 0.5, -1, 1, 0, 1, 1,
		-0.5, 0.5, -1, 1, 1, 0.5, 0.3,
		-0.5, 1.5, -1, 1, 1, 0, 0,
	
		-0.5, 1.5, 0, 1, 1, 0, 0,
		-0.5, 1.5, -1, 1, 1, 0, 0,
		0.5, 1.5, 0, 1, 1, 1, 0,
		0.5, 1.5, -1, 1, 1, 1, 0,
		0.5, 0.5, 0, 1, 1, 0.5, 0.3,
		0.5, 0.5, -1, 1, 1, 0.5, 0.3,
		1.5, 0.5, 0, 1, 0, 1, 1,
		1.5, 0.5, -1, 1, 0, 1, 1,
		1.5, -0.5, 0, 1, 0, 0, 1,
		1.5, -0.5, -1, 1, 0, 0, 1,
		0.5, -0.5, 0, 1, 1, 0.5, 0.3,
		0.5, -0.5, -1, 1, 1, 0.5, 0.3,
		0.5, -1.5, 0, 1, 1, 1, 0,
		0.5, -1.5, -1, 1, 1, 1, 0,
		-0.5, -1.5, 0, 1, 1, 0, 0,
		-0.5, -1.5, -1, 1, 1, 0, 0,
		-0.5, -0.5, 0, 1, 1, 0.5, 0.3,
		-0.5, -0.5, -1, 1, 1, 0.5, 0.3,
		-1.5, -0.5, 0, 1, 0, 0, 1,
		-1.5, -0.5, -1, 1, 0, 0, 1,
		-1.5, 0.5, 0, 1, 0, 1, 1,
		-1.5, 0.5, -1, 1, 0, 1, 1,
		-0.5, 0.5, 0, 1, 1, 0.5, 0.3,
		-0.5, 0.5, -1, 1, 1, 0.5, 0.3,
		-0.5, 1.5, 0, 1, 1, 0, 0,
		-0.5, 1.5, -1, 1, 1, 0, 0,
	]);
}

function makePlatform() {
	//==============================================================================
	// Make a 4-cornered pyramid from one OpenGL TRIANGLE_STRIP primitive.
	// All vertex coords are +/1 or zero; pyramid base is in xy plane.
	var c60 = Math.sqrt(3);	
	PlatformVerts = new Float32Array([
		// Shape 1: Hexagonal Prism
		// Face 0: 
		-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
		1.0,   0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
    	-1.0,  7.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 6
	
		// Face 1:
		-1.0,  7.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 6
		1.0,  7.0, -c60, 1.0, 		0.0,  0.5,  0.0,	// Node 7
    	1.0,  0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1

    	// Face 2:
		1.0,  0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
		2.0,  0.0,  0.0, 1.0,  		0.0,  0.0,  1.0, 	// Node 2
    	1.0,  7.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 7

    	// Face 3:
		1.0,  7.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 7
		2.0,  7.0,  0.0, 1.0,  		0.0,  0.0,  0.5,	// Node 8
    	2.0,  0.0,  0.0, 1.0,  		0.0,  0.0,  1.0, 	// Node 2

		// Face 4:
		2.0,  0.0,  0.0, 1.0,  		0.0,  0.0,  1.0,	// Node 2
    	1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3
		2.0,  7.0,  0.0, 1.0,  		0.0,  0.0,  0.5,	// Node 8
	
		// Face 5:
		2.0,  7.0,  0.0, 1.0,  		0.0,  0.0,  0.5,	// Node 8
    	1.0,  7.0,  c60, 1.0, 		0.5,  0.5,  0.0,	// Node 9
    	1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3
    
		// Face 6:
		1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
		-1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0, 	// Node 4
		1.0,  7.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 9

    	// Face 7: 
		1.0,  7.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 9
		-1.0,  7.0,  c60, 1.0,      0.0,  0.5,  0.5,	// Node 10
    	-1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0, 	// Node 4

		// Face 8:
		-1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
		-2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0, 	// Node 5
		-1.0,  7.0,  c60, 1.0,      0.0,  0.5,  0.5, 	// Node 10

    	// Face 9:
		-1.0,  7.0,  c60, 1.0,      0.0,  0.5,  0.5,    // Node 10
		-2.0,  7.0,  0.0, 1.0,      0.5,  0.0,  0.5,	// Node 11
    	-2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0, 	// Node 5

		// Face 10:
		-2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0, 	// Node 5
		-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0, 	// Node 0
		-2.0,  7.0,  0.0, 1.0,      0.5,  0.0,  0.5, 	// Node 11

    	// Face 11:
		-2.0,  7.0,  0.0, 1.0,      0.5,  0.0,  0.5, 	// Node 11
		-1.0,  7.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 6
    	-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0, 	// Node 0

		// Bottom Cover
		-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
    	 1.0,  0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
		 0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center
	
		 1.0,  0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
		 2.0,  0.0,  0.0, 1.0,  	0.0,  0.0,  1.0,	// Node 2 
		 0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

    	 2.0,  0.0,  0.0, 1.0,  	0.0,  0.0,  1.0,	// Node 2 
    	 1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
		 0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		 1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
		-1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
		0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		-1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
		-2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 5
		0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		-2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 5
		-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
		0.0,   0.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		// Top Cover
		-1.0,  7.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
    	 1.0,  7.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
		 0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center
	
		 1.0,  7.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1
		 2.0,  7.0,  0.0, 1.0,  	0.0,  0.0,  1.0,	// Node 2 
		 0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

    	 2.0,  7.0,  0.0, 1.0,  	0.0,  0.0,  1.0,	// Node 2 
    	 1.0,  7.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
		 0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		 1.0,  7.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
		-1.0,  7.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
		0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		-1.0,  7.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
		-2.0,  7.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 5
		0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

		-2.0,  7.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 5
		-1.0,  7.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
		0.0,   7.0,  0.0, 1.0,		0.6,  0.7,	0.9,	// Low Center

	// Shape 2: Hexagonal Hourglass: 12 nodes + 1 node in the middle
/*	-1.0,  0.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 0
	1.0,  0.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 1 
	2.0,  0.0,  0.0, 1.0,  		0.0,  0.0,  1.0,	// Node 2 
	1.0,  0.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 3 
   -1.0,  0.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 4
   -2.0,  0.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 5
   -1.0,  6.0, -c60, 1.0,		1.0,  0.0,	0.0,	// Node 6
	1.0,  6.0, -c60, 1.0, 		0.0,  1.0,  0.0, 	// Node 7 
	2.0,  6.0,  0.0, 1.0,  		0.0,  0.0,  1.0,	// Node 8 
	1.0,  6.0,  c60, 1.0, 		1.0,  1.0,  0.0, 	// Node 9 
   -1.0,  6.0,  c60, 1.0,      0.0,  1.0,  1.0,    // Node 10
   -2.0,  6.0,  0.0, 1.0,      1.0,  0.0,  1.0,    // Node 11

   0.0,  3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

   */
		// Face Bottom 0:
		-1.0, 0.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 0
    	1.0,  0.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 1
		0.0,  3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face Bottom 1:
		1.0,  0.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 1
    	2.0,  0.0,  0.0, 1.0,  		0.0,  0.0,  0.5,	// Node 2
		0.0,  3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face Bottom 2:
		2.0,   0.0,  0.0, 1.0,  	0.0,  0.0,  0.5,	// Node 2
		1.0,   0.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 3
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face Bottom 3:
		1.0,   0.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 3
		-1.0,  0.0,  c60, 1.0,      0.0,  0.5,  0.5,    // Node 4
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face Bottom 4:
		-1.0,  0.0,  c60, 1.0,      0.0,  0.5,  0.5,    // Node 4
		-2.0,  0.0,  0.0, 1.0,      0.5,  0.0,  0.5,    // Node 5
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face Bottom 5:
		-2.0,  0.0,  0.0, 1.0,      0.5,  0.0,  0.5,    // Node 5
		-1.0,  0.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 1
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 1:
		-1.0, 6.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 6
    	1.0,  6.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 7
		0.0,  3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 1:
		1.0,  6.0, -c60, 1.0, 		0.0,  0.5,  0.0, 	// Node 7
    	2.0,  6.0,  0.0, 1.0,  		0.0,  0.0,  0.5,	// Node 8
		0.0,  3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 2:
		2.0,   6.0,  0.0, 1.0,  	0.0,  0.0,  0.5,	// Node 8
		1.0,   6.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 9
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 3:
		1.0,   6.0,  c60, 1.0, 		0.5,  0.5,  0.0, 	// Node 9
		-1.0,  6.0,  c60, 1.0,      0.0,  0.5,  0.5,    // Node 10
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 4:
		-1.0,  6.0,  c60, 1.0,      0.0,  0.5,  0.5,    // Node 10
		-2.0,  6.0,  0.0, 1.0,      0.5,  0.0,  0.5,    // Node 11
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node

		// Face top 5:
		-2.0,  6.0,  0.0, 1.0,      0.5,  0.0,  0.5,    // Node 11
		-1.0,  6.0, -c60, 1.0,		0.5,  0.0,	0.0,	// Node 6
		0.0,   3.0,  0.0, 1.0,      1.0,  1.0,  1.0,    // Mid node
	]);
}


function makeNuggets() {
	NuggetVerts = new Float32Array([
		-1, 0, 0, 1, 1, 0.5, 0.2,
		1, 0, 0, 1, 0.5, 1, 0.2,
		-1, 1, 0, 1, 1, 0.5, 0.2,
		1, 1, 0, 1, 0.5, 1, 0.2,

		-0.7, 1.5, -0.5, 1, 0.8, 1, 0.3,
		 0.7, 1.5, -0.5, 1, 0.8, 1, 0.3,
	 
		-1, 1, -1, 1, 1, 0.2, 0.5,
		1, 1, -1, 1, 0.7, 1, 0.3,
		-1, 0, -1, 1, 1, 0.2, 0.5,
	 	1, 0, -1, 1, 0.7, 1, 0.3,

		-1, 0, 0, 1, 1, 0.5, 0.2,
		 1, 0, 0, 1, 0.5, 1, 0.2,


	 	-1, 0, 0, 1, 1, 0.5, 0.2,
	 	-1, 1, 0, 1, 1, 0.5, 0.2,
	 	-1, 0, -1, 1, 1, 0.2, 0.5,
	 	-1, 1, -1, 1, 1, 0.2, 0.5,
	 

	 	1, 0, 0, 1, 0.5, 1, 0.2,
	 	1, 1, 0, 1, 0.5, 1, 0.2,
	 	1, 0, -1, 1, 0.7, 1, 0.3,
	 	1, 1, -1, 1, 0.7, 1, 0.3,

	 	-1, 1, 0, 1, 1, 0.5, 0.2,
	 	-1, 1, -1, 1, 1, 0.2, 0.5,
	 	-0.7, 1.5, -0.5, 1, 0.8, 1, 0.3,

	 	1, 1, 0, 1, 0.5, 1, 0.2,
	 	1, 1, -1, 1, 0.7, 1, 0.3,
	 	0.7, 1.5, -0.5, 1, 0.8, 1, 0.3,
	]);
}


function makeStar() {
	StarVerts = new Float32Array([
		-0.587784, 0.000000, -0.809018, 1, 0.66, 0, 0,
		0.000005, 0.000000, -2.618807, 1, 1, 0.66, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
	
		-0.587784, 0.000000, -0.809018, 1, 0.66, 0, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
		-2.490633, 0.000000, -0.809260, 1, 1, 0.66, 0,
	
		-0.951057, 0.000000, 0.309016, 1, 0, 0, 0.66,
		-2.490633, 0.000000, -0.809260, 1, 1, 0.66, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
	
		-0.951057, 0.000000, 0.309016, 1, 0, 0, 0.66,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
		-1.539299, 0.000000, 2.118658, 1, 1, 0.66, 0,
	
		-0.000001, 0.000000, 1.000000, 1, 0.66, 0, 0,
		-1.539299, 0.000000, 2.118658, 1, 1, 0.66, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
	
		-0.000001, 0.000000, 1.000000, 1, 0.66, 0, 0,
		-0.000000, 0.354023, -0.000000 , 1, 1, 1, 1,
		1.539296, 0.000000, 2.118660, 1, 1, 0.66, 0,
	
		0.951056, 0.000000, 0.309017, 1, 0, 0, 0.66,
		1.539296, 0.000000, 2.118660, 1, 1, 0.66, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
	
		0.951056, 0.000000, 0.309017, 1, 0, 0, 0.66,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
		2.490634, 0.000000, -0.809256, 1, 1, 0.66, 0,
		
		0.587787, 0.000000, -0.809016, 1, 0.66, 0, 0,
		2.490634, 0.000000, -0.809256, 1, 1, 0.66, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
	
		0.587787, 0.000000, -0.809016, 1, 0.66, 0, 0,
		-0.000000, 0.354023, -0.000000, 1, 1, 1, 1,
		0.000005, 0.000000, -2.618807, 1, 1, 0.66, 0,
	
		0.587787, 0.000000, -0.809016, 1, 0.66, 0, 0,
		0.000005, 0.000000, -2.618807, 1, 1, 0.66, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
	
		0.587787, 0.000000, -0.809016, 1, 0.66, 0, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
		2.490634, 0.000000, -0.809256, 1, 1, 0.66, 0,
	
		0.951056, 0.000000, 0.309017, 1, 0, 0, 0.66,
		2.490634, 0.000000, -0.809256, 1, 1, 0.66, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
	
		0.951056, 0.000000, 0.309017, 1, 0, 0, 0.66,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
		1.539296, 0.000000, 2.118660, 1, 1, 0.66, 0,
	
		-0.000001, 0.000000, 1.000000, 1, 0.66, 0, 0,
		1.539296, 0.000000, 2.118660, 1, 1, 0.66, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
	
		-0.000001, 0.000000, 1.000000, 1, 0.66, 0, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
		-1.539299, 0.000000, 2.118658, 1, 1, 0.66, 0,
	
		-0.951057, 0.000000, 0.309016, 1, 0, 0, 0.66,
		-1.539299, 0.000000, 2.118658, 1, 1, 0.66, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
	
		-0.951057, 0.000000, 0.309016, 1, 0, 0, 0.66,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
		-2.490633, 0.000000, -0.809260, 1, 1, 0.66, 0,
	
		-0.587784, 0.000000, -0.809018, 1, 0.66, 0, 0,
		-2.490633, 0.000000, -0.809260, 1, 1, 0.66, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
	
		-0.587784, 0.000000, -0.809018, 1, 0.66, 0, 0,
		-0.000000, -0.354000, -0.000000, 1, 1, 1, 1,
		0.000005, 0.000000, -2.618807, 1, 1, 0.66, 0,
	]);
}


function makeSphere() {
	//==============================================================================
	// Make a sphere from one OpenGL TRIANGLE_STRIP primitive.   Make ring-like 
	// equal-lattitude 'slices' of the sphere (bounded by planes of constant z), 
	// and connect them as a 'stepped spiral' design (see makeCylinder) to build the
	// sphere from one triangle strip.
	var slices = 13;		// # of slices of the sphere along the z axis. >=3 req'd
												// (choose odd # or prime# to avoid accidental symmetry)
	var sliceVerts	= 27;	// # of vertices around the top edge of the slice
												// (same number of vertices on bottom of slice, too)
	var topColr = new Float32Array([0.7, 0.7, 0.7]);	// North Pole: light gray
	var equColr = new Float32Array([0.3, 0.7, 0.3]);	// Equator:    bright green
	var botColr = new Float32Array([0.9, 0.9, 0.9]);	// South Pole: brightest gray.
	var sliceAngle = Math.PI/slices;	// lattitude angle spanned by one slice.
	
	// Create a (global) array to hold this sphere's vertices:
	sphVerts = new Float32Array(  ((slices * 2* sliceVerts) -2) * floatsPerVertex);
											// # of vertices * # of elements needed to store them. 
											// each slice requires 2*sliceVerts vertices except 1st and
											// last ones, which require only 2*sliceVerts-1.
											
	// Create dome-shaped top slice of sphere at z=+1
	// s counts slices; v counts vertices; 
	// j counts array elements (vertices * elements per vertex)
	var cos0 = 0.0;					// sines,cosines of slice's top, bottom edge.
	var sin0 = 0.0;
	var cos1 = 0.0;
	var sin1 = 0.0;	
	var j = 0;							// initialize our array index
	var isLast = 0;
	var isFirst = 1;
	for(s=0; s<slices; s++) {	// for each slice of the sphere,
		// find sines & cosines for top and bottom of this slice
		if(s==0) {
			isFirst = 1;	// skip 1st vertex of 1st slice.
			cos0 = 1.0; 	// initialize: start at north pole.
			sin0 = 0.0;
		}
		else {					// otherwise, new top edge == old bottom edge
			isFirst = 0;	
			cos0 = cos1;
			sin0 = sin1;
		}								// & compute sine,cosine for new bottom edge.
		cos1 = Math.cos((s+1)*sliceAngle);
		sin1 = Math.sin((s+1)*sliceAngle);
		// go around the entire slice, generating TRIANGLE_STRIP verts
		// (Note we don't initialize j; grows with each new attrib,vertex, and slice)
		if(s==slices-1) isLast=1;	// skip last vertex of last slice.
		for(v=isFirst; v< 2*sliceVerts-isLast; v++, j+=floatsPerVertex) {	
			if(v%2==0)
			{				// put even# vertices at the the slice's top edge
							// (why PI and not 2*PI? because 0 <= v < 2*sliceVerts
							// and thus we can simplify cos(2*PI(v/2*sliceVerts))  
				sphVerts[j  ] = sin0 * Math.cos(Math.PI*(v)/sliceVerts); 	
				sphVerts[j+1] = sin0 * Math.sin(Math.PI*(v)/sliceVerts);	
				sphVerts[j+2] = cos0;		
				sphVerts[j+3] = 1.0;			
			}
			else { 	// put odd# vertices around the slice's lower edge;
							// x,y,z,w == cos(theta),sin(theta), 1.0, 1.0
							// 					theta = 2*PI*((v-1)/2)/capVerts = PI*(v-1)/capVerts
				sphVerts[j  ] = sin1 * Math.cos(Math.PI*(v-1)/sliceVerts);		// x
				sphVerts[j+1] = sin1 * Math.sin(Math.PI*(v-1)/sliceVerts);		// y
				sphVerts[j+2] = cos1;																				// z
				sphVerts[j+3] = 1.0;																				// w.		
			}
			if(s==0) {	// finally, set some interesting colors for vertices:
				sphVerts[j+4]=topColr[0]; 
				sphVerts[j+5]=topColr[1]; 
				sphVerts[j+6]=topColr[2];	
			}
			else if(s==slices-1) {
				sphVerts[j+4]=botColr[0]; 
				sphVerts[j+5]=botColr[1]; 
				sphVerts[j+6]=botColr[2];	
			}
			else {
				sphVerts[j+4]=Math.random();// equColr[0]; 
				sphVerts[j+5]=Math.random();// equColr[1]; 
				sphVerts[j+6]=Math.random();// equColr[2];					
			}
		}
	}
}

function makeGroundGrid() {
//==============================================================================
// Create a list of vertices that create a large grid of lines in the x,y plane
// centered at x=y=z=0.  Draw this shape using the GL_LINES primitive.

	var xcount = 100;			// # of lines to draw in x,y to make the grid.
	var ycount = 100;		
	var xymax	= 50.0;			// grid size; extends to cover +/-xymax in x and y.
 	var xColr = new Float32Array([1.0, 1.0, 0.3]);	// bright yellow
 	var yColr = new Float32Array([0.5, 1.0, 0.5]);	// bright green.
 	
	// Create an (global) array to hold this ground-plane's vertices:
	gndVerts = new Float32Array(floatsPerVertex*2*(xcount+ycount));
						// draw a grid made of xcount+ycount lines; 2 vertices per line.
						
	var xgap = xymax/(xcount-1);		// HALF-spacing between lines in x,y;
	var ygap = xymax/(ycount-1);		// (why half? because v==(0line number/2))
	
	// First, step thru x values as we make vertical lines of constant-x:
	for(v=0, j=0; v<2*xcount; v++, j+= floatsPerVertex) {
		if(v%2==0) {	// put even-numbered vertices at (xnow, -xymax, 0)
			gndVerts[j  ] = -xymax + (v  )*xgap;	// x
			gndVerts[j+1] = -xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {				// put odd-numbered vertices at (xnow, +xymax, 0).
			gndVerts[j  ] = -xymax + (v-1)*xgap;	// x
			gndVerts[j+1] = xymax;								// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = xColr[0];			// red
		gndVerts[j+5] = xColr[1];			// grn
		gndVerts[j+6] = xColr[2];			// blu
	}
	// Second, step thru y values as wqe make horizontal lines of constant-y:
	// (don't re-initialize j--we're adding more vertices to the array)
	for(v=0; v<2*ycount; v++, j+= floatsPerVertex) {
		if(v%2==0) {		// put even-numbered vertices at (-xymax, ynow, 0)
			gndVerts[j  ] = -xymax;								// x
			gndVerts[j+1] = -xymax + (v  )*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		else {					// put odd-numbered vertices at (+xymax, ynow, 0).
			gndVerts[j  ] = xymax;								// x
			gndVerts[j+1] = -xymax + (v-1)*ygap;	// y
			gndVerts[j+2] = 0.0;									// z
			gndVerts[j+3] = 1.0;									// w.
		}
		gndVerts[j+4] = yColr[0];			// red
		gndVerts[j+5] = yColr[1];			// grn
		gndVerts[j+6] = yColr[2];			// blu
	}
}


function drawAll(gl, canvas, n, currentAngle, modelMatrix, u_ModelMatrix) {
//==============================================================================
	var leftSlider = document.getElementById("myLeft");
	var rightSlider = document.getElementById("myRight");
	var topSlider = document.getElementById("myTop");
	var bottomSlider = document.getElementById("myBottom");
	var nearSlider = document.getElementById("myNear");
	var farSlider = document.getElementById("myFar");
  	var leftVal = leftSlider.value
	var rightVal = rightSlider.value
  	var topVal = topSlider.value
	var bottomVal = bottomSlider.value
	var nearVal = nearSlider.value
	var farVal = farSlider.value


	var xtraMargin = 16;    // keep a margin (otherwise, browser adds scroll-bars)
	canvas.width = innerWidth - xtraMargin;
	canvas.height = innerHeight * 0.7;
	var vpAspect = canvas.width /			// On-screen aspect ratio for
	(canvas.height * 2);	// this camera: width/height.

  // Clear <canvas>  colors AND the depth buffer
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	modelMatrix.setIdentity();    // DEFINE 'world-space' coords.

// STEP 2: add in a 'perspective()' function call here to define 'camera lens':
	modelMatrix.perspective(	35,   // FOVY: top-to-bottom vertical image angle, in degrees
                            	vpAspect,   // Image Aspect Ratio: camera lens width/height
                           		1,   // camera z-near distance (always positive; frustum begins at z = -znear)
                        		30);  // camera z-far distance (always positive; frustum ends at z = -zfar)
	
	gl.viewport(0,        // Viewport lower-left corner
				0,                              // location(in pixels)
				innerWidth / 2,        // viewport width, height.
				innerHeight * 0.7);

	modelMatrix.lookAt( cam_x, cam_y, cam_z,	// center of projection
                    	foc_x, foc_y, foc_z,	// look-at point 
                    	0, 0, 1);	// View UP vector.
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawitems(gl, currentAngle, modelMatrix, u_ModelMatrix);


	//modelMatrix.setOrtho(-1.1 * canvas.width / 600 * leftVal / 50, 1.1 * canvas.width / 600 * rightVal / 50,
	// 	                 -1.1 * canvas.height / 300 * bottomVal / 50, 1.1 * canvas.height / 300 * topVal / 50, 1.0 * nearVal / 50, 100.0 * farVal / 50);
	var len = (30-1)/3 * Math.tan(17.5 * Math.PI / 180)
	modelMatrix.setOrtho(-1 * len * leftVal / 50, 1 * len * rightVal / 50,
						 -1 * len * bottomVal / 50, 1 * len * topVal / 50, 1.0 * nearVal / 50, 101.0 * farVal / 50);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.viewport(innerWidth / 2,        // Viewport lower-left corner
		0,                              // location(in pixels)
		innerWidth / 2,        // viewport width, height.
		innerHeight * 0.7);

	modelMatrix.lookAt( cam_x, cam_y, cam_z,	// center of projection
						foc_x, foc_y, foc_z,	// look-at point 
						0, 0, 1);	// View UP vector.
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawitems(gl, currentAngle, modelMatrix, u_ModelMatrix);
}


function drawitems(gl, currentAngle, modelMatrix, u_ModelMatrix) {
  //===========================================================
  //
  pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	//---------Draw Ground Plane, without spinning.
  	// position it.
  	//modelMatrix.translate( 0.4, -0.4, 0.0);	
  	modelMatrix.scale(0.2, 0.2, 0.2);				// shrink by 10X:

  	// Drawing:
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    // Draw just the ground-plane's vertices
    gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
    						  gndStart/floatsPerVertex,	// start at this vertex number, and
    						  gndVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  //===========================================================
  //
  pushMatrix(modelMatrix);  // SAVE world drawing coords.
	//---------Draw Axis, without spinning.
	// position it.				// shrink by 10X:

	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(0.1, 0.1, 0.1);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  // Draw just the ground-plane's vertices
  	gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
							axisStart/floatsPerVertex,	// start at this vertex number, and
							axisVerts.length/floatsPerVertex);	// draw this many vertices.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
//===========================================================
  //
  pushMatrix(modelMatrix);  // SAVE world drawing coords.
	//---------Draw A Letter, spinning.
	// position it.				// shrink by 10X:
	modelMatrix.translate(-0.8, -1, 0.0);	
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(0.15, 0.15, 0.15);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.rotate(currentAngle, 0, 1, 0);
	modelMatrix.translate(0, 0, 0.5);
	
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 0, 10);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 10, 10);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 20, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 24, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 28, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 32, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 36, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 40, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 44, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, AStart/floatsPerVertex + 48, 4);
  //modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
//===========================================================
  //
  //pushMatrix(modelMatrix);  // SAVE world drawing coords.
	//---------Draw First plus---------

	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(1, 1, 1);
	//modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.translate(-0.5, 6, -0.5);
	modelMatrix.rotate(currentAngle, 1, 0, 0);
	modelMatrix.translate(-1.5, 0, 0.5);   // leftright, updown, frontback
	pushMatrix(modelMatrix);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  // Draw just the Plus's vertices
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex, 14);
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex + 14, 14);
	gl.drawArrays(gl.TRIANGLE_STRIP, plusStart/floatsPerVertex + 28, 26);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  
//===========================================================
  //
	//---------Draw Second plus---------
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(1, 1, 1);
	modelMatrix.translate(-1.5, 0, -0.5);
	modelMatrix.rotate(currentAngle, 1, 1, 0);
	modelMatrix.translate(-1.5, 0, 0.5);   // leftright, updown, frontback
	pushMatrix(modelMatrix);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  // Draw just the ground-plane's vertices
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex, 14);
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex + 14, 14);
	gl.drawArrays(gl.TRIANGLE_STRIP, plusStart/floatsPerVertex + 28, 26);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//===========================================================
  //
	//---------Draw Third plus---------
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(1, 1, 1);
	modelMatrix.translate(-1.5, 0, -0.5);
	modelMatrix.rotate(currentAngle, 1, 1, 0);
	modelMatrix.translate(-1.5, 0, 0.5);   // leftright, updown, frontback
	pushMatrix(modelMatrix);  // SAVE world drawing coords.
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  // Draw just the ground-plane's vertices
  	// gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
	// 						plusStart/floatsPerVertex,	// start at this vertex number, and
	// 						PlusVerts.length/floatsPerVertex);	// draw this many vertices.
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex, 14);
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex + 14, 14);
	gl.drawArrays(gl.TRIANGLE_STRIP, plusStart/floatsPerVertex + 28, 26);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//===========================================================
  //
	//---------Draw Fourth plus---------
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(1, 1, 1);
	modelMatrix.translate(-1.5, 0, -0.5);
	modelMatrix.rotate(currentAngle, 1, 1, 0);
	modelMatrix.translate(-1.5, 0, 0.5);   // leftright, updown, frontback
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  // Draw just the ground-plane's vertices
  	// gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
	// 						plusStart/floatsPerVertex,	// start at this vertex number, and
	// 						PlusVerts.length/floatsPerVertex);	// draw this many vertices.
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex, 14);
	gl.drawArrays(gl.TRIANGLE_FAN, plusStart/floatsPerVertex + 14, 14);
	gl.drawArrays(gl.TRIANGLE_STRIP, plusStart/floatsPerVertex + 28, 26);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//===========================================================
  pushMatrix(modelMatrix);
  	//---------Draw platform, spinning.
	// position it.				// shrink by 10X:
	modelMatrix.translate(-1, 1, 0);
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(0.06, 0.06, 0.06);

	// Draw the accompaning axes
	pushMatrix(modelMatrix);
	modelMatrix.scale(0.25, 0.25, 0.25);
	modelMatrix.rotate(-currentAngle, 0, 0, 1); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.LINES, 								// use this drawing primitive, and
		axisStart/floatsPerVertex,	// start at this vertex number, and
		axisVerts.length/floatsPerVertex);	// draw this many vertices.
	modelMatrix = popMatrix();

	// draw the actual platform
	modelMatrix.rotate(90, 1, 0, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawplatform(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

  //===========================================================
  pushMatrix(modelMatrix);
  	//---------Draw bendable, spinning.
	// position it.				// shrink by 10X:
	modelMatrix.translate(1.3, -1, 0);
	// Drawing:
	// Pass our current matrix to the vertex shaders:
	modelMatrix.scale(0.06, 0.06, 0.06);
	// draw the actual hourglasses
	modelMatrix.rotate(90, 1, 0, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawbendable(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

  //===========================================================
  // -- Draw Nuggets
  pushMatrix(modelMatrix);
	modelMatrix.translate(-0.7, 0, 0);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.scale(0.5, 0.5, 0.5);
	pushMatrix(modelMatrix);
	modelMatrix.translate(4, 0, 0); // leftright, updown, frontback
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawNuggets(gl, nuggetStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

  //===========================================================
  // -- Draw right nugget
  pushMatrix(modelMatrix);
	modelMatrix.translate(3.4, 0.4, 0); // leftright, updown, frontback
	modelMatrix.rotate(g_angle03 * 2, 0, 0, -1);
	modelMatrix.translate(-0.6, -0.4, 0); // leftright, updown, frontback
	pushMatrix(modelMatrix);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawNuggets(gl, nuggetStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
	//drawbendable(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  //===========================================================
  // -- Draw right vertical nugget
  pushMatrix(modelMatrix);
	modelMatrix.translate(-0.6, 0, 0); // leftright, updown, frontback
	modelMatrix.rotate(90, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawNuggets(gl, nuggetStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
	//drawbendable(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

  //===========================================================
  // -- Draw left nugget
  pushMatrix(modelMatrix);
	modelMatrix.translate(4.6, 0.4, 0); // leftright, updown, frontback
	modelMatrix.rotate(g_angle03 * 2, 0, 0, 1);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	modelMatrix.translate(0.6, -0.4, 0); // leftright, updown, frontback
	pushMatrix(modelMatrix);
	drawNuggets(gl, nuggetStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
	//drawbendable(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  //===========================================================
  // -- Draw right vertical nugget
  pushMatrix(modelMatrix);
	modelMatrix.translate(0.8, 0, 0); // leftright, updown, frontback
	modelMatrix.rotate(90, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	drawNuggets(gl, nuggetStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
	//drawbendable(gl, platformStart/floatsPerVertex, modelMatrix, u_ModelMatrix, currentAngle)
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  
  

  //===========================================================
  // -- Draw Star
  pushMatrix(modelMatrix);
    modelMatrix.translate(1.3, 1.55, 0);
  	modelMatrix.scale(0.15, 0.15, 0.15);
	  modelMatrix.translate(0, 0, 2.65);
  	// draw the actual hourglasses
  	//modelMatrix.rotate(180, 1, 0, 0);
	quatMatrix.setFromQuat(qTot.x, qTot.y, qTot.z, qTot.w);	// Quaternion-->Matrix
	modelMatrix.concat(quatMatrix);	// apply that matrix.
	pushMatrix(modelMatrix);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  	gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex, 60);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
//===========================================================
  // -- Draw Right Star
  pushMatrix(modelMatrix);
  	// draw the actual hourglasses
	modelMatrix.translate(-4.5, 0, 0);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  	gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex, 60);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
//===========================================================
  // -- Draw Left Star
  pushMatrix(modelMatrix);
  	// draw the actual hourglasses
	modelMatrix.translate(4.5, 0, 0);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
  	gl.drawArrays(gl.TRIANGLES, starStart/floatsPerVertex, 60);
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.
  modelMatrix = popMatrix();  // RESTORE 'world' drawing coords.

//   //===========================================================
}




function drawplatform(gl, start, modelMatrix, u_ModelMatrix, currentAngle) {
	//-------Draw Hexagonal platform bottom and railings
	//g_modelMatrix.rotate(g_angle01, -1, 0, -1); 
	pushMatrix(modelMatrix);

	modelMatrix.scale(5, 0.3, 5);
	modelMatrix.rotate(-currentAngle, 0, 1, 0); 
	pushMatrix(modelMatrix);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	modelMatrix.translate(0, 3, 0);
	modelMatrix.scale(0.5, 1, 0.5);
	modelMatrix.rotate(-currentAngle, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);


	var c60 = Math.sqrt(3);

	// First railing
	modelMatrix = popMatrix();
	pushMatrix(modelMatrix);
	modelMatrix.translate(1.9, 7.0, 0.0);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// Second railing
	modelMatrix = popMatrix();
	pushMatrix(modelMatrix);
	modelMatrix.translate(-1.9, 7.0, 0.0);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// Third railing
	modelMatrix = popMatrix();
	pushMatrix(modelMatrix);
	modelMatrix.translate(-0.9, 7.0, c60-0.1);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// Fourth railing
	modelMatrix = popMatrix();
	pushMatrix(modelMatrix);
	modelMatrix.translate(0.9, 7.0, c60-0.1);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// Fifth railing
	modelMatrix = popMatrix();
	pushMatrix(modelMatrix);
	modelMatrix.translate(-0.9, 7.0, -c60+0.1);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// Sixth railing
	modelMatrix = popMatrix();
	modelMatrix.translate(0.9, 7.0, -c60+0.1);
	modelMatrix.scale(0.05, 2.5, 0.05);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);


	// -------Draw Hexagonal stand
	modelMatrix = popMatrix();
	modelMatrix.translate(0.0, 7*0.3, 0.0);
	pushMatrix(modelMatrix);
	modelMatrix.scale(1.4, 1, 1.4);
	modelMatrix.rotate(currentAngle, 0, 1, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start, 72);

	// -------Draw Hourglass
	modelMatrix = popMatrix();
	modelMatrix.translate(0.0, 7, 0.0)
	modelMatrix.rotate(-currentAngle, 0, 1, 0);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start + 72, 36);
}


function drawbendable(gl, start, modelMatrix, u_ModelMatrix, currentAngle) {

	gl.drawArrays(gl.TRIANGLES, start + 72, 36);

	modelMatrix.translate(0, 6, 0);
	modelMatrix.rotate(g_angle02, 0, 0, 1);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start + 72, 36);

	modelMatrix.translate(0, 6, 0);
	modelMatrix.rotate(g_angle02, 0, 0, 1);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start + 72, 36);

	modelMatrix.translate(0, 6, 0);
	modelMatrix.rotate(g_angle02, 0, 0, 1);
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLES, start + 72, 36);
    
	//--------Draw Spinning Sphere
    modelMatrix.translate(0, 9.7, 0);
    modelMatrix.scale(4, 4, 4);
	modelMatrix.rotate(90, 1, 0, 0);
	modelMatrix.rotate(currentAngle, 0, 0, 1);
  	// Drawing:		
  	// Pass our current matrix to the vertex shaders:
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    		// Draw just the sphere's vertices
    gl.drawArrays(gl.TRIANGLE_STRIP,				// use this drawing primitive, and
    							sphStart/floatsPerVertex,	// start at this vertex number, and 
    							sphVerts.length/floatsPerVertex);	// draw this many vertices.

}

function drawNuggets(gl, start, modelMatrix, u_ModelMatrix, currentAngle) {

  	modelMatrix.scale(0.2, 0.2, 0.2);				// Make it smaller.
	modelMatrix.translate(0, 3, 0);
  	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);
	pushMatrix(modelMatrix);

	modelMatrix.translate(-1, -1, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);

	modelMatrix.translate(-1, -1, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);

	modelMatrix = popMatrix();
	//pushMatrix(modelMatrix);
	modelMatrix.translate(1, -1, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);

	modelMatrix.translate(1, -1, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);

	modelMatrix.translate(-2, 0, 0); 
	gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
	gl.drawArrays(gl.TRIANGLE_STRIP, start, 12);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 12, 4);
	gl.drawArrays(gl.TRIANGLE_STRIP, start + 16, 4);
	gl.drawArrays(gl.TRIANGLES, start + 20, 6);
}



// Last time that this function was called:  (used for animation timing)
var g_last = Date.now();

function animate(angle) {
//==============================================================================
  // Calculate the elapsed time
  var now = Date.now();
  var elapsed = now - g_last;
  g_last = now;    
  // Update the current rotation angle (adjusted by the elapsed time)
  //  limit the angle to move smoothly between +20 and -85 degrees:
//  if(angle >  120.0 && ANGLE_STEP > 0) ANGLE_STEP = -ANGLE_STEP;
//  if(angle < -120.0 && ANGLE_STEP < 0) ANGLE_STEP = -ANGLE_STEP;
  
  //var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
  var g_angle01 = angle + (g_angle01Rate * elapsed) / 1000.0;
  if(g_angle01 > 180.0) g_angle01 = g_angle01 - 360.0;
  if(g_angle01 <-180.0) g_angle01 = g_angle01 + 360.0;

  g_angle02 = g_angle02 + (g_angle02Rate * elapsed) / 1000.0;
  if(g_angle02 > 180.0) g_angle02 = g_angle02 - 360.0;
  if(g_angle02 <-180.0) g_angle02 = g_angle02 + 360.0;
  
  if(g_angle02 > 20.0 && g_angle02Rate > 0) g_angle02Rate *= -1.0;
  if(g_angle02 < 0.0  && g_angle02Rate < 0) g_angle02Rate *= -1.0;

  g_angle03 = g_angle03 + (g_angle03Rate * elapsed) / 1000.0;
  if(g_angle03 > 180.0) g_angle03 = g_angle03 - 360.0;
  if(g_angle03 <-180.0) g_angle03 = g_angle03 + 360.0;
  
  if(g_angle03 > 40.0 && g_angle03Rate > 0) g_angle03Rate *= -1.0;
  if(g_angle03 < 0.0  && g_angle03Rate < 0) g_angle03Rate *= -1.0;

  //return newAngle %= 360;
  return g_angle01;
}

//==================HTML Button Callbacks
function nextShape() {
	shapeNum += 1;
	if(shapeNum >= shapeMax) shapeNum = 0;
}

function spinDown() {
	g_angle01Rate -= 25; 
}

function spinUp() {
	g_angle01Rate += 25; 
}

function runStop() {
	if(g_angle01Rate * g_angle01Rate > 1) {
    	myTmp = g_angle01Rate;
    	g_angle01Rate = 0;
  	}
  	else {
  		g_angle01Rate = myTmp;
  	}
}

function camLeft() {
	var x_distance = cam_x - foc_x;
	var y_distance = cam_y - foc_y;
	var radius = Math.sqrt(x_distance ** 2 + y_distance ** 2)
	cam_x += 0.1 * y_distance / radius;
	cam_y -= 0.1 * x_distance / radius;
	foc_x += 0.1 * y_distance / radius;
	foc_y -= 0.1 * x_distance / radius;
}

function camRight() {
	var x_distance = cam_x - foc_x;
	var y_distance = cam_y - foc_y;
	var radius = Math.sqrt(x_distance ** 2 + y_distance ** 2)
	cam_x -= 0.1 * y_distance / radius;
	cam_y += 0.1 * x_distance / radius;
	foc_x -= 0.1 * y_distance / radius;
	foc_y += 0.1 * x_distance / radius;
}

function camZoom() {
	cam_x -= 0.1 * (cam_x - foc_x);
	cam_y -= 0.1 * (cam_y - foc_y);
	cam_z -= 0.1 * (cam_z - foc_z);
	foc_x -= 0.1 * (cam_x - foc_x);
	foc_y -= 0.1 * (cam_y - foc_y);
	foc_z -= 0.1 * (cam_z - foc_z);
}

function camUnZoom() {
	cam_x += 0.1 * (cam_x - foc_x);
	cam_y += 0.1 * (cam_y - foc_y);
	cam_z += 0.1 * (cam_z - foc_z);
	foc_x += 0.1 * (cam_x - foc_x);
	foc_y += 0.1 * (cam_y - foc_y);
	foc_z += 0.1 * (cam_z - foc_z);
}

function panUp() {
	foc_z += 0.05;
}

function panDown() {
	foc_z -= 0.05;
}

function panLeft() {
	var x_distance = cam_x - foc_x;
	var y_distance = cam_y - foc_y;
	var radius = Math.sqrt(x_distance ** 2 + y_distance ** 2)
	angle_between += 0.1;
	//console.log(angle_between)
    foc_x = cam_x - radius * Math.cos(angle_between);
	foc_y = cam_y - radius * Math.sin(angle_between);
}

function panRight() {
	var x_distance = cam_x - foc_x;
	var y_distance = cam_y - foc_y;
	var radius = Math.sqrt(x_distance ** 2 + y_distance ** 2)
	angle_between -= 0.1;
	//console.log(angle_between)
    foc_x = cam_x - radius * Math.cos(angle_between);
	foc_y = cam_y - radius * Math.sin(angle_between);
}

function myKeyDown(kev) {
	  console.log(  "--kev.code:",    kev.code,   "\t\t--kev.key:",     kev.key, 
				  "\n--kev.ctrlKey:", kev.ctrlKey,  "\t--kev.shiftKey:",kev.shiftKey,
				  "\n--kev.altKey:",  kev.altKey,   "\t--kev.metaKey:", kev.metaKey);
	 
		switch(kev.code) {
			case "KeyP":
				console.log("Pause/unPause!\n");                // print on console,
				runStop();
				break;
			case "KeyC":
				console.log("Clear\n");                // print on console,
				//clearDrag();
				break;
			//------------------WASD navigation-----------------
			case "KeyA":
				console.log("a/A key: Strafe LEFT!\n");
				camLeft();
				break;
			case "KeyD":
				console.log("d/D key: Strafe RIGHT!\n");
				camRight();
				break;
			case "KeyS":
				console.log("s/S key: Move BACK!\n");
				camUnZoom();
				break;
			case "KeyW":
				console.log("w/W key: Move FWD!\n");
				camZoom();
				break;
			
			case "KeyF":
				console.log("f/F key: Pan LEFT!\n");
				panLeft();
				break;
			case "KeyH":
				console.log("h/H key: Pan RIGHT!\n");
				panRight();
				break;
			case "KeyG":
				console.log("g/G key: Pan DOWN!\n");
				panDown();
				break;
			case "KeyT":
				console.log("t/T key: Pan UP!\n");
				panUp();
				break;


			
			//----------------Arrow keys------------------------
			case "ArrowLeft": 	
				console.log(' left-arrow.');
				//spinDown();
				break;
			case "ArrowRight":
				console.log('right-arrow.');
				//spinUp();
			  break;
			case "ArrowUp":		
				console.log('   up-arrow.');
				break;
			case "ArrowDown":
				console.log(' down-arrow.');
			  break;	
		default:
		  console.log("UNUSED!");
		  break;
	}
}
	
function myKeyUp(kev) {
//===============================================================================
// Called when user releases ANY key on the keyboard; captures scancodes well
	console.log('myKeyUp()--keyCode='+kev.keyCode+' released.');
}

//===================Mouse and Keyboard event-handling Callbacks

function myMouseDown(ev, gl, canvas) {
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
		
	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
							(canvas.width/2);			// normalize canvas to -1 <= x < +1,
    var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							(canvas.height/2);
	isDrag = true;											// set our mouse-dragging flag
    xMclik = x;													// record where mouse-dragging began
	yMclik = y;
};
	
	
function myMouseMove(ev, gl, canvas) {
	if(isDrag==false) return;				// IGNORE all mouse-moves except 'dragging'
	
	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
    var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseMove(pixel coords): xp,yp=\t',xp,',\t',yp);
	  
	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
							(canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							(canvas.height/2);
	
	// find how far we dragged the mouse:
	xMdragTot += x - xMclik;					// Accumulate change-in-mouse-position,&
	yMdragTot += y - yMclik;
	// AND use any mouse-dragging we found to update quaternions qNew and qTot.
	dragQuat(x - xMclik, y - yMclik);
		
	xMclik = x;													// Make NEXT drag-measurement from here.
	yMclik = y;
};


function myMouseUp(ev, gl, canvas) {
	// Create right-handed 'pixel' coords with origin at WebGL canvas LOWER left;
	var rect = ev.target.getBoundingClientRect();	// get canvas corners in pixels
	var xp = ev.clientX - rect.left;									// x==0 at canvas left edge
	var yp = canvas.height - (ev.clientY - rect.top);	// y==0 at canvas bottom edge
	//  console.log('myMouseUp  (pixel coords): xp,yp=\t',xp,',\t',yp);
	  
	// Convert to Canonical View Volume (CVV) coordinates too:
	var x = (xp - canvas.width/2)  / 		// move origin to center of canvas and
							(canvas.width/2);			// normalize canvas to -1 <= x < +1,
	var y = (yp - canvas.height/2) /		//										 -1 <= y < +1.
							(canvas.height/2);
	//	console.log('myMouseUp  (CVV coords  ):  x, y=\t',x,',\t',y);
		
	isDrag = false;											// CLEAR our mouse-dragging flag, and
	// accumulate any final bit of mouse-dragging we did:
	xMdragTot += (x - xMclik);
	yMdragTot += (y - yMclik);
	//	console.log('myMouseUp: xMdragTot,yMdragTot =',xMdragTot,',\t',yMdragTot);
	
	// AND use any mouse-dragging we found to update quaternions qNew and qTot;
	dragQuat(x - xMclik, y - yMclik);
};
	

function dragQuat(xdrag, ydrag) {
	var res = 5;
	var qTmp = new Quaternion(0,0,0,1);
		
	var dist = Math.sqrt(xdrag*xdrag + ydrag*ydrag);
		// console.log('xdrag,ydrag=',xdrag.toFixed(5),ydrag.toFixed(5),'dist=',dist.toFixed(5));
		//qNew.setFromAxisAngle(-ydrag + 0.0001, xdrag + 0.0001, 0.0, dist*150.0);
	qNew.setFromAxisAngle(Math.sin(angle_between) * ydrag + 0.0001, 
						  -Math.cos(angle_between) * ydrag + 0.0001,
						  xdrag + 0.0001, 
						  dist*100.0);
								
	qTmp.multiply(qNew,qTot);			// apply new rotation to current rotation. 

	qTot.copy(qTmp);
};
 