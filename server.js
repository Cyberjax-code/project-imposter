const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const COLORS = ["#ff5b5b","#45b7ff","#ffd447","#9b72ff","#55d68b","#ff9de1","#ff9b42","#72e0d1"];

function code() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function safeRoom(room) {
  return {
    code: room.code, map: room.map, phase: room.phase, hostId: room.hostId,
    players: [...room.players.values()].map(p => ({
      id:p.id, name:p.name, color:p.color, x:p.x, z:p.z, alive:p.alive,
      role: p.id === room.hostId && room.phase === "lobby" ? "HOST" : undefined
    })),
    tasksDone: room.tasksDone, tasksTotal: room.tasksTotal,
    votes: room.phase === "meeting" ? room.votes : undefined,
    winner: room.winner
  };
}
function broadcast(room) { io.to(room.code).emit("state", safeRoom(room)); }
function makeRoom(socket, name, map) {
  let c; do { c = code(); } while (rooms.has(c));
  const room = {code:c, map:map === "lab" ? "lab" : "ship", hostId:socket.id,
    players:new Map(), phase:"lobby", tasksDone:0, tasksTotal:0, votes:{}, winner:null,
    bodies:[], tasks:[]};
  rooms.set(c, room);
  addPlayer(room, socket, name);
  return room;
}
function addPlayer(room, socket, name) {
  if (room.players.size >= 8) return false;
  const p = {id:socket.id, name:String(name || "Crewmate").slice(0,16),
    color:COLORS[room.players.size % COLORS.length], x:(Math.random()-.5)*5,
    z:(Math.random()-.5)*5, alive:true, role:null};
  room.players.set(socket.id,p);
  socket.join(room.code);
  return true;
}
function playerRoom(id) {
  for (const r of rooms.values()) if (r.players.has(id)) return r;
}
if (room.players.size < 2 || room.phase !== "lobby") return false;
  const ps = [...room.players.values()];
  const impostor = ps[Math.floor(Math.random()*ps.length)];
  ps.forEach(p => p.role = p.id === impostor.id ? "impostor" : "crew");
  room.phase = "playing"; room.tasksDone = 0; room.tasksTotal = ps.length * 3;
  room.bodies = []; room.votes = {}; room.winner = null;
  room.players.forEach(p => {p.alive=true; p.x=(Math.random()-.5)*8; p.z=(Math.random()-.5)*8;});
  return true;
}
function checkWin(room) {
  const alive = [...room.players.values()].filter(p=>p.alive);
  const imps = alive.filter(p=>p.role==="impostor").length;
  const crew = alive.length-imps;
  if (imps===0) room.winner="crew";
  else if (imps>=crew) room.winner="impostor";
  else if (room.tasksDone>=room.tasksTotal) room.winner="crew";
  if (room.winner) room.phase="ended";
}

io.on("connection", socket => {
  socket.on("createRoom", ({name,map}, cb={}) => {
    const r=makeRoom(socket,name,map); cb({ok:true,code:r.code}); broadcast(r);
  });
  socket.on("joinRoom", ({code:c,name}, cb={}) => {
    const r=rooms.get(String(c||"").toUpperCase());
    if (!r) return cb({ok:false,error:"Room not found."});
    if (r.phase!=="lobby") return cb({ok:false,error:"That game has already started."});
    if (!addPlayer(r,socket,name)) return cb({ok:false,error:"Room is full (8 players maximum)."});
    cb({ok:true,code:r.code}); broadcast(r);
  });
  socket.on("startGame", () => {
    const r=playerRoom(socket.id); if (!r || r.hostId!==socket.id) return;
    if (!startGame(r)) return socket.emit("notice","Need at least 2 players to start.");
    r.players.forEach(p=>io.to(p.id).emit("role",p.role));
    broadcast(r);
  });
  socket.on("move", ({x,z}) => {
    const r=playerRoom(socket.id); if (!r || r.phase!=="playing") return;
    const p=r.players.get(socket.id); if (!p || !p.alive) return;
    p.x=Math.max(-19,Math.min(19,Number(x)||0));
    p.z=Math.max(-19,Math.min(19,Number(z)||0));
    broadcast(r);
  });
  socket.on("task", () => {
    const r=playerRoom(socket.id); if (!r || r.phase!=="playing") return;
    const p=r.players.get(socket.id); if (!p || !p.alive || p.role!=="crew") return;
    r.tasksDone=Math.min(r.tasksTotal,r.tasksDone+1); checkWin(r); broadcast(r);
  });
  socket.on("kill", targetId => {
    const r=playerRoom(socket.id); if (!r || r.phase!=="playing") return;
    const p=r.players.get(socket.id), t=r.players.get(targetId);
    if (!p || !t || p.role!=="impostor" || !p.alive || !t.alive || t.role==="impostor") return;
    if (Math.hypot(p.x-t.x,p.z-t.z)>3.2) return socket.emit("notice","Move closer to your target.");
    t.alive=false; r.bodies.push({x:t.x,z:t.z}); checkWin(r); broadcast(r);
  });
  socket.on("report", () => {
    const r=playerRoom(socket.id); if (!r || r.phase!=="playing") return;
    r.phase="meeting"; r.votes={}; broadcast(r);
    io.to(r.code).emit("notice","Emergency meeting! Discuss and vote.");
  });
  socket.on("vote", targetId => {
    const r=playerRoom(socket.id); if (!r || r.phase!=="meeting") return;
    const p=r.players.get(socket.id); if (!p || !p.alive || r.votes[socket.id]) return;
    r.votes[socket.id]=targetId;
    const living=[...r.players.values()].filter(x=>x.alive);
    if (living.every(x=>r.votes[x.id])) {
      const counts={}; Object.values(r.votes).forEach(v=>{if(v!=="skip") counts[v]=(counts[v]||0)+1;});
      const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
      if (sorted.length && (!sorted[1] || sorted[0][1]>(sorted[1][1]))) {
        const ejected=r.players.get(sorted[0][0]); if(ejected) ejected.alive=false;
      }
      checkWin(r);
      if (!r.winner) r.phase="playing";
      r.votes={};
    }
    broadcast(r);
  });
  socket.on("chat", message => {
    const r=playerRoom(socket.id); if(!r) return;
    const p=r.players.get(socket.id);
    const msg=String(message||"").trim().slice(0,180);
    if(!msg || !p) return;
    io.to(r.code).emit("chat",{name:p.name,text:msg,at:Date.now()});
  });
  socket.on("changeColor", color => {
    const r=playerRoom(socket.id); if(!r || r.phase!=="lobby") return;
    const p=r.players.get(socket.id); if(p && COLORS.includes(color)) {p.color=color; broadcast(r);}
  });
  socket.on("changeMap", map => {
    const r=playerRoom(socket.id); if(!r || r.hostId!==socket.id || r.phase!=="lobby") return;
    r.map=map==="lab"?"lab":"ship"; broadcast(r);
  });
  socket.on("disconnect", () => {
    const r=playerRoom(socket.id); if(!r) return;
    r.players.delete(socket.id);
    if(!r.players.size) rooms.delete(r.code);
    else { if(r.hostId===socket.id) r.hostId=r.players.keys().next().value; broadcast(r); }
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`PROJECT: IMPOSTOR running on port ${PORT}`);
});
