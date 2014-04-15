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

	var next = [];

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
		},
		iterate: function(callback) {
			for (var y in this.map)
				for (var x in this.map[y]) 
					callback({x: parseInt(x), y: parseInt(y)}, this.map[y][x]);
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

		animateRoute(route, color, function() {
			field.setPoint(dest, color);
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

	var blackHole_old = function(hole) {
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
					game.drop(3, true);
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

			animateRoute(route, color, function() {
				field.setPoint(hole, game.colors.special.black_hole);
				moveToHole(index + 1);
			}, 60, 24);
		};

		moveToHole(0);
	};

	var blackHole = function(hole) {
		var getRoundArea = function(d) {
			var res = [];
			for (var y in grid)
				for (var x in grid[y]) {
					var _x = parseInt(x);
					var _y = parseInt(y);
					if ((!grid[y][x].isFree) && (Math.abs(_x - hole.x) <= d && Math.abs(_y - hole.y) <= d)) 
						res.push({ x: _x, y: _y });
				}
			return res;
		};
		var animationStep = function(step) {
			var roundArea = getRoundArea(step);
			if (roundArea.length > 0) {
				for (var i in roundArea) {
					var current_cell = field.getPoint(roundArea[i]).cell;
					current_cell.css('background', current_cell.color);
					current_cell.html("");
					field.clearPoint(roundArea[i]);
					(function(cell) { 
						cell.animate({ backgroundColor: "black" }, { duration: animationTime, complete: function() {
							cell.animate({ backgroundColor: "transparent" }, { duration: animationTime, complete: field.update });
						}});
					})(current_cell);
				}
			}
			if (step >= 9) {
				field.clearPoint(hole);
				game.drop(3, true);
			} else {
				window.setTimeout(function() { animationStep(step + 1); }, 500);
			}
		};
		animationStep(0);
	};

/*	var blackHole = function(hole) {
		if ((hole.x != 0 && hole.x != 8) || (hole.x != 0 && hole.x != 8)) 
			return blackHole_old(hole);

		var getPoints = function() {
			var points = [];
			for (var y in grid)
				for (var x in grid[y])
					if (!grid[y][x].isFree) points.push({x: parseInt(x), y: parseInt(y)});
			return points;
		};

		var moveToHole = function(step) {
			if (step >= 9) {
				field.clearPoint(hole);
				game.drop(3, true);
				return;
			}
			var points = getPoints();
			for (var i in points) {
				var point = points[i];
				var color = field.getPoint(point).color;
				var route = [];
				route.push(point);
				point_new = {x: point.x, y: point.y};
				if (point.x < hole.x) point_new.x++;
				if (point.x > hole.x) point_new.x--;
				if (point.y < hole.y) point_new.y++;
				if (point.y > hole.y) point_new.y--;
				route.push(point_new);
				animateRoute(route, color, function() {
					field.clearPoint(point);
					field.setPoint(point_new, color);
					field.setPoint(hole, game.colors.special.black_hole);
				});
			}
			window.setTimeout(function() { moveToHole(step+1); }, 1000);		
		};
		moveToHole(0);
	}*/

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

			animateRoute(route, color, function() {
				field.setPoint(stormTarget, color);
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
	this.getPoint = function(point) {
		return grid[point.y][point.x];
	};
	var updatePoint = function(point) {
		var cell = $("#cell" + point.x + "-" + point.y);
		var gridElement = grid[point.y][point.x];
		if (gridElement.color == undefined) {
			cell.css('background', 'transparent'); //
			cell.html("");
			if (gridElement.next) {
				cell.html("<div class='next'></div>");
				cell.find('.next').css('background', gridElement.next.color);
			}
		} else { 
			cell.html("<div class='element'></div>");
			cell.find('.element').css('background', gridElement.color);
		}
	};
	this.setPoint = function(point, color) {
		grid[point.y][point.x].color = color;
		grid[point.y][point.x].isFree = false;
		updatePoint(point);
	};
	this.clearPoint = function(point) {
		grid[point.y][point.x].color = undefined;
		grid[point.y][point.x].isFree = true;
		updatePoint(point);
	};
	this.getFreeMap = function() {
		return getMap(function(x, y) { return grid[y][x].isFree && !grid[y][x].next; });
	};
	this.getBusyMap = function() {
		return getMap(function(x, y) { return !grid[y][x].isFree; });
	};
	this.IterateByGrid = function(callback) {
		for (var y in grid)
			for (var x in grid[y]) 
				callback({x: parseInt(x), y: parseInt(y)}, grid[y][x]);
	};

	this.isColorSpecial = function(color) { return isColorSpecial(color); };

	var getRandomPoint = function() {
		var freeMap = field.getFreeMap();
		if (!freeMap.length) return undefined;
		return point = freeMap[getRandomInt(0, freeMap.length - 1)];
	};
	this.drop = function(color) {
		var point = getRandomPoint();
		if (point == undefined) return false;
		field.setPoint(point, color);
		return true;
	};
	this.clearNext = function() {
		for (var i in next) {
			grid[next[i].point.y][next[i].point.x].next = undefined;
			updatePoint(next[i].point);
		}
		next = [];
	};
	this.applyNext = function() {
		for (var i in next)
			if (this.getPoint(next[i].point).isFree)
				this.setPoint(next[i].point, next[i].color);
		this.clearNext();
	};
	this.createNext = function(color) {
		var point = getRandomPoint();
		if (point == undefined) return false;
		var cnext = {
			point: point,
			color: color
		};
		next.push(cnext);
		grid[point.y][point.x].next = cnext;
		updatePoint(point);
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
		game.score.addByMatches(matches);
		var current_point = undefined;
		for (var y in matches.map)
			for (var x in matches.map[y]) 
				if (matches.map[y][x]) {
					var cell = grid[y][x].cell;
					cell.css('background', grid[y][x].color);
					cell.html("");
					current_point = {x: parseInt(x), y: parseInt(y)};
					field.clearPoint(current_point);
					(function(cell) { 
						cell.animate({ backgroundColor: "white" }, { duration: animationTime, complete: function() {
							cell.animate({ backgroundColor: "transparent" }, { duration: animationTime, complete: field.update });
						}});
					})(cell);
				}
		if (bonus) {
			if (current_point == undefined) {
				var freeMap = this.getFreeMap();
				current_point = freeMap[getRandomInt(0, freeMap.length - 1)];
			}
			if (count == 6) field.setPoint(current_point, game.colors.special.universal_matcher);
			if (count == 7) {
				var seed = getRandomInt(0, 2);
				var element;
				switch (seed) {
					case 0 : element = game.colors.special.explosive; break;
					case 1 : element = game.colors.special.line_feed_horizontal; break;
					case 2 : element = game.colors.special.line_feed_vertical; break;
				}
				field.setPoint(current_point, element);
			}
			if (count == 8) field.setPoint(current_point, game.colors.special.spectrum_nova);
			if (count >= 9) field.setPoint(current_point, game.colors.special.black_hole);
		}
		resetMatches();
	};
	
};

function HallOfFame(name) {
	if (typeof(Storage) == "undefined") {
		message("Your browser do not support Web Storage, Hall Of Fame is not avaliable.");
		return;
	}
	var fameDataJSON = localStorage.HallOfFame;
	if (fameDataJSON == undefined) 
		fameDataJSON = JSON.stringify([{ name: "Captain Nemo", score: 32 }, { name: "Count Monte-Cristo", score: 16 }, { name: "Mister X", score: 8 }]);

	var fameData = JSON.parse(fameDataJSON);
	var createFameElement = function(name, score) { return { name: name, score: score }; };

	var fameElement = createFameElement(name, 0);
	fameData.push(fameElement);
	var write = function() { localStorage.HallOfFame = JSON.stringify(fameData); };
	var getSortedFameData = function() { return fameData.slice(0).sort(function(a, b) { return b.score - a.score; }); }
	this.setScore = function(score) {
		if (score <= 0) return;
		fameElement.score = score;
		write();
		this.setKing();
	};
	this.getKingFame = function() {
		var kingFame = { name: "Unknown", score: 0 };
		for (var i in fameData) 
			if (fameData[i].score > kingFame.score) kingFame = fameData[i];
		return kingFame;
	};
	this.getHtml = function() {
		var sortedFameData = getSortedFameData();
		
		var lis = "";
		for (var i in sortedFameData) {
			if (i > 15) break;
			var name = sortedFameData[i].name;
			if (i == 0) name = "<span style='color: #ffcc00;'>" + name + "</span>"; 
			lis += "<li>" + name + " - " + sortedFameData[i].score + "</li>";
		}

		return "<h2>Hall Of Fame</h2> <ol>" + lis + "</ol>";
	};
	this.setKing = function() {
		var king = getSortedFameData()[0];
		$("#king_name").html(king.name);
		$("#king_score").html(king.score);
	};
	this.setKing();
}
var hallOfFame = undefined;

function Game() {
	var field = new Field();
	hallOfFame = new HallOfFame($("#username").html());
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
		explosive: "radial-gradient(ellipse at center, rgba(234,66,4,1) 0%, rgba(255,0,4,1) 15%, rgba(143,2,34,1) 30%, transparent 100%)",
		storm: "linear-gradient(to bottom, rgba(27,62,119,1) 0%, rgba(255,117,119,1) 100%)",
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
		}
		return color;
	};

	this.score = {
		white: 0,
		colors: [],
		reset: function() {
			for (var color in current_game.colors)
				if (typeof(color) == "string" && color != "special") this.colors[color] = 0;
			this.display();
		},
		addByMatches: function(matches) {
			matches.iterate(function(point, flag) {
				var gridPoint = field.getPoint(point);
				if (flag && gridPoint.color != undefined) 
					game.score.add(gridPoint.color, 1, "dont_recount");
			});
			this.recount();
		},
		add: function(color, quantity, dont_recount) {
			if (color == current_game.colors.special.universal_matcher) {
				this.white += quantity;
				return;
			}
			if (field.isColorSpecial(color)) return;
			this.colors[color] += quantity;
			if (dont_recount) return;
			this.recount();
		},
		recount: function() {
			var do_count = function() {
				for (var color in current_game.score.colors) 
					if (current_game.score.colors[color] == 0) return false;
				current_game.score.white++;
				for (var color in current_game.score.colors)
					current_game.score.colors[color]--;
				return true;
			}
			do { ; } while (do_count());
			hallOfFame.setScore(current_game.score.white);
			this.display();
		},
		display: function() {
			for (var color in this.colors)
				console.log(color + " - " + this.colors[color]);
			console.log("--");
			console.log("white - " + this.white);
			console.log("----");

			$("#colorscore").html("");
			for (var color in this.colors)
				for (var i = 0; i < this.colors[color]; i++) {
					var block = $("<div/>", {class: "scoreblock"});
					block.css("background", color);
					block.appendTo($("#colorscore"));
				}
				console.log(color + " - " + this.colors[color]);
			$("#whitescore").html(this.white);
		}
	};
	this.score.reset();

	this.gameOver = function() {
		$("#field").addClass("gameover");
		window.setTimeout(function() { 
			message("Your game is over! Start new one?", {
				ok: {text: "Start", callback: function() { game = new Game(); } },
				cancel: {text: "Don't start"},
			}); 
		}, 1000);
	};
	this.cantMove = function() {
		message("No way");
	};

	this.endTurn = function() {
		if (field.check() > 0) field.kaboom(true);
		else this.drop(3);
	};

	this.drop = function(number, isInitial) {
		var drop = field.drop;
		if (isInitial) field.clearNext();
		else  {
			field.applyNext();
			drop = field.createNext;
		}
		var doDrop = function() {
			for (var i = 0; i < number; i++) {
				var color = createColor();
				if (!drop(color)) {
					this.gameOver();
					return;
				}
			}
			if (!field.getFreeMap().length) this.gameOver();
		};
		doDrop();
		
		if (isInitial) {
			drop = field.createNext;
			doDrop();
		}
		else if (field.check() > 0) field.kaboom(true);
	};
	$("#field").removeClass("gameover");
	$(window).trigger('resize');
	this.drop(5, true);
}

var game = {};

function Messagebox(data, fielddata) {
	if (fielddata != undefined) {
		var ok_button = $("#messagebox").find("#ok_button");
		var cancel_button = $("#messagebox").find("#cancel_button");
		var input = $("#messagebox").find("input");

		if (fielddata.ok != undefined) {
			var ok_callback = function() {
				if ((fielddata.ok.callback) != undefined) fielddata.ok.callback();
				messagebox.hide();
			};
			ok_button.show();
			ok_button.html(fielddata.ok.text != undefined ? fielddata.ok.text : "Ok");
			ok_button.unbind("click");
			ok_button.click(ok_callback);
		} else {
			ok_button.hide();
		}
		if (fielddata.cancel != undefined) {
			var cancel_callback = function() {
				if ((fielddata.cancel.callback) != undefined) fielddata.cancel.callback();
				messagebox.hide();
			};
			cancel_button.show();
			cancel_button.html(fielddata.cancel.text != undefined ? fielddata.cancel.text : "Cancel");
			cancel_button.unbind("click");
			cancel_button.click(cancel_callback);
		} else {
			cancel_button.hide();
		}

		input.val("");
		if (fielddata.input != undefined) {
			input.show();
			if (fielddata.input.value != undefined) input.val(fielddata.input.value);
		} else {
			input.hide();
		}

		$("#messagebox-content").css("width", fielddata.width != undefined ? fielddata.width : "300px");
		$("#messagebox-content").css("height", fielddata.height != undefined ? fielddata.height : "auto");
		$("#messagebox-content").css("overflow-y", fielddata.overflow != undefined ? fielddata.overflow : "hidden");
	}

	this.getValue = function () {
		return $("#messagebox").find("input").val();
	};

	$("#messagebox").find("#data").html(data);

	var animationTime = 450;

	this.hide = function() {
		$("#messagebox").hide(animationTime);
		$("#main").show(animationTime);
	};

	$("#main").hide(animationTime);
	$("#messagebox").show(animationTime);
}

var messagebox = undefined;

function message(text, fielddata) {
	if (fielddata == undefined) fielddata = {ok: true};
	messagebox = new Messagebox(text, fielddata);
}

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
	var cellSize = (0.9 * baseSize) / 9;
	$(".cell").width(cellSize);
	$(".cell").height(cellSize);
	$("#field").css("margin", + (0.05 * baseSize) + "px auto");
}

$(function() {
	$("#button-new-game").click(start);
	$("#button-fame").click(showHallOfFame);
	$("#button-info").click(showInfo);
	drawKrown(document.getElementById("drawKrown"));
	$(window).on('resize', resizeCells).trigger('resize');
	window.setTimeout(start, 500);
});

function start() { 
	message("Say your name: ", { 
		ok: { callback: function() {
		 $("#username").html(messagebox.getValue());
		 game = new Game();
		}}, 
		input: { value: $("#username").html() } 
	});
}

function showInfo() {
	message($("#info").html(), { ok: true, width: "80%", height: "90%", overflow: "scroll" });
}

function showHallOfFame() {
	message(hallOfFame.getHtml());
}


