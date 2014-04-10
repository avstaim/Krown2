function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function Cell(x, y, isFree, color) {
	this.x = x;
	this.y = y;
	this.isFree = isFree;
	this.color = color;
	this.getDebugInfo = function() {
		return "x=" + this.x + "; y="  + this.y + "; isFree=" + this.isFree + "; color=" + this.color;
	};
}

function Field() {
	var WIDTH = 9;
	var HEIGHT = 9;
	var LINE_LENGTH = 5;
	var grid = [];
	var field = this;

	var selected = undefined;

	var lastMovementPoint = undefined;

	var rainbowFlag = false;

	var select = function(point) {
		grid[point.y][point.x].cell.addClass("pulse");
		selected = point;
	};
	var unselect = function() {
		grid[selected.y][selected.x].cell.removeClass("pulse");
		selected = undefined;
		field.update;
	};

	var matches = {
		flag: false,
		map: [],
		count: function() {
			var result = 0;
			this.map.forEach(function(row) { row.forEach(function(element) { if (element) result++; }); });
			return result;
		},
		countNonFree: function() {
			var result = 0;
			for (var y in this.map)
				for (var x in this.map[y])
					if (this.map[y][x] && !grid[y][x].isFree)
						result++;
			return result;
		}
	};

	var elementClicked = function(cellElement) {
		var clicked = { x: parseInt(cellElement.data("x")), 
						y: parseInt(cellElement.data("y")) };

		if (field.getPoint(clicked).isFree) {
			if (selected == undefined) return;
			if (field.getPoint(selected).color == game.colors.special.spectrum_nova) return;
			moveTo(selected, clicked);
		} else {
			if (field.getPoint(clicked).color == game.colors.special.black_hole) {
				if (selected != undefined) unselect();
				blackHole(clicked);
				return;
			}
			if (field.getPoint(clicked).color == game.colors.special.storm) {
				if (selected != undefined) unselect();
				storm(clicked);
				return;
			}
			if (selected != undefined) {
				if (field.getPoint(selected).color == game.colors.special.spectrum_nova) {
					var nova = selected;
					unselect();
					spectrumNova(nova, clicked);
					return;
				}
				if (selected.x == clicked.x && selected.y == clicked.y) {
					unselect();
					return;
				}
				unselect();
			}
			cellElement.addClass("pulse");
			select(clicked);
		}
	};

	var moveTo = function(source, dest) {
		var route = getRoute(source, dest);
		if (route == undefined) {
			game.cantMove();
			return;
		}
		unselect();

		var color = field.getPoint(source).color;
		field.clearPoint(source);
		field.update();

		lastMovementPoint = dest;

		animateRoute(route, color, function() {
			field.setPoint(dest, color);
			field.update();
			if (color == game.colors.special.explosive) {
				explosive(dest);
				return;
			}
			if (color == game.colors.special.line_feed_horizontal) {
				line_feed_horizontal(dest);
				return;
			}
			if (color == game.colors.special.line_feed_vertical) {
				line_feed_vertical(dest);
				return;
			}
			game.endTurn();
		});
	};

	var getRoute = function(source, dest) {
		var routePath = [];
		for (var y in grid) {
			routePath[y] = [];
			for (var x in grid[y]) 
				routePath[y][x] = grid[y][x].isFree ? undefined : -1;
		}
		var points = [];
		points[0] = [source];
		var goWave = function(level) {
			points[level + 1] = [];
			var addPoint = function(x, y) {
				newPoint = {x: x, y: y};
				points[level + 1].push(newPoint);
				routePath[newPoint.y][newPoint.x] = level + 1;
			}; 
			for (var i in points[level]) {
				var x = points[level][i].x;
				var y = points[level][i].y;
				if (x > 0 && routePath[y][x - 1] == undefined) addPoint(x - 1, y);
				if (x < WIDTH - 1 && routePath[y][x + 1] == undefined) addPoint(x + 1, y);
				if (y > 0 && routePath[y - 1][x] == undefined) addPoint(x, y - 1);
				if (y < HEIGHT - 1 && routePath[y + 1][x] == undefined) addPoint(x, y + 1);
			}

			if (points[level + 1].length > 0) goWave(level + 1);
		};
		routePath[source.y][source.x] = 0;
		routePath[dest.y][dest.x] = undefined;
		goWave(0);
		if (routePath[dest.y][dest.x] != undefined && routePath[dest.y][dest.x] > 0) {
			var route = [];
			var x = dest.x;
			var y = dest.y;
			route[routePath[dest.y][dest.x]] = dest;
			for (var level = routePath[dest.y][dest.x]; level > 0; level--) {
				if (x > 0 && routePath[y][x - 1] == level - 1) x--;
				else if (x < WIDTH - 1 && routePath[y][x + 1] == level - 1) x++;
				else if (y > 0 && routePath[y - 1][x] == level - 1) y--;
				else if (y < HEIGHT - 1 && routePath[y + 1][x] == level - 1) y++;
				route[level - 1] = {x: x, y: y};
			}
			return route;
		} else return undefined;
	};

	var animationTime = 350;
	var pauseTime = 100;

	var animateRoute = function (route, color, callback, customAnimationTime, customPauseTime) {
		var localAnimationTime = customAnimationTime != undefined ? customAnimationTime : animationTime;
		var localPauseTime = customPauseTime != undefined ? customPauseTime : pauseTime;
		var animateStep = function(step) {
			field.getPoint(route[step]).cell.animate({ backgroundColor: color }, { duration: localAnimationTime, complete: function() {
				//if (step >= route.length - 1) return;
				field.getPoint(route[step]).cell.animate({ backgroundColor: "transparent" }, { duration: localAnimationTime });
			}});
		};

		for (var step in route)
			(function(step) { setTimeout(function() { animateStep(step); }, step*localPauseTime); })(parseInt(step));
		setTimeout(callback, route.length*localPauseTime + 500);
	};

	var getMap = function(criteria) {
		var freeMap = [];
		for (var y in grid) 
			for (var x in grid[y]) 
				if (criteria(x, y)) freeMap.push({x: parseInt(x), y: parseInt(y)});
		return freeMap;
	}

	var resetMatches = function() {
		matches.flag = false;
		matches.map = [];

		for (var y = 0; y < HEIGHT; y++) {
			matches.map[y] = [];
			for (var x = 0; x < WIDTH; x++)
				matches.map[y][x] = false; 
		}
	};
	resetMatches();

	var isColorSpecial = function(color) {
		switch (color) {
			case game.colors.special.spectrum_nova:
			case game.colors.special.universal_matcher:
			case game.colors.special.explosive:
			case game.colors.special.storm:
			case game.colors.special.black_hole:
			case game.colors.special.line_feed_horizontal:
			case game.colors.special.line_feed_vertical:
				return true;
			default: 
				return false;
		}
	}

	var spectrumNova = function(nova, clicked) {
		var color = field.getPoint(clicked).color;
		
		field.getPoint(nova).cell.find(".element").fadeOut(animationTime*2, function() { 
			field.clearPoint(nova);
			field.update();
		});

		var novaCell = field.getPoint(nova).cell;
		novaCell.css('background', novaCell.color);
		novaCell.html("");
		field.clearPoint(nova);
		novaCell.animate({ backgroundColor: "white" }, { duration: animationTime, complete: function() {
			novaCell.animate({ backgroundColor: "transparent" }, { duration: animationTime });
		}});

		for (var y in grid)
			for (var x in grid[y])
				if (grid[y][x].color == color)
					matches.map[y][x] = true;

		field.kaboom(false);
	};

	var blackHole = function(hole) {
		var nonFree = field.getBusyMap();
		var remains = [];

		var moveToHole = function(index) {
			if (index == nonFree.length) {
				if (remains.length > 0) {
					nonFree = remains;
					remains = [];
					moveToHole(0);
				} else {
					field.clearPoint(hole);
					game.drop(3);
				}
				return;
			}

			var source = nonFree[index];
			var color = field.getPoint(source).color;

			if (isColorSpecial(color)) {
				moveToHole(index + 1);
				return;
			}

			var route = getRoute(source, hole);
			if (route == undefined) {
				remains.push(source);
				moveToHole(index + 1);
				return;
			}

			
			field.clearPoint(source);
			field.update();

			animateRoute(route, color, function() {
				field.setPoint(hole, game.colors.special.black_hole);
				field.update();
				moveToHole(index + 1);
			}, 60, 24);
		};

		moveToHole(0);
	};

	var storm = function(storm) {
		var stormCell = field.getPoint(storm).cell;
		stormCell.css('background', stormCell.color);
		stormCell.html("");
		field.clearPoint(storm);
		stormCell.animate({ backgroundColor: "white" }, { duration: animationTime, complete: function() {
			stormCell.animate({ backgroundColor: "transparent" }, { duration: animationTime });
		}});

		var free = field.getFreeMap();
		var nonFree = field.getBusyMap();
		var remains = [];

		var moveToStorm = function(index) {
			if (index == nonFree.length) {
				if (remains.length > 0) {
					nonFree = remains;
					remains = [];
					moveToStorm(0);
				} else {
					field.update();
				}
				return;
			}

			var source = nonFree[index];
			var color = field.getPoint(source).color;
			if ((source.x == storm.x && source.y == storm.y) || isColorSpecial(color)) {
				moveToStorm(index + 1);
				return;
			}

			var stormTarget = free[getRandomInt(0, free.length - 1)];
			
			var route = getRoute(source, stormTarget);
			if (route == undefined) {
				remains.push(source);
				moveToStorm(index + 1);
				return;
			}

			field.clearPoint(source);
			field.update();

			animateRoute(route, color, function() {
				field.setPoint(stormTarget, color);
				//field.update();
				free = field.getFreeMap();
				moveToStorm(index + 1);
			}, 350, 10);
		};

		moveToStorm(0);
	};

	var explosive = function(explosive) {
		var setExplosivePoint = function(x, y) {
			if (x < 0 || x >= WIDTH) return;
			if (y < 0 || y >= HEIGHT) return;
			matches.map[y][x] = true;
		};
		setExplosivePoint(explosive.x    , explosive.y    );
		setExplosivePoint(explosive.x + 1, explosive.y    );
		setExplosivePoint(explosive.x - 1, explosive.y    );
		setExplosivePoint(explosive.x    , explosive.y + 1);
		setExplosivePoint(explosive.x    , explosive.y - 1);
		setExplosivePoint(explosive.x + 1, explosive.y + 1);
		setExplosivePoint(explosive.x - 1, explosive.y - 1);
		setExplosivePoint(explosive.x + 1, explosive.y - 1);
		setExplosivePoint(explosive.x - 1, explosive.y + 1);
		field.kaboom(false);
	};

	var line_feed = function(lf, initializer, incrementer) {
		for (var point = initializer(lf); point != undefined; point = incrementer(point)) 
			matches.map[point.y][point.x] = true;
		field.kaboom(false);
	};
	var line_feed_horizontal = function(lf) {
		var initializer = function(point) { return { x: 0, y: point.y }};
		var incrementer = function(point) { 
			if (point.x >= WIDTH -1) return undefined;
			return { x: point.x + 1, y: point.y }
		};
		line_feed(lf, initializer, incrementer);
	};	
	var line_feed_vertical = function(lf) {
		var initializer = function(point) { return { x: point.x, y: 0 }};
		var incrementer = function(point) { 
			if (point.y >= HEIGHT -1) return undefined;
			return { x: point.x, y: point.y + 1 }
		};
		line_feed(lf, initializer, incrementer);
	}

	this.create = function() {
		grid = [];
		for (var y = 0; y < HEIGHT; y++) {
			grid[y] = [];
			for (var x = 0; x < WIDTH; x++)
				grid[y][x] = new Cell(x, y, true, undefined);
		}
	};
	this.draw = function() {
		$("#field").html("");
		for (var y in grid) {
			var row = $("<div/>", {id: "row"+y, class: "row"});
			row.appendTo("#field");
			for (var x in grid[y]) {
				var cell = $("<div/>", {id: "cell" + x + "-" + y, class: "cell"});
				cell.data("x", x);
				cell.data("y", y);
				cell.appendTo(row);
				cell.click(function() { elementClicked($(this)); });
				grid[y][x].cell = cell;
			}
		}
	};
	this.update = function() {
		for (var y in grid) 
			for (var x in grid[y]) {
				var cell = $("#cell" + x + "-" + y);
				if (grid[y][x].color == undefined) {
					cell.css('background', 'transparent'); //
					cell.html("");
				} else { 
					//cell.css('background-color', grid[y][x].color);
					cell.html("<div class='element'></div>");
					cell.find('.element').css('background', grid[y][x].color);
				}
			}
	};
	this.clear = function() {
		this.createGrid();
		this.update();
	};
	this.getPoint = function(point) {
		return grid[point.y][point.x];
	};
	this.setPoint = function(point, color) {
		grid[point.y][point.x].color = color;
		grid[point.y][point.x].isFree = false;
	};
	this.clearPoint = function(point) {
		grid[point.y][point.x].color = undefined;
		grid[point.y][point.x].isFree = true;
	};
	this.getFreeMap = function() {
		return getMap(function(x, y) { return grid[y][x].isFree; });
	}
	this.getBusyMap = function() {
		return getMap(function(x, y) { return !grid[y][x].isFree; });
	}
	this.drop = function(color) {
		var freeMap = this.getFreeMap();
		if (!freeMap.length) return false;
		var point = freeMap[getRandomInt(0, freeMap.length - 1)];

		this.setPoint(point, color);
		this.update();
		return true;
	};
	this.check = function() {
		resetMatches();

		var horizontal = function(point) { return point.x < WIDTH - 1  ? {x: point.x + 1, y: point.y } : undefined; }; 
		var vertical   = function(point) { return point.y < HEIGHT - 1 ? {x: point.x, y: point.y + 1 } : undefined; }; 
		var diagonal_forward  = function(point) { return (point.x < WIDTH - 1 && point.y < HEIGHT - 1) ? {x: point.x + 1, y: point.y + 1 } : undefined; }; 
		var diagonal_backward = function(point) { return (point.x > 0         && point.y < HEIGHT - 1) ? {x: point.x - 1, y: point.y + 1 } : undefined; };

		var verify_point = function(point) {
			verify_point_with_direction(point,  horizontal);
			verify_point_with_direction(point,  vertical);
			verify_point_with_direction(point,  diagonal_forward);
			verify_point_with_direction(point,  diagonal_backward);
		};
		var verify_point_with_direction = function(point, direction) {
			var nmatches = count_matches(point, direction);
			if (nmatches >= LINE_LENGTH) mark_matches(point, direction, nmatches);
			if (verify_rainbow(point, direction)) {
				mark_matches(point, direction, 6);
				rainbowFlag = true;
			}
		};
		var count_matches = function(point, direction) {
			var nmatches = 0;
			var cpoint = { x: point.x, y: point.y };
			var color = field.getPoint(point).color;
			for (var umpoint = { x: point.x, y: point.y }; color == game.colors.special.universal_matcher && umpoint != undefined && color != undefined; umpoint = direction(umpoint)) {
				color = field.getPoint(umpoint).color;
			}
			if (color == undefined) return 0;
			do {
				nmatches++;
				cpoint = direction(cpoint);
			} while (cpoint != undefined && (field.getPoint(cpoint).color == color || field.getPoint(cpoint).color == game.colors.special.universal_matcher));
			return nmatches;
		};
		var mark_matches = function(point, direction, number) {
			matches.flag = true;
			var cpoint = { x: point.x, y: point.y };
			for (var i = 0; i < number; i++) {
				matches.map[cpoint.y][cpoint.x] = true;
				cpoint = direction(cpoint);
			}
		};
		var verify_rainbow = function(point, direction) {
			var colors = [];
			var cpoint = { x: point.x, y: point.y };
			for (var i = 0; i < 6; i++) {
				if (cpoint == undefined) return false;
				var color = field.getPoint(cpoint).color;
				if (color == undefined || isColorSpecial(color)) return false;
				if (colors[color] != undefined) return false;
				colors[color] = true;
				cpoint = direction(cpoint);
			}
			return true;
		}
		for (var y = 0; y < HEIGHT; y++)
			for (var x = 0; x < WIDTH; x++) 
				verify_point({x: x, y: y});

		return matches.count();
	};

	this.kaboom = function(bonus) {
		var animationTime = 600;
		var count = matches.countNonFree();
		for (var y in matches.map)
			for (var x in matches.map[y]) 
				if (matches.map[y][x]) {
					var cell = grid[y][x].cell;
					cell.css('background', grid[y][x].color);
					cell.html("");
					field.clearPoint({x: parseInt(x), y: parseInt(y)});
					(function(cell) { 
						cell.animate({ backgroundColor: "white" }, { duration: animationTime, complete: function() {
							cell.animate({ backgroundColor: "transparent" }, { duration: animationTime, complete: field.update });
						}});
					})(cell);
				}
		if (bonus) {
			if (lastMovementPoint == undefined) {
				var freeMap = this.getFreeMap();
				lastMovementPoint = freeMap[getRandomInt(0, freeMap.length - 1)];
			}
			if (count == 6) field.setPoint(lastMovementPoint, game.colors.special.universal_matcher);
			if (count == 7) field.setPoint(lastMovementPoint, game.colors.special.explosive);
			if (count == 8) field.setPoint(lastMovementPoint, game.colors.special.storm);
			if (count >= 9) field.setPoint(lastMovementPoint, game.colors.special.black_hole);
			if (rainbowFlag) {
				field.setPoint(lastMovementPoint, game.colors.special.spectrum_nova);
				rainbowFlag = false;
			}
		}
		resetMatches();
	};
	
};

