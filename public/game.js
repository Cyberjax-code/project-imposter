import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
const socket=io();
const $=id=>document.getElementById(id);
const COLORS=["#ff5b5b","#45b7ff","#ffd447","#9b72ff","#55d68b","#ff9de1","#ff9b42","#72e0d1"];
let room=null,myRole="unknown",myId=null,scene,camera,renderer,avatars={},myPos={x:0,z:0},mapName="ship",moveTimer=null;
const lobby=$("lobby"),game=$("game");
function msg(t){$("error").textContent=t||""}
function enterRoom(code){$("roomTag").textContent="ROOM "+code;$("codeValue").textContent=code;$("lobbyRoom").classList.remove("hidden")}
function showGame(){lobby.classList.add("hidden");game.classList.remove("hidden");init3D()}
$("create").onclick=()=>{msg("");socket.emit("createRoom",{name:$("name").value,map:$("map").value},r=>{if(!r.ok)return msg(r.error);enterRoom(r.code)})};
$("join").onclick=()=>{msg("");socket.emit("joinRoom",{name:$("name").value,code:$("joinCode").value},r=>{if(!r.ok)return msg(r.error);enterRoom(r.code)})};
$("copyCode").onclick=()=>navigator.clipboard?.writeText($("codeValue").textContent);
$("start").onclick=()=>socket.emit("startGame");
$("map").onchange=()=>socket.emit("changeMap",$("map").value);
$("colors").innerHTML=COLORS.map(c=>`<button class="swatch" style="background:${c}" data-color="${c}" aria-label="Choose color"></button>`).join("");
$("colors").onclick=e=>{const c=e.target.dataset.color;if(c)socket.emit("changeColor",c)};
$("doTask").onclick=()=>socket.emit("task");
$("report").onclick=()=>socket.emit("report");
$("kill").onclick=()=>{if(!room)return;const me=room.players.find(p=>p.id===myId);const target=room.players.filter(p=>p.alive&&p.id!==myId).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];if(target)socket.emit("kill",target.id)};
$("skipVote").onclick=()=>socket.emit("vote","skip");
$("chatForm").onsubmit=e=>{e.preventDefault();const i=$("chatInput");if(i.value.trim())socket.emit("chat",i.value);i.value=""};
document.querySelectorAll("[data-move]").forEach(b=>b.addEventListener("pointerdown",()=>{const d=b.dataset.move;const v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[d];moveTimer=setInterval(()=>{if(!room)return;myPos.x+=v[0]*.28;myPos.z+=v[1]*.28;socket.emit("move",myPos)},70)}));
window.addEventListener("pointerup",()=>{clearInterval(moveTimer);moveTimer=null});
socket.on("connect",()=>myId=socket.id);
socket.on("role",r=>{myRole=r;$("role").textContent=r.toUpperCase();notice("Your secret role: "+r.toUpperCase())});
socket.on("notice",notice);
socket.on("chat",m=>{const p=document.createElement("p");const b=document.createElement("b");b.textContent=m.name+": ";p.append(b,document.createTextNode(m.text));$("messages").append(p);$("messages").scrollTop=$("messages").scrollHeight});
function notice(t){$("notice").textContent=t;setTimeout(()=>{if($("notice").textContent===t)$("notice").textContent=""},3000)}
socket.on("state",r=>{
 room=r;mapName=r.map;
 if(r.phase!=="lobby")showGame();
 $("count").textContent=r.players.length+"/8";
 $("players").innerHTML=r.players.map(p=>`<div class="player"><span class="dot" style="background:${p.color}"></span>${escapeHtml(p.name)} ${p.id===r.hostId?"★":""}</div>`).join("");
 $("start").disabled=r.players.length<4;
 $("map").value=r.map;
 $("taskCount").textContent=`${r.tasksDone} / ${r.tasksTotal}`;
 $("mission").textContent=r.phase.toUpperCase();
 $("mapLabel").textContent=r.map==="lab"?"CRYO LAB":"THE ASTERION";
 if(r.phase==="meeting")renderVotes(r);
 else $("meeting").classList.add("hidden");
 if(r.phase==="ended"){$("end").classList.remove("hidden");$("end").textContent=r.winner==="crew"?"CREW VICTORY":"IMPOSTOR VICTORY"}
 if(r.phase==="playing"){$("end").classList.add("hidden");$("role").textContent=myRole.toUpperCase()}
 updateAvatars();
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderVotes(r){$("meeting").classList.remove("hidden");$("voteList").innerHTML=r.players.filter(p=>p.alive).map(p=>`<button class="vote" data-vote="${p.id}">${escapeHtml(p.name)}</button>`).join("");$("voteList").querySelectorAll("button").forEach(b=>b.onclick=()=>socket.emit("vote",b.dataset.vote))}
function init3D(){
 if(renderer)return;
 const canvas=$("scene");scene=new THREE.Scene();scene.background=new THREE.Color(0x09121e);
 camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(0,15,18);camera.lookAt(0,0,0);
 renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 scene.add(new THREE.HemisphereLight(0xb8e7ff,0x182033,2));
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(4,12,5);scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(42,42),new THREE.MeshStandardMaterial({color:0x182638,roughness:.9}));floor.rotation.x=-Math.PI/2;scene.add(floor);
 const grid=new THREE.GridHelper(40,40,0x38516a,0x24374c);grid.position.y=.015;scene.add(grid);
 // Room structures differ by map.
 const wallMat=new THREE.MeshStandardMaterial({color:mapName==="lab"?0x426079:0x34465c,metalness:.35,roughness:.6});
 const addBox=(x,z,w,h,d,mat=wallMat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,h/2,z);scene.add(m)};
 if(mapName==="lab"){addBox(-8,-5,8,2,1);addBox(8,-5,8,2,1);addBox(-8,6,1,2,9);addBox(8,6,1,2,9);addBox(0,0,3,1.5,3,new THREE.MeshStandardMaterial({color:0x2b8290,emissive:0x07333b}))}
 else{addBox(-9,0,1,2,16);addBox(9,0,1,2,16);addBox(0,-8,18,2,1);addBox(0,8,18,2,1);addBox(0,0,3,1.5,3,new THREE.MeshStandardMaterial({color:0x49627b}))}
 window.addEventListener("resize",resize);resize();animate();
}
function resize(){if(!renderer)return;const w=$("world").clientWidth,h=$("world").clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function makeAvatar(p){
 const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.75,4,8),new THREE.MeshStandardMaterial({color:p.color,roughness:.5}));body.position.y=.75;g.add(body);
 const visor=new THREE.Mesh(new THREE.SphereGeometry(.32,16,12),new THREE.MeshStandardMaterial({color:0x9eeaff,metalness:.3,roughness:.15}));visor.scale.set(1,.65,.35);visor.position.set(0,1.08,.35);g.add(visor);scene.add(g);return g;
}
function updateAvatars(){if(!scene||!room)return;const seen=new Set();room.players.forEach(p=>{seen.add(p.id);if(!avatars[p.id])avatars[p.id]=makeAvatar(p);avatars[p.id].position.set(p.x,0,p.z);avatars[p.id].visible=p.alive;avatars[p.id].children[0].material.color.set(p.color)});Object.keys(avatars).forEach(id=>{if(!seen.has(id)){scene.remove(avatars[id]);delete avatars[id]}});const me=room.players.find(p=>p.id===myId);if(me){myPos={x:me.x,z:me.z};camera.position.x=me.x;camera.position.z=me.z+18;camera.lookAt(me.x,0,me.z)}}
function animate(){requestAnimationFrame(animate);if(renderer)renderer.render(scene,camera)}
