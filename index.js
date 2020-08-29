const express = require("express");
const { performance } = require("perf_hooks");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

var game = { map: [], players: {} };

const vel = 0.015;

//#region Blocks
const Spawn = {
  id: 0,
  break: false,
  collide: false,
  color: "yellow",
};

const BlockUnbreakable = {
  id: 1,
  break: false,
  color: "#696969",
  collide: true,
};

const Bomb = (power, user) => {
  return {
    id: 2,
    break: true,
    power: power,
    color: "green",
    u: user,
    collide: true,
  };
};

const BlockBreakable = {
  id: 3,
  break: true,
  color: "brown",
  collide: true,
};

const BombExplode = { id: 4, color: "yellow", collide: false };

const BlockBombUp = {
  id: 50,
  collide: false,
  break: true,
  color: "purple",
};

const BlockSpeedUp = {
  id: 51,
  collide: false,
  break: true,
  color: "yellow",
};

const BlockPowerUp = {
  id: 52,
  collide: false,
  break: true,
  color: "orange",
};

const BombUp = () => {
  game.map[socket.id].bombs++;
};

const SpeedUp = () => {
  game.map[socket.id].speed += 0.015 / 2;
};

const PowerUp = () => {
  game.map[socket.id].power++;
};

//#endregion
const SizeCharacter = 0.8;

var SendSocket = () => {};

//#region Functions

function NumBombOfUser(u) {
  let num = 0;
  for (let x = 0; x < game.height; x++) {
    for (let y = 0; y < game.width; y++) {
      if (game.map[x][y]) {
        if (game.map[x][y].id == 2) {
          if (u == game.map[x][y].u) num++;
        }
      }
    }
  }
  return num;
}

function PointsOfCharacter(p, size) {
  let o = { ul: {}, ur: {}, dl: {}, dr: {} };
  o.ul.x = p.x;
  o.ul.y = p.y;
  o.ur.x = p.x;
  o.ur.y = p.y + size;
  o.dl.x = p.x + size;
  o.dl.y = p.y;
  o.dr.x = p.x + size;
  o.dr.y = p.y + size;
  return o;
}

function Collision(o1, o2) {
  for (let x in o1) {
    if (
      o1.ul.x <= o2[x].x &&
      o2[x].x <= o1.dl.x &&
      o1.ul.y <= o2[x].y &&
      o2[x].y <= o1.ur.y
    ) {
      return true;
    }
    if (
      o2.ul.x <= o1[x].x &&
      o1[x].x <= o2.dl.x &&
      o2.ul.y <= o1[x].y &&
      o1[x].y <= o2.ur.y
    ) {
      return true;
    }
  }
  return false;
}

function ExplodeAnimation(x, y) {
  game.map[x][y] = BombExplode;
  SendSocket();
  setTimeout(() => {
    game.map[x][y] = undefined;
    SendSocket();
  }, 200);
  for (let key in game.players) {
    let pPoints = PointsOfCharacter(game.players[key], SizeCharacter);
    let b = PointsOfCharacter({ x: x, y: y }, 0.99);

    if (Collision(b, pPoints)) {
      game.players[key].life = false;
      game.players[key].color = "red";
      setTimeout(() => {
        delete game.players[key];
        SendSocket();
      }, 100);
    }
  }
}

function Explode(bx, by, power) {
  if (game.map[bx][by] && game.map[bx][by].id == 2) {
    for (let x = bx; x <= bx + power && x < game.height + 1; x++) {
      //Horizontal
      if (game.map[x]) {
        if (game.map[x][by]) {
          //Its thing
          if (game.map[x][by].break) {
            //Its Breakable
            if (game.map[x][by].id == 2 && x != bx) {
              //Its is bomb
              Explode(x, by, game.map[x][by].power);
            } else {
              ExplodeAnimation(x, by);
            }
          } else {
            x = bx + power + 1;
          }
        } else {
          ExplodeAnimation(x, by);
        }
      }
    }
    for (let x = bx - 1; x >= bx - power && x >= 0; x--) {
      if (game.map[x]) {
        if (game.map[x][by]) {
          if (game.map[x][by].break) {
            if (game.map[x][by].id == 2 && x != bx) {
              Explode(x, by, game.map[x][by].power);
            } else {
              ExplodeAnimation(x, by);
            }
          } else {
            x = bx - power - 1;
          }
        } else {
          ExplodeAnimation(x, by);
        }
      }
    }
    for (let y = by + 1; y <= by + power && y < game.width + 1; y++) {
      if (game.map[bx][y]) {
        if (game.map[bx][y].break) {
          if (game.map[bx][y].id == 2 && y != by) {
            Explode(bx, y, game.map[bx][y].power);
          } else {
            ExplodeAnimation(bx, y);
          }
        } else {
          y = by + power + 1;
        }
      } else {
        ExplodeAnimation(bx, y);
      }
    }
    for (let y = by - 1; y >= by - power && y >= 0; y--) {
      if (game.map[bx][y]) {
        if (game.map[bx][y].break) {
          if (game.map[bx][y].id == 2 && y != by) {
            Explode(bx, y, game.map[bx][y].power);
          } else {
            ExplodeAnimation(bx, y);
          }
        } else {
          y = by - power - 1;
        }
      } else {
        ExplodeAnimation(bx, y);
      }
    }
    SendSocket();
  }
}

