var cnv = null;
var ctx = null;
var debug;
var mouse;

window.addEventListener("load", documentLoad);

function documentLoad (e) {
	cnv = document.getElementById("pong");
	ctx = cnv.getContext('2d');
	Canvas.initFirst();
};


var Resources = {

	to_load: 1,
	images: {},

	newResourceLoaded : function newResourceLoaded() {

		this.to_load--;

		console.log(Resources["images"]["brick"]);

		// TODO loading screen
		if (this.to_load == 0)
			Canvas.start();

	},

	loadImage : function loadImage(localURL, obj_name) {
		var imageObj = new Image();

		imageObj.onload = function() {
			Resources["images"][obj_name] = this;
			Resources.newResourceLoaded();
		};
		imageObj.src = localURL;
	}
};


//  layer with setTimeout fallback
window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame	||
	window.webkitRequestAnimationFrame		||
	window.mozRequestAnimationFrame			||
	window.oRequestAnimationFram			||
	window.msRequestAnimationFrame			||
	function( callback ){
		window.setTimeout(callback, 1000 / 60);
	};
})();



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

		reportMouse();
	}

	function reportFPS() {
		out.fps.textContent = (1000/frame_time).toFixed(1) + " fps";
	}

	function reportMouse() {
		out.mouse.textContent = "x: " + mouse.getPosX() +
								"y: " + mouse.getPosY();
	}

	return {
		update : update
	}

};


function Element(X, Y) {
	this.X = X;
	this.Y = Y;
	this.size = 10; // trebuie schimbat in radius
	this.width = 10;
	this.height = 10;

	this.speedX = 5;
	this.speedY = -5;
	this.dir = 0;
	this.color = "red";
	this.draw = true;

	this.setSize = function (width, height) {
		this.width = width;
		this.height = height;
	}

	this.setColor = function (color) {
		this.color = color;
	}

	this.setSpped = function (speed) {
		this.speedX = speed;
		this.speedY = speed;
	}

	this.colision = function (ball) {

		if(ball.X >= this.X  &&  ball.X <= this.X + this.width ) {
			if( ball.size >= Math.abs(this.Y - ball.Y) ||  ball.size >= Math.abs(this.Y - ball.Y + this.height) ) {
				// up and down
				ball.speedY *=-1;
				this.draw = false;
			}
		}

		if(ball.Y >= this.Y &&  ball.Y <= this.Y + this.height ) {
			if( ball.size >= Math.abs(this.X - ball.X) ||  ball.size >= Math.abs(this.X - ball.X + this.width) ) {
				//left and right
				ball.speedX *=-1;
				this.draw = false;
			}
		}
	}
}


var Game = {
	ball : null,
	bar : null,
	bricks : null,
	levelNo : 0,
}


