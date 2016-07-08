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

// for rounding issues
const c0 = 0.000001;

setInterval(updateTanks, 25);

function init(socket, username, color) {
	users[socket.id] = {
		x: 38,
		y: 33,
		width: 30,
		height: 40,
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

function dotProduct(v1, v2) {
	return v1[0] * v2[0] + v1[1] * v2[1];
}

// intersection of line defined by points p1,p2 and p3,p4
function lineIntersection(p1, p2, p3, p4) {
	var denom = (p1[1] - p2[1]) * (p3[0] - p4[0]) - (p1[0] - p2[0]) * (p3[1] - p4[1]);
	if (denom == 0) {
		return null;
	}
	return [((p1[1] * p2[0] - p1[0] * p2[1]) * (p3[0] - p4[0]) - (p1[0] - p2[0]) * (p3[1] * p4[0] - p3[0] * p4[1])) / denom, ((p1[1] * p2[0] - p1[0] * p2[1]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[1] * p4[0] - p3[0] * p4[1])) / denom];
}

// point a between b and c
// c0 is for rounding issues
function between(a, b, c) {
	return ((a[0] >= b[0] - c0 && a[0] <= c[0] + c0) || (a[0] <= b[0] + c0 && a[0] >= c[0] - c0)) && ((a[1] >= b[1] - c0 && a[1] <= c[1] + c0) || (a[1] <= b[1] + c0 && a[1] >= c[1] - c0));
}

// ratio of v1 to v2
// c0 is for rounding issues
function vecRatio(v1, v2) {
	if (Math.abs(v2[0]) < c0) {
		return v1[1] / v2[1];
	}
	return v1[0] / v2[0];
}

// translation is too much
function validMove(t) {
	return (Math.abs(t[0]) <= speed) && (Math.abs(t[1]) <= speed);
}

// checks if coords are located at wall
function isWall(y, x) {
	if (x <= -1 || y <= -1 || x >= mazeDimensions[1] || y >= mazeDimensions[0]) {
		return false;
	}
	if (y % 1 != 0) {
		if (y > 0) {
			return maze[y-0.5][x].bottom;
		}
		return maze[y+0.5][x].top;
	}
	else {
		if (x > 0) {
			return maze[y][x-0.5].right;
		}
		return maze[y][x+0.5].left;
	}
}

// returns point for vertices of wall in order
function wallPoints(y, x) {
	if (y % 1 != 0) {
		return [[(y+0.5) * (cellHeight + wallWidth), x * (cellWidth + wallWidth)],
			[(y+0.5) * (cellHeight + wallWidth) + wallWidth, x * (cellWidth + wallWidth)],
			[(y+0.5) * (cellHeight + wallWidth) + wallWidth, x * (cellWidth + wallWidth) + cellWidth + 2 * wallWidth],
			[(y+0.5) * (cellHeight + wallWidth), x * (cellWidth + wallWidth) + cellWidth + 2 * wallWidth]];
	}
	else {
		return [[y * (cellHeight + wallWidth), (x+0.5) * (cellWidth + wallWidth)],
			[y * (cellHeight + wallWidth) + cellHeight + 2 * wallWidth, (x+0.5) * (cellWidth + wallWidth)],
			[y * (cellHeight + wallWidth) + cellHeight + 2 * wallWidth, (x+0.5) * (cellWidth + wallWidth) + wallWidth],
			[y * (cellHeight + wallWidth), (x+0.5) * (cellWidth + wallWidth) + wallWidth]];
	}
}

// returns lines containing wall, lines in the form of [0] = x/y, x/y = [1], y/x = [[2], [3]]
function wallLines(y, x) {
	var p = wallPoints(y, x);
	return [[p[0], p[1]],
		[p[1], p[2]],
		[p[2], p[3]],
		[p[3], p[0]]];
}

// return transformation that needs to be applied to tank
function shiftTank(user, dy, dx) {
	// variables used to compute location of points on rectangle
	var vAngle = Math.atan(users[user].width / users[user].height);
	var vDist = Math.sqrt(users[user].width * users[user].width + users[user].height * users[user].height) / 2;
	// points on tank for checking collision (in the form (y, x))
	var points = [[Math.sin(users[user].angle + vAngle) * vDist + users[user].y, Math.cos(users[user].angle + vAngle) * vDist + users[user].x],
		[Math.sin(users[user].angle - vAngle + Math.PI) * vDist + users[user].y, Math.cos(users[user].angle - vAngle + Math.PI) * vDist + users[user].x],
		[Math.sin(users[user].angle + vAngle + Math.PI) * vDist + users[user].y, Math.cos(users[user].angle + vAngle + Math.PI) * vDist + users[user].x],
		[Math.sin(users[user].angle - vAngle) * vDist + users[user].y, Math.cos(users[user].angle - vAngle) * vDist + users[user].x]];

	// min/max x/y values to find bounding box around tank
	var minX = 1000000, maxX = -1000000, minY = 1000000, maxY = -1000000;
	for (var i = 0; i < points.length; i++) {
		if (points[i][0] > maxY) {
			maxY = points[i][0];
		}
		if (points[i][0] < minY) {
			minY = points[i][0];
		}
		if (points[i][1] > maxX) {
			maxX = points[i][1];
		}
		if (points[i][1] < minX) {
			minX = points[i][1];
		}
	}

	// get all walls that could overlap tank
	var lWall = Math.ceil((minX - wallWidth) / (cellWidth + wallWidth)) - 0.5;
	var rWall = Math.floor(maxX / (cellWidth + wallWidth)) - 0.5;
	var dWall = Math.ceil((minY - wallWidth) / (cellHeight + wallWidth)) - 0.5;
	var uWall = Math.floor(maxY / (cellHeight + wallWidth)) - 0.5;
	var walls = [];
	for (var i = lWall; i <= rWall; i++) {
		for (var j = dWall - 0.5; j <= uWall + 0.5; j++) {
			if (isWall(j, i)) {
				walls.push([j, i]);
			}
		}
	}
	for (var i = dWall; i <= uWall; i++) {
		for (var j = lWall - 0.5; j <= rWall + 0.5; j++) {
			if (isWall(i, j)) {
				walls.push([i, j]);
			}
		}
	}

	// get final transformation by finding maximum transformation necessary
	var transform, finalTransform = [0, 0], lines, point, dist, tempDist;
	for (var i = 0; i < walls.length; i++) {
		transform = [0, 0];
		lines = wallLines(walls[i][0], walls[i][1]);
		// given a wall, take every point on tank and line on wall and find minimum translation of point on tank such that the point is outside of the wall given direction [dy, dx]
		for (var j = 0; j < points.length; j++) {
			dist = [1000000*dy, 1000000*dx];
			// given a point, find the minimum translation in given direction [dy, dx] for point to be outside of wall
			for (var k = 0; k < 4; k++) {
				point = lineIntersection(points[j], [points[j][0] + dy, points[j][1] + dx], lines[k][0], lines[k][1]);
				if (point == null) {
					continue;
				}
				tempDist = [point[0] - points[j][0], point[1] - points[j][1]];
				console.log('before: ' + tempDist);
				if (point == null || !between(point, lines[k][0], lines[k][1])) {
					continue;
				}
				tempDist = [point[0] - points[j][0], point[1] - points[j][1]];
				console.log('tempDist: ' + tempDist);
				if (vecRatio(tempDist, [dy, dx]) <= vecRatio(dist, [dy, dx]) && vecRatio(tempDist, [dy, dx]) >= 0) {
					dist = tempDist;
				}
			}
			console.log('dist: ' + dist);
			if (dotProduct(dist, dist) > dotProduct(transform, transform) && validMove(dist)) {
				transform = dist;
			}
		}
		console.log('transform: ' + transform);
		if (dotProduct(transform, transform) > dotProduct(finalTransform, finalTransform) && validMove(transform)) {
			finalTransform = transform;
		}
	}
	console.log('final: ' + finalTransform);
	return finalTransform;
}

function updateTankRotation(user) {
	if (users[user].left) {
		users[user].angle -= rotSpeed;
	}
	else if (users[user].right) {
		users[user].angle += rotSpeed;
	}
	else {
		return;
	}
	var t1 = shiftTank(user, Math.cos(users[user].angle), -Math.sin(users[user].angle));
	var t2 = shiftTank(user, -Math.cos(users[user].angle), Math.sin(users[user].angle));
	if (dotProduct(t1, t1) <= dotProduct(t2, t2)) {
		users[user].y += t1[0];
		users[user].x += t1[1];
	}
	else {
		users[user].y += t2[0];
		users[user].x += t2[1];
	}
}

function updateTankMovement(user) {
	var dy, dx;
	if (users[user].up) {
		users[user].x += Math.cos(users[user].angle) * speed;
		users[user].y += Math.sin(users[user].angle) * speed;
		dx = -Math.cos(users[user].angle);
		dy = -Math.sin(users[user].angle);
	}
	else if (users[user].down) {
		users[user].x -= Math.cos(users[user].angle) * speed;
		users[user].y -= Math.sin(users[user].angle) * speed;
		dx = Math.cos(users[user].angle);
		dy = Math.sin(users[user].angle);
	}
	else {
		return;
	}
	var t = shiftTank(user, dy, dx);
	users[user].y += t[0];
	users[user].x += t[1];
}

function updateTank(user) {
	updateTankRotation(user);
	updateTankMovement(user);
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