function SetSpawn(x, y, g) {
  if (g.map[x] && g.map[x][y]) g.map[x][y] = undefined;
  if (g.map[x]) {
    if (g.map[x][y + 1]) g.map[x][y + 1] = undefined;
    if (g.map[x][y - 1]) g.map[x][y - 1] = undefined;
  }
  if (g.map[x + 1] && g.map[x + 1][y]) g.map[x + 1][y] = undefined;
  if (g.map[x - 1] && g.map[x - 1][y]) g.map[x - 1][y] = undefined;
  return;
}

function Game() {
  let players = Object.keys(game.players).length;
  let height = 2 * (players + 1) + 1 > 11 ? 2 * (players + 1) + 1 : 11;
  let width = 2 * (players + 1) + 1 > 11 ? 2 * (players + 1) + 1 : 11;
  let g = { map: [], spawn: [], height: height, width: width, message: {} };
  for (let x = 0; x < height; x++) {
    g.map.push(Array(width));
  }
  for (let x = 0; x < height; x++) {
    for (let y = 0; y < width; y++) {
      if (x % 2 != 0 && y % 2 != 0) {
        g.map[x][y] = BlockUnbreakable;
      } else g.map[x][y] = BlockBreakable;
    }
  }
  SetSpawn(0, 0, g);
  SetSpawn(0, width - 1, g);
  SetSpawn(height - 1, 0, g);
  SetSpawn(height - 1, width - 1 , g);
  for (let x = 0; x < players * 6; x++) {}
  //PowerUps
  game.map = g.map;
  game.height = g.height;
  game.width = g.width;
  for (let k in game.players) {
    game.players[k].life = true;
  }
  return;
}

function PlayerCollision(x, y, fX, fY, cX, cY) {
  let f = {};
  let c = {};
  let Player = PointsOfCharacter({ x: x, y: y }, SizeCharacter);
  f.x = Math.floor(x) + fX;
  f.y = Math.floor(y) + fY;
  c.x = Math.ceil(x) + cX;
  c.y = Math.ceil(y) + cY;
  if (game.map[f.x] && game.map[f.x][f.y] && game.map[f.x][f.y].collide) {
    if (Collision(Player, PointsOfCharacter(f, 1))) {
      return false;
    }
  }
  if (game.map[c.x] && game.map[c.x][c.y] && game.map[c.x][c.y].collide) {
    if (Collision(Player, PointsOfCharacter(c, 1))) {
      return false;
    }
  }
  return true;
}
//#endregion
Game();

io.on("connection", (socket) => {
  socket.on("name", (name) => {
    SendSocket = () => {
      socket.json.broadcast.emit("game", game);
      socket.json.emit("game", game);
    };
    game.players[socket.id] = {
      name: name,
      color:
        "rgb(" +
        Math.floor(Math.random() * 255) +
        "," +
        Math.floor(Math.random() * 255) +
        "," +
        Math.floor(Math.random() * 255) +
        ")",
      x: 0,
      y: 0,
      life: true,
      power: 1,
      bombs: 1,
      speed: vel,
    };
    if (Object.keys(game.players).length == 1) {
      Game();
    }
    socket.json.emit("game", game);
    //#region
    socket.on("up", () => {
      if (game.players[socket.id] && game.players[socket.id].life) {
        if (
          PlayerCollision(
            game.players[socket.id].x,
            game.players[socket.id].y - game.players[socket.id].speed,
            0,
            0,
            0,
            -1
          )
        ) {
          game.players[socket.id].y -= game.players[socket.id].speed;
          SendSocket();
        }
      }
    });
    socket.on("down", () => {
      if (game.players[socket.id] && game.players[socket.id].life) {
        if (
          PlayerCollision(
            game.players[socket.id].x,
            game.players[socket.id].y + game.players[socket.id].speed,
            0,
            1,
            0,
            0
          )
        ) {
          game.players[socket.id].y += game.players[socket.id].speed;
          SendSocket();
        }
      }
    });
    socket.on("left", () => {
      if (game.players[socket.id] && game.players[socket.id].life) {
        if (
          PlayerCollision(
            game.players[socket.id].x - game.players[socket.id].speed,
            game.players[socket.id].y,
            0,
            0,
            -1,
            0
          )
        ) {
          game.players[socket.id].x -= game.players[socket.id].speed;
          SendSocket();
        }
      }
    });
    socket.on("right", () => {
      if (game.players[socket.id] && game.players[socket.id].life) {
        if (
          PlayerCollision(
            game.players[socket.id].x + game.players[socket.id].speed,
            game.players[socket.id].y,
            1,
            0,
            0,
            0
          )
        ) {
          game.players[socket.id].x += game.players[socket.id].speed;
          SendSocket();
        }
      }
    });
    socket.on("space", () => {
      if (game.players[socket.id] && game.players[socket.id].life) {
        let x = Math.floor(game.players[socket.id].x + SizeCharacter * 0.5);
        let y = Math.floor(game.players[socket.id].y + SizeCharacter * 0.5);
        if (!game.map[x][y]) {
          if (NumBombOfUser(socket.id) < game.players[socket.id].bombs) {
            game.map[x][y] = Bomb(game.players[socket.id].power, socket.id);
            setTimeout(Explode, 3000, x, y, game.players[socket.id].power);
            SendSocket();
          }
        }
      }
    });
    //#endregion
    socket.on("disconnect", () => {
      delete game.players[socket.id];
    });
  });
});

app.use(express.static("public"));
server.listen(3000, () => {
  console.log("Server is Open");
});
