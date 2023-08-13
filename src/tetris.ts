const dbt = document.getElementById("debug") as HTMLParagraphElement;
const canvas = document.getElementById("tetris") as HTMLCanvasElement;
const context = canvas.getContext("2d") as CanvasRenderingContext2D;
const colours = [null, "#FF0D72", "#0DC2FF", "#0DFF72", "#F538FF", "#FF8E0D", "#FFE138", "#3877FF"] as const;

var running = false;
function setRunning(value: boolean) {
	running = value;
}
var gamePaused = false;
var dropCounter = 0;
var dropInterval = 1000;
var lastTime = 0;
var speedModifier = 1;
/**
 * 0: Normal-Mode
 *
 * 1: Fill-Mode
 */
var mode: 0 | 1 = 0;

context.scale(20, 20);

dbt.innerHTML = "Press a button and it will appear here.";
window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
	dbt.innerHTML += "</br>" + errorMsg + " | " + lineNumber + " | " + url;
	return false;
};

function arenaSweep() {
	if (mode != 1) {
		var rowCount = 1;
		outer: for (var y = arena.length - 1; y > 0; --y) {
			for (var x = 0; x < arena[y].length; ++x) {
				if (arena[y][x] === 0) {
					continue outer;
				}
			}

			var row = arena.splice(y, 1)[0].fill(0);
			arena.unshift(row);
			++y;

			player.score += rowCount * 10;
			rowCount *= 2;
		}
	}
}

function collide(
	arena: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][],
	player: {
		pos: {
			x: number;
			y: number;
		};
		matrix: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][];
		score: number;
	},
) {
	for (var y = 0; y < player.matrix.length; ++y) {
		for (var x = 0; x < player.matrix[y].length; ++x) {
			if (
				player.matrix[y][x] !== 0 &&
				(arena[y + player.pos.y] && arena[y + player.pos.y][x + player.pos.x]) !== 0
			) {
				return true;
			}
		}
	}
	return false;
}

function createMatrix(w: number, h: number) {
	var matrix: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][] = [];
	while (h--) {
		matrix.push(new Array(w).fill(0));
	}
	return matrix;
}

function createPiece(type: "I" | "L" | "J" | "O" | "Z" | "S" | "T"): (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][] {
	if (type === "I") {
		return [
			[0, 1, 0, 0],
			[0, 1, 0, 0],
			[0, 1, 0, 0],
			[0, 1, 0, 0],
		];
	} else if (type === "L") {
		return [
			[0, 2, 0],
			[0, 2, 0],
			[0, 2, 2],
		];
	} else if (type === "J") {
		return [
			[0, 3, 0],
			[0, 3, 0],
			[3, 3, 0],
		];
	} else if (type === "O") {
		return [
			[4, 4],
			[4, 4],
		];
	} else if (type === "Z") {
		return [
			[5, 5, 0],
			[0, 5, 5],
			[0, 0, 0],
		];
	} else if (type === "S") {
		return [
			[0, 6, 6],
			[6, 6, 0],
			[0, 0, 0],
		];
	} else if (type === "T") {
		return [
			[0, 7, 0],
			[7, 7, 7],
			[0, 0, 0],
		];
	} else {
		throw new Error("Unknown piece type");
	}
}

function drawMatrix(matrix: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][], offset: { x: number; y: number }) {
	matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value !== 0) {
				context.fillStyle = colours[value];
				context.fillRect(x + offset.x, y + offset.y, 1, 1);
			}
		});
	});
}

function draw() {
	context.fillStyle = "RGBA(0,0,0,0.4)";
	context.fillRect(0, 0, canvas.width, canvas.height);

	drawMatrix(arena, {
		x: 0,
		y: 0,
	});
	drawMatrix(player.matrix, player.pos);
}

function merge(
	arena: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][],
	player: { pos: { x: number; y: number }; matrix: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][]; score: number },
) {
	player.matrix.forEach((row, y) => {
		row.forEach((value, x) => {
			if (value !== 0) {
				arena[y + player.pos.y][x + player.pos.x] = value;
			}
		});
	});
}

function rotate(matrix: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][], dir: number) {
	for (var y = 0; y < matrix.length; ++y) {
		for (var x = 0; x < y; ++x) {
			var temp = matrix[y][x];
			matrix[y][x] = matrix[x][y];
			matrix[x][y] = temp;
		}
	}

	if (dir > 0) {
		matrix.forEach((row) => row.reverse());
	} else {
		matrix.reverse();
	}
}