function Game() {
	var field = new Field();
	var current_game = this;
	field.create();
	field.draw();

	this.colors = {
		purple: "purple",
		blue: "blue",
		green: "green",
		yellow: "yellow",
		orange: "orange",
		red: "red"
	};
	this.colors.special = {
		spectrum_nova: "linear-gradient(135deg, purple 0%, blue 20%, green 40%, yellow 60%, orange 80%, red 100%)",
		universal_matcher: "#fff",
		explosive: "radial-gradient(ellipse at center, rgba(234,66,4,1) 0%,rgba(143,2,34,1) 44%,rgba(255,0,4,1) 100%)",
		storm: "linear-gradient(to bottom, rgba(27,62,119,1) 0%,rgba(255,117,119,1) 100%)",
		black_hole: "#000",
		painters: "",
		line_feed_horizontal: "linear-gradient(to bottom, transparent 0%, #ffffff 50%, transparent 100%)",
		line_feed_vertical: "linear-gradient(to right, transparent 0%, #ffffff 50%, transparent 100%)"
	};

	var createColor = function() {
		var iColor = getRandomInt(0, 5);
		var color = "black";
		switch (iColor) {
			case 0: color = current_game.colors.purple; break;
			case 1: color = current_game.colors.blue; break;
			case 2: color = current_game.colors.green; break;
			case 3: color = current_game.colors.yellow; break;
			case 4: color = current_game.colors.orange; break;
			case 5: color = current_game.colors.red; break;
			//case 5: color = "purple"; break; 
			//case 5: color = current_game.colors.special.line_feed_horizontal; break;
		}
		return color;
	};

	this.gameOver = function() {
		$("#field").addClass("gameover");
		alert("Game over");
	};
	this.cantMove = function() {
		alert("No way");
	};

	this.endTurn = function() {
		var exploded = field.check();
		if (exploded > 0) field.kaboom(true);
		else this.drop(3);
	};

	this.drop = function(number) {
		for (var i = 0; i < number; i++) {
			var color = createColor();
			if (!field.drop(color)) {
				this.gameOver();
				return;
			}
		}
		if (!field.getFreeMap().length) this.gameOver();
	};
	$("#field").removeClass("gameover");
	$(window).trigger('resize');
	this.drop(5);
}

var game = {};


function drawKrown(canvas) {
	var context = canvas.getContext("2d");
	context.clearRect(0, 0, 100, 100);
	context.fillStyle="#FFCC00";
	context.moveTo(0, 0);
	context.lineTo(20, 80);
	context.lineTo(80, 80);
	context.lineTo(100, 0);
	context.lineTo(65, 65);
	context.lineTo(50, 0);
	context.lineTo(35, 65);
	context.lineTo(0, 0);
	context.fill();

	context.fillRect(20, 85, 60, 10);
}

function resizeCells() {
	var width = $(window).width();
	var height = $(window).height() - $("#panel").height();
	var baseSize = (width > height) ? height : width;
	var cellSize = (0.8 * baseSize) / 9;
	$(".cell").width(cellSize);
	$(".cell").height(cellSize);
	//drawKrown(document.getElementById("drawKrown"));

/*	$(".element").css("width", cellSize);
	$(".element").css("height", cellSize);*/
}

$(function() {
	$("#new-game").click(start);
	drawKrown(document.getElementById("drawKrown"));
	start(); 
	$(window).on('resize', resizeCells).trigger('resize');
});

function start() { game = new Game(); }
