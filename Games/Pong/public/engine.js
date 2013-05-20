/**
 * Request animation frame-time cross-browser
 */
window.requestAnimFrame = ( function() {
	return  window.requestAnimationFrame	||
	window.webkitRequestAnimationFrame		||
	window.mozRequestAnimationFrame			||
	window.oRequestAnimationFram			||
	window.msRequestAnimationFrame			||
	function( callback ){
		window.setTimeout(callback, 1000 / 60);
	};
}) ();


var Engine = {

	debug : null,
	mouse : null,
	canvas : null,
	ctx : null,
	mouse : null,
	aspect_ratio : 10/16,

	init : function init (canvasID, debugID) {

		this.debug = new Debug(canvasID, debugID);
		new Draggable(debugID);

		this.mouse = new MouseTracking(canvasID);

		this.canvas = document.getElementById(canvasID);
		this.ctx = Engine.canvas.getContext('2d');

		Canvas.init(canvasID);

		window.addEventListener('resize', this.resizeView, false);
		window.addEventListener('orientationchange', this.resizeView, false);

		this.resizeView();
	},

	update : function update() {
		this.debug.update();
	},

	resizeView : function resizeView() {
		var gameArea = document.getElementById('gameArea');
		var ratio = 3 / 4
		var newWidth = window.innerWidth;
		var newHeight = window.innerHeight;
		var newWidthToHeight = newWidth / newHeight;

		if (newWidthToHeight > ratio) {
			newWidth = newHeight * ratio;
			gameArea.style.height = newHeight + 'px';
			gameArea.style.width = newWidth + 'px';
		} else {
			newHeight = newWidth / ratio;
			gameArea.style.width = newWidth + 'px';
			gameArea.style.height = newHeight + 'px';
		}

		gameArea.style.marginTop = (-newHeight / 2) + 'px';
		gameArea.style.marginLeft = (-newWidth / 2) + 'px';

		// TODO AWESOME IMPOSSIBLE BUG
//		var gameCanvas = document.getElementById('gameCanvas');
//		gameCanvas.width = newWidth;
//		gameCanvas.height = newHeight;

	}

}


var Resources = {

	to_load: 3,
	images: {},

	newResourceLoaded : function newResourceLoaded() {

		this.to_load--;
		if (this.to_load == 0) {
			//Game.init();
			//Game.renderLoop();
			Game.connectMultiplayer();
		}
	},

	loadImage : function loadImage(localURL, obj_name) {
		var imageObj = new Image();

		imageObj.onload = function() {
			Resources["images"][obj_name] = this;
			Resources.newResourceLoaded();
		};

		imageObj.src = localURL;
	},
};


function MouseTracking(elementID) {

	var elem = document.getElementById(elementID);

	var mouseX = 0;
	var mouseY = 0;
	var state = 0;

	// TODO resize will cause bugs for offset
	var offsetX = elem.offsetLeft;
	var offsetY = elem.offsetTop;

	function mouseMove(e) {
		mouseX = e.pageX - offsetX;
		mouseY = e.pageY - offsetY;
	};

	function mouseDown(e) {
		state = 1;
	};

	function mouseUp() {
		state = 0;
	};

	elem.addEventListener('mousemove', mouseMove);
	elem.addEventListener('mousedown', mouseDown);
	elem.addEventListener('mouseup', mouseUp);

	return {
		getPosX : function () { return mouseX },
		getPosY : function () { return mouseY },
		getPos : function () {
			return {
				x : mouseX,
				y : mouseY,
			}
		}
	}
}


// TODO mouse OBJECT should be passed here

function Debug(canvasID, debugElementID) {

	// Debug Info Settings
	var showFPS = true;
	var fps_report_interval = 100;
	var fps_filter_strength = 10;

	// Mouse info
	var mouse_tracking = true;

	var debug_prefix = "dbg_";

	// Canvas Element
	var canvas = document.getElementById(canvasID);
	var ctx = canvas.getContext('2d');
	var out = {};

	// FPS counting
	var frame_time = 0;
	var	last_loop = new Date;
	var this_loop;

	// INIT
	if (showFPS === true)
		setInterval(reportFPS, fps_report_interval);

	out.fps = document.getElementById( debug_prefix + 'fps');
	out.mouse = document.getElementById( debug_prefix + 'mouse');


	function update() {

		// FPS counting
		this_loop = new Date;
		var frame_interval = this_loop - last_loop;
		frame_time += (frame_interval - frame_time) / fps_filter_strength;
		last_loop = this_loop;

		// mouse moves
		reportMouse();
	}

	function reportFPS() {
		out.fps.textContent = (1000/frame_time).toFixed(1) + " fps";
	}

	function reportMouse() {
		out.mouse.textContent = "x: " + Engine.mouse.getPosX() +
								" y : " + Engine.mouse.getPosY();
	}

	return {
		update : update
	}

};