var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mazeGen = require('./maze');

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

var users = {};
var canvasSize = [700, 1200]; //height and width
var mazeDimensions = [7, 12]; //rows and cols
var maze = mazeGen.generateMaze(mazeDimensions[0], mazeDimensions[1]);
var speed = 4;
var rotSpeed = 5 * Math.PI / 180;
var wallWidth = 8;
var cellWidth = (canvasSize[1] - (mazeDimensions[1] + 1) * wallWidth) / mazeDimensions[1];
var cellHeight = (canvasSize[0] - (mazeDimensions[0] + 1) * wallWidth) / mazeDimensions[0];

setInterval(updateTanks, 25);

function init(socket, username, color) {
	users[socket.id] = {
		x: 38,
		y: 33,
		width: 12,
		height: 16,
		angle: 0,
		left: false,
		right: false,
		up: false,
		down: false,
		color: color,
		randColor: getRandomColor(),
		username: username
	};
	setCanvasSize();
	drawMaze();
	drawTanks();
}

function getRandomColor() {
	var color = '#';
	var chars = '0123456789abcdef';
	for (var i = 0; i < 6; i++) {
		color += chars[Math.floor(Math.random() * 16)];
	}
	return color;
}

function updateTanks() {
	for (var user in users) {
		updateTank(user);
	}
	drawTanks();
}

function drawTanks() {
	io.emit('drawTanks', users);
}

function drawMaze() {
	io.emit('drawMaze', maze, mazeDimensions[0], mazeDimensions[1], wallWidth);
}

function setCanvasSize() {
	io.emit('setCanvasSize', canvasSize);
}

function getCell(point) {
	var cell = [Math.floor((point[0] - wallWidth / 2) / (cellHeight + wallWidth)), Math.floor((point[1] - wallWidth / 2) / (cellWidth + wallWidth))];
	if (cell[0] < 0) {
		cell[0] = 0;
	}
	if (cell[0] >= mazeDimensions[0]) {
		cell[0] = mazeDimensions[0] - 1;
	}
	if (cell[1] < 0) {
		cell[1] = 0;
	}
	if (cell[1] >= mazeDimensions[1]) {
		cell[1] = mazeDimensions[1] - 1;
	}
	return cell;
}

function getWall(point) {
	var cell = getCell(point);
	if (point[0] <= (cellHeight + wallWidth) * cell[0] + wallWidth && maze[cell[0]][cell[1]].top) {
		return [cell[0] - 0.5, cell[1]];
	}
	if (point[0] >= (cellHeight + wallWidth) * (cell[0] + 1) && maze[cell[0]][cell[1]].bottom) {
		return [cell[0] + 0.5, cell[1]];
	}
	if (point[1] <= (cellWidth + wallWidth) * cell[1] + wallWidth && maze[cell[0]][cell[1]].left) {
		return [cell[0], cell[1] - 0.5];
	}
	if (point[1] >= (cellWidth + wallWidth) * (cell[1] + 1) && maze[cell[0]][cell[1]].right) {
		return [cell[0], cell[1] + 0.5];
	}
	return null;
}

function updateTank(user) {
	if (users[user].left) {
		users[user].angle -= rotSpeed;
	}
	if (users[user].right) {
		users[user].angle += rotSpeed;
	}
	if (users[user].up) {
		users[user].x += Math.cos(users[user].angle) * speed;
		users[user].y += Math.sin(users[user].angle) * speed;
	}
	if (users[user].down) {
		users[user].x -= Math.cos(users[user].angle) * speed;
		users[user].y -= Math.sin(users[user].angle) * speed;
	}
	var vAngle = Math.atan(users[user].width / users[user].height);
	var vDist = Math.sqrt(users[user].width * users[user].width + users[user].height * users[user].height) / 2;
	//Add additional points if necessary (in the form (y, x))
	var points = [[Math.sin(users[user].angle + vAngle) * vDist + users[user].y, Math.cos(users[user].angle + vAngle) * vDist + users[user].x],
		[Math.sin(users[user].angle - vAngle) * vDist + users[user].y, Math.cos(users[user].angle - vAngle) * vDist + users[user].x],
		[Math.sin(users[user].angle + vAngle + Math.PI) * vDist + users[user].y, Math.cos(users[user].angle + vAngle + Math.PI) * vDist + users[user].x],
		[Math.sin(users[user].angle - vAngle + Math.PI) * vDist + users[user].y, Math.cos(users[user].angle - vAngle + Math.PI) * vDist + users[user].x]];
	var cell = getCell([users[user].y, users[user].x]);
	var sin = Math.sin(users[user].angle);
	var cos = Math.cos(users[user].angle);
	var finalTransform = [0, 0];
	for (var i = 0; i < points.length; i++) {
		var wall = getWall(points[i]);
		if (wall == null) {
			continue;
		}
		var transform = [0, 0];
		if (wall[0] == cell[0]) {
			if (wall[1] == cell[1] - 0.5) {
				transform[1] = ((cellWidth + wallWidth) * cell[1] + wallWidth) - points[i][1];
				if (cos != 0) {
					transform[0] = transform[1] * (sin / cos > 2 ? 2 : sin / cos);
				}
			}
			else {
				transform[1] = (cellWidth + wallWidth) * (cell[1] + 1) - points[i][1];
				if (cos != 0) {
					transform[0] = transform[1] * (sin / cos > 2 ? 2 : sin / cos);
				}
			}
		}
		else {
			if (wall[0] == cell[0] - 0.5) {
				transform[0] = ((cellHeight + wallWidth) * cell[0] + wallWidth) - points[i][0];
				if (sin != 0) {
					transform[1] = transform[0] * (cos / sin > 2 ? 2 : cos / sin);
				}
			}
			else {
				transform[0] = (cellHeight + wallWidth) * (cell[0] + 1) - points[i][0];
				if (sin != 0) {
					transform[1] = transform[0] * (cos / sin > 2 ? 2 : cos / sin);
				}
			}
		}
		if (Math.abs(transform[0]) > Math.abs(finalTransform[0]) || Math.abs(transform[1]) > Math.abs(finalTransform[1])) {
			finalTransform = transform;
		}
	}
	users[user].y += finalTransform[0];
	users[user].x += finalTransform[1];
}

io.on('connection', function (socket) {
	//Starts game on username submit
	socket.on('addUser', function (username, color) {
		init(socket, username, color);
	});

	//Receiving events
	socket.on('pressLeft', function () {
		users[socket.id].left = true;
		users[socket.id].right = false;
	});
	socket.on('pressRight', function () {
		users[socket.id].right = true;
		users[socket.id].left = false;
	});
	socket.on('pressUp', function () {
		users[socket.id].up = true;
		users[socket.id].down = false;
	});
	socket.on('pressDown', function () {
		users[socket.id].down = true;
		users[socket.id].up = false;
	});
	socket.on('releaseLeft', function () {
		users[socket.id].left = false;
	});
	socket.on('releaseRight', function () {
		users[socket.id].right = false;
	});
	socket.on('releaseUp', function () {
		users[socket.id].up = false;
	});
	socket.on('releaseDown', function () {
		users[socket.id].down = false;
	});

	//Remove tank on disconnect
	socket.on('disconnect', function () {
		delete users[socket.id];
		drawTanks();
	});
});

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

http.listen(server_port, server_ip_address, function () {
	console.log("Listening on " + server_ip_address + ", server_port " + server_port);
});