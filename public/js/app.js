//#region Variables
var canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d"),
  socket = io(),
  heightOfBlock = 32,
  widthOfBlock = 32,
  LGame,
  fps = 0,
  start,
  arrSI = [],
  key = new Array(100);
//#endregion

//#region Functions
function MakeBlock(color, x, y) {
  ctx.fillStyle = String(color);
  ctx.fillRect(
    x * heightOfBlock,
    y * widthOfBlock,
    heightOfBlock,
    widthOfBlock
  );
}
function DrawPlayer(color, x, y) {
  ctx.fillStyle = String(color);
  ctx.fillRect(
    x * heightOfBlock,
    y * widthOfBlock,
    heightOfBlock * 0.8,
    widthOfBlock * 0.8
  );
}
function Update() {
  let height = LGame.height * heightOfBlock;
  let width = LGame.width * widthOfBlock;
  if (canvas.height != height || canvas.width != width) {
    canvas.height = height;
    canvas.width = width;
  }
  for (let x = 0; x < LGame.height; x++) {
    for (let y = 0; y < LGame.width; y++) {
      if (LGame.map[x][y]) {
        MakeBlock(LGame.map[x][y].color, x, y);
      } else MakeBlock("white", x, y);
    }
  }
  for (let key in LGame.players) {
    DrawPlayer(
      LGame.players[key].color,
      LGame.players[key].x,
      LGame.players[key].y
    );
  }
  fps++;
  requestAnimationFrame(Update);
}
//#endregion

window.onkeydown = (e) => {
  key[e.keyCode] = true;
};
window.onkeyup = (e) => {
  key[e.keyCode] = false;
};

setInterval(() => {
  console.log(fps);
  fps = 0;
}, 1000);

socket.on("connect", () => {
  socket.emit("name", Math.floor(Math.random() * 100));
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 1, 1);
  socket.on("game", (game) => {
    LGame = game;
    if (!start) {
      start = 1;
      Update();
    }
  });
  arrSI.push(
    setInterval(() => {
      if (key[87] || key[38]) socket.emit("up");
      if (key[83] || key[40]) socket.emit("down");
      if (key[65] || key[37]) socket.emit("left");
      if (key[68] || key[39]) socket.emit("right");
      if (key[32]) socket.emit("space");
    }, 1)
  );
});

socket.on("disconnect", () => {
  arrSI.forEach((f) => {
    clearInterval(f);
  });
  arrSI = [];
});