var Canvas = {

	sizeX : 480,
	sizeY : 800,
	mouse : null,
	startgame : 0,
	gameover : 0,
	bricksLeft : 0,
	defaultSpeed : 1,


	initFirst : function initFirst() {

		debug = new Debug("pong", "debug");
		mouse = new MouseTracking("pong");

		Resources.loadImage("./images/brick.png", "brick");

	},

	start : function start() {

		cnv.removeEventListener('mousedown', Canvas.start);
		Canvas.gameover = 0;

		Game.bar = new Element(cnv.width/2 - 50, cnv.height-100);
		Game.bar.setSize(100, 20);
		Game.bar.speedX = 10;
		Game.ball = new Element(cnv.width/2-5, Game.bar.Y-2);
		Game.bricks = new Array();
		Canvas.bricksLeft = 0;

		for(k=0, i = 100; i<400; i+=25) {
			for(j = 20;  j<460; j+=55, k++) {

				Game.bricks[k] = new Element(j,i);
				Game.bricks[k].setSize(50,20);

				if (Levels.level[Game.levelNo][k] == 0)
					Game.bricks[k].draw = false;
				else
					Canvas.bricksLeft ++;
			}
		}

		Canvas.draw();

		writeMessage(cnv,"Click to start the Game");
		cnv.addEventListener('mousedown', Canvas.startInit, false);

	},

	startInit : function startInit() {
		Canvas.init();
		cnv.removeEventListener('mousedown', Canvas.startInit);
	},

	init : function () {
		this.addMouseDir();
		this.listenInput();

		function render() {
			if (Canvas.gameover == 0 && Canvas.bricksLeft != 0) {
				requestAnimFrame(render);
				Canvas.draw();
			}

			else {
				if (Canvas.gameover == 1)
					writeMessage(cnv, "Game Over");

				if (Canvas.bricksLeft == 0) {
					if (Game.levelNo < Levels.level.length - 1 ) {
						writeMessage(cnv, "Click for the next Level");
						Game.levelNo++;
					}
					else {
						writeMessage(cnv, "You've finished the game!");
						Game.levelNo = 0;
					}
				}
				cnv.addEventListener('mousedown', Canvas.start, false);
			}
		}

		render();
	},


	draw : function draw() {
		debug.update();
		ctx.clearRect(0, 0, 480, 800);
		this.animateBall(Game.ball);
		this.animateBar(Game.bar);
		this.drawBricks(Game.bricks,Game.ball);
	},

	drawBricks: function drawBricks(bricks, ball) {
		for(i = 0;i<bricks.length;i++) {
			if(bricks[i].draw == true) {
				bricks[i].colision(ball);
				if(bricks[i].draw == true) {
					ctx.drawImage(Resources["images"]["brick"], 0, 0, 128, 64, bricks[i].X, bricks[i].Y, bricks[i].width,bricks[i].height);

				}
			}
		}
	},

	animateBar : function animateBar(bar) {
		if (bar.X + bar.dir < 0 || (bar.X + bar.dir + bar.width) > cnv.width)
			return;

		bar.X += bar.dir;
		ctx.fillRect(bar.X, bar.Y, 100, 20);
	},

	animateBall : function animateBall(ball) {
		if ( (ball.X + ball.size) >= this.sizeX || ball.X <= ball.size)
			ball.speedX = (-1) * ball.speedX;

		if ( (ball.Y + ball.size) >= this.sizeY || ball.Y <= ball.size)
			ball.speedY = (-1) * ball.speedY;

		if ( ball.Y + ball.size >= Game.bar.Y) {

		if (ball.X >= Game.bar.X - ball.size - 5 && ball.X <= Game.bar.X + Game.bar.width + ball.size + 5) {
			var aux = Math.abs(Game.bar.X - ball.X + (10 + 2 * ball.size + Game.bar.width)/2)/((10 + 2 * ball.size + Game.bar.width)/2);
			ball.speedY = -1 * ( -8 * aux * aux+ aux +8);
		}
		else
			Canvas.gameover = 1;
		}


		ball.X += ball.speedX;
		ball.Y += ball.speedY;

		ctx.beginPath();
		ctx.arc(ball.X, ball.Y, ball.size, 0, Math.PI*2, true);
		ctx.closePath();
		ctx.fill();
	},

	addMouseDir : function addMouseDir() {

		cnv.addEventListener('mousedown', function(evt){
			this.mouse = mouse.getPos();
			if (this.mouse.x <= Game.bar.X + Game.bar.width / 2)
				Game.bar.dir = -Game.bar.speedX;
			else
				Game.bar.dir = Game.bar.speedX;
		}, false);

		cnv.addEventListener('mouseup', function(evt){
			Game.bar.dir = 0;
		}, false);


		cnv.addEventListener('touchstart', function(evt){
			writeMessage(cnv, evt.clientX);
			if (evt.clientX <= 481)
				Game.bar.dir = -Game.bar.speedX;
			else
				Game.bar.dir = Game.bar.speedX;
		}, false);

		cnv.addEventListener('touchend', function(evt) {
				Game.bar.dir = 0;
		}, false);
	},

	listenInput : function listenInput() {
		var code;
		document.addEventListener("keydown", function(e) {
			code = e.keyCode;
	
			if(code == 37)
				Game.bar.dir = -Game.bar.speedX;
			if(code == 39)
				Game.bar.dir = Game.bar.speedX;
		});
	
		document.addEventListener("keyup", function(e) {
			code = e.keyCode;
			if(code == 37 || code == 39 && Game.bar.dir)
				Game.bar.dir = 0;
		});
	}
}


function writeMessage(canvas, message) {
	var context = canvas.getContext('2d');
	context.fillStyle = "rgba(255, 255, 255, 0.7)"; ;
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.font = '30pt Calibri';
	context.textAlign = 'center'
	context.fillStyle = 'black';
	context.fillText(message, canvas.width/2, canvas.height/2 + 50);
}

function MouseTracking(elementID) {

	var elem = document.getElementById(elementID);

	var mouseX;
	var mouseY;

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