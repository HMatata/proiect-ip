window.addEventListener("load", loadEngine);
var socket;
var statsPanel;


function loadEngine (e) {

	Game.loadResource();
	Engine.init("gameCanvas", "debug");
	Game.waitStart();

	statsPanel = document.getElementById("statsPanel");
};


var Game = {
	players : [],
	playerID : -1,
	ball : null,
	field : null,
	left_key : 0,
	right_key : 0,
	dirx : 0.7,
	diry : 0.8,
	increment : 0.000025,
	syncdata : {},
	status : -1
}

Game.loadResource = function loadResource() {
	Resources.loadImage("./images/brick.png", "brick");
	Resources.loadImage("./images/ball.png", "ball");
	Resources.loadImage("./images/grass.jpg", "grass");
}

Game.connectMultiplayer = function connectMultiplayer() {
	socket = io.connect('127.0.0.1:8080');

	socket.on('init', function (data) {
		statsPanel.textContent = "players on the server: " + data.playerss;
	});

	// sendInformationToServer ...
	socket.on('initGame', function (data) {
		Game.playerID = 0;
		Game.sendSyncData("player1Sync");
	});

	socket.on('syncGame', function(data){
		Game.playerID = 1;
		Game.sendSyncData("player2Sync");
	});

	socket.on('startGame', function(data) {
		console.log("RECEIVED ON ", Game.playerID);
		Game.renderLoop();
	});

	socket.on('sync', Game.reciveSyncData);

	Game.init();
	Game.drawFrame();
	Canvas.setBackground();
	Canvas.writeMessage("Wait for another player to connect", 0.5, 0.5);

}

Game.init = function init() {

	this.dirx = 0.01 + Math.random();
	if (Math.random() < 0.5)
		this.dirx *= -1;

	this.ball = new GameObj("ball", 64, 64);
	this.ball.y = 0.25;
	this.ball.scaleX = 0.5;
	this.ball.scaleY = 0.5;

	this.players[0] = new GameObj("brick", 512, 40);
	this.players[0].scaleX = 0.3;
	this.players[0].scaleY = 0.5;
	this.players[0].y = 0.9;

	this.players[1] = new GameObj("brick", 512, 40);
	this.players[1].scaleX = 0.3;
	this.players[1].scaleY = 0.5;
	this.players[1].y = 0.1;

	this.field = new GameObj("grass", 30, 30);

	this.listenInput();
}

Game.sendSyncData = function sendSyncData(name) {
	Game.syncdata.pos = Game.players[Game.playerID].x;
	Game.syncdata.id = Game.playerID;
	socket.emit(name, Game.syncdata);
}

Game.reciveSyncData = function reciveSyncData(data) {
	Game.ball.x = data.ball.x;
	Game.ball.y = data.ball.y;
	Game.players[1 - Game.playerID].x = data.players[1 - Game.playerID].pos;
	Game.status = data.status;
}

Game.waitStart = function waitStart() {
	Canvas.cleanViewport();
	Canvas.writeMessage("Loading Resources", 0.5, 0.5);
}

Game.renderLoop = function renderLoop() {

	console.log(Game.status);

	if(Game.status == -1)
		requestAnimFrame(Game.renderLoop);

	Engine.update();
	Canvas.cleanViewport();
	Game.updatePlayer();
	Game.sendSyncData("sync");
	Game.drawFrame();

	if (Game.status > -1) {
		Canvas.setBackground();

		if (Game.status != Game.playerID)
			Canvas.writeMessage("YOU WIN", 0.5, 0.5);
		else
			Canvas.writeMessage("YOU LOSE", 0.5, 0.5);
	}
}

Game.updatePlayer = function updatePlayer() {
	var id = Game.playerID;
	var reverse = (id == 1) ? -1 : 1;
	var pos = this.players[id].x -
			reverse * this.players[id].speed * this.left_key +
			reverse * this.players[id].speed * this.right_key;

	if (pos > 0.13 && pos < 0.87)
		this.players[id].x = pos;
}

Game.drawFrame = function drawFrame() {
	Game.field.drawPattern("repeat");
	Game.players[0].draw();
	Game.players[1].draw();
	Game.ball.draw();
}

Game.listenInput = function listenInput() {
	var code;
	document.addEventListener("keydown", function(e) {
		code = e.keyCode;

		if(code == 37)
			Game.left_key = 1;
		if(code == 39)
			Game.right_key = 1;

	});

	document.addEventListener("keyup", function(e) {
		code = e.keyCode;
		if(code == 37)
			Game.left_key = 0;
		if(code == 39)
			Game.right_key = 0;
	});
}

/******************************************************************************/
/******************************************************************************/

function GameObj(sprite, width, height) {
	this.x = 0.5;
	this.y = 0.5;
	this.radius = (width + height) / 2;

	this.width = width;
	this.height = height;

	this.scaleX = 1;
	this.scaleY = 1;

	this.speed = 0.01;
	this.sprite = Resources["images"][sprite];
}

GameObj.prototype.draw = function draw () {
	var ctx = Canvas.ctx;
	var cnv = Canvas.canvas;
	var posx = (this.x * cnv.width) * 1 / this.scaleX - this.width/2;
	var posy = (this.y * cnv.height) * 1 / this.scaleY - this.height/2;
	var width = this.width * this.scaleX;
	var height = this.height * this.scaleY;

	ctx.save();
	if (Game.playerID == 1) {
		ctx.translate(cnv.width, cnv.height);
		ctx.rotate(-Math.PI);
	}
	ctx.scale(this.scaleX, this.scaleY);
	ctx.drawImage(this.sprite, 0, 0, this.width, this.height,
								posx, posy, this.width, this.height);
	ctx.restore();
}

GameObj.prototype.drawPattern = function drawPattern (direction) {
	var ctx = Canvas.ctx;
	var cnv = Canvas.canvas;
	var ptrn = ctx.createPattern(this.sprite, direction);

	ctx.fillStyle = ptrn;
	ctx.fillRect(0, 0, cnv.width, cnv.height);
}

/******************************************************************************/
/******************************************************************************/

var Canvas = {

	canvas : null,
	ctx : null,
	mouse : null,
	defaultSpeed : 1,

	init : function init (canvasID) {
		this.canvas = document.getElementById(canvasID);
		this.ctx = Engine.ctx;
	},

	cleanViewport : function cleanViewport () {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.width);
	},

	setBackground : function setBackground () {
		this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	},

	writeMessage : function writeMessage(message, posX, posY) {
		this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		this.ctx.font = '16pt Calibri';
		this.ctx.textAlign = 'center'
		this.ctx.fillStyle = 'black';
		this.ctx.fillText(message, posX * this.canvas.width, posY * this.canvas.height);
	},

	update : function () {
		Engine.debug.update();
	},

}