/**
 * @param {number} offset
 */
function playerDrop(offset: number) {
	if (gamePaused == false || mode != 0) {
		player.pos.y += offset;
		if (collide(arena, player)) {
			player.pos.y--;
			merge(arena, player);
			playerReset();
			arenaSweep();
			updateScore();
		}
		dropCounter = 0;
	}
}

/**
 * @param {number} offset
 */
function playerMove(offset: number) {
	if (gamePaused == false || mode != 0) {
		player.pos.x += offset;
		if (collide(arena, player)) {
			player.pos.x -= offset;
		}
	}
}

function playerReset() {
	/** @type {["T" , "J" , "L" , "O" , "S" , "Z" , "I"]} */ // @ts-ignore
	var pieces: ["T", "J", "L", "O", "S", "Z", "I"] = "TJLOSZI".split("");
	speedModifier = 1;
	player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
	player.pos.y = 0;
	player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
	if (collide(arena, player)) {
		arena.forEach((row) => row.fill(0));
		player.score = 0;
		updateScore();
	}
}

function playerRotate(dir: number) {
	if (gamePaused == false || mode != 0) {
		var pos = player.pos.x;
		var offset = 1;
		rotate(player.matrix, dir);
		while (collide(arena, player)) {
			player.pos.x += offset;
			offset = -(offset + (offset > 0 ? 1 : -1));
			if (player.matrix && offset > player.matrix[0].length) {
				rotate(player.matrix, -dir);
				player.pos.x = pos;
				return;
			}
		}
	}
}

function update(time?: number | null) {
	if (time == null || time == undefined) {
		time = 0;
	}
	if (mode == 0) {
		var deltaTime = time - lastTime;
		//console.log(dropInterval * speedModifier);
		dropCounter += deltaTime;
		if (dropCounter > dropInterval * speedModifier) {
			playerDrop(1);
		}
		lastTime = time;
	}
	draw();
	requestAnimationFrame(update);
}

function updateScore() {
	(document.getElementById("score") || document.createElement("p")).innerText = String(player.score);
	if (player.score > 30 && player.score < 60) {
		speedModifier = 0.9;
	} else if (player.score > 60 && player.score < 90) {
		speedModifier = 0.8;
	} else if (player.score > 90 && player.score < 120) {
		speedModifier = 0.7;
	} else if (player.score > 120 && player.score < 150) {
		speedModifier = 0.6;
	} else if (player.score > 150 && player.score < 180) {
		speedModifier = 0.5;
	} else if (player.score > 180 && player.score < 210) {
		speedModifier = 0.4;
	} else if (player.score > 210 && player.score < 240) {
		speedModifier = 0.3;
	} else if (player.score > 240 && player.score < 270) {
		speedModifier = 0.2;
	} else if (player.score > 270 && player.score < 300) {
		speedModifier = 0.1;
	}
	//console.log(speedModifier + " " + player.score);
}

function switchMode() {
	if (mode == 0) {
		mode = 1;
		playerReset();
		(document.getElementById("gameMode") || document.createElement("p")).innerHTML = "Fill";
	} else {
		mode = 0;
		playerReset();
		(document.getElementById("gameMode") || document.createElement("p")).innerHTML = "Normal";
	}
}

function togglePause() {
	if (mode != 1) {
		if (gamePaused == true) {
			gamePaused = false;
			(document.getElementById("gameState") || document.createElement("p")).innerHTML = "Playing";
		} else if (gamePaused == false) {
			gamePaused = true;
			(document.getElementById("gameState") || document.createElement("p")).innerHTML = "Paused";
		}
	}
}

/**
 * @param {"x" | "y" | "z"} dir
 * @param {number} offset
 */
function move(dir: "x" | "y" | "z", offset: number) {
	if (dir == "x") {
		//Vertical Movement
		playerMove(offset);
	} else if (dir == "y") {
		//horizontal Movement
		playerDrop(offset);
	} else if (dir == "z") {
		//Rotate
		playerRotate(offset);
	}
}

const arena: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)[][] = createMatrix(12, 20);

/** @type {{ pos: { x: number, y: number }, matrix: typeof arena, score: number }} */
const player: { pos: { x: number; y: number }; matrix: typeof arena; score: number } = {
	pos: {
		x: 0,
		y: 0,
	},
	matrix: [],
	score: 0,
};

export { move, playerReset, running, setRunning,switchMode, togglePause, update, updateScore, dbt, canvas, context };

