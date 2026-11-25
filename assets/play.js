// 三分鐘俄羅斯方塊練習：全部在瀏覽器執行，不會呼叫伺服器
(function(){
'use strict';

// ---- 常數 ----
var COLS=10,ROWS=20,SIZE=30,EMPTY=0,TIME_LIMIT=180000;
var COLORS=['','#36c5d8','#efc84a','#9b70d8','#65c66b','#e75a5a','#4f82dc','#e99045'];
var SHAPES={I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],O:[[2,2],[2,2]],T:[[0,3,0],[3,3,3],[0,0,0]],S:[[0,4,4],[4,4,0],[0,0,0]],Z:[[5,5,0],[0,5,5],[0,0,0]],J:[[6,0,0],[6,6,6],[0,0,0]],L:[[0,0,7],[7,7,7],[0,0,0]]};
var NAMES=['I','O','T','S','Z','J','L'];

// ---- 狀態 ----
var board=document.getElementById('board'),ctx=board.getContext('2d'),holdCanvas=document.getElementById('hold'),holdCtx=holdCanvas.getContext('2d'),nextCanvas=document.getElementById('next'),nextCtx=nextCanvas.getContext('2d');
var grid,piece,queue,bag,held,canHold,score,lines,combo,backToBack,lastRotate,remaining,running,paused,last,dropClock,lockClock,animation;
var $=function(id){return document.getElementById(id)};
var hardDropOn=true; // 快速落下開關（W），記在瀏覽器裡

// ---- 方塊與盤面 ----
function blank(){return Array.from({length:ROWS},function(){return Array(COLS).fill(EMPTY)})}
function clone(m){return m.map(function(r){return r.slice()})}
function shuffled(){var a=NAMES.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function refill(){while(queue.length<6){if(!bag.length)bag=shuffled();queue.push(bag.shift())}}
function make(name){var m=clone(SHAPES[name]);return{name:name,m:m,x:Math.floor((COLS-m[0].length)/2),y:name==='I'?-1:0,r:0}}
function collision(p,dx,dy,matrix){var m=matrix||p.m;for(var y=0;y<m.length;y++)for(var x=0;x<m[y].length;x++)if(m[y][x]){var nx=p.x+x+dx,ny=p.y+y+dy;if(nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&grid[ny][nx]))return true}return false}
function spawn(name){refill();piece=make(name||queue.shift());refill();canHold=true;lastRotate=false;lockClock=0;if(collision(piece,0,0)){finish('Game Over','方塊堆到頂端 Blocks reached the top.')}}

// ---- 操作 ----
function rotateMatrix(m,dir){var n=m.length,out=Array.from({length:n},function(){return Array(n).fill(0)});for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(dir>0)out[x][n-1-y]=m[y][x];else out[n-1-x][y]=m[y][x];return out}
function rotate(dir){if(!running||paused||piece.name==='O')return;var r=rotateMatrix(piece.m,dir),kicks=[[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1]];for(var i=0;i<kicks.length;i++){if(!collision(piece,kicks[i][0],kicks[i][1],r)){piece.m=r;piece.x+=kicks[i][0];piece.y+=kicks[i][1];piece.r=(piece.r+dir+4)%4;lastRotate=true;lockClock=0;break}}}
function move(dx){if(running&&!paused&&!collision(piece,dx,0)){piece.x+=dx;lastRotate=false;lockClock=0}}
function down(manual){if(!running||paused)return false;if(!collision(piece,0,1)){piece.y++;lastRotate=false;if(manual)score++;lockClock=0;updateHud();return true}return false}
function hardDrop(){if(!running||paused)return;var d=0;while(!collision(piece,0,1)){piece.y++;d++}if(d)lastRotate=false;score+=d*2;lockPiece()}
function holdPiece(){if(!running||paused||!canHold)return;var current=piece.name;if(held){var swap=held;held=current;piece=make(swap);if(collision(piece,0,0))finish('Game Over','方塊堆到頂端 Blocks reached the top.')}else{held=current;spawn()}canHold=false;lastRotate=false;lockClock=0;drawPreviews()}

// ---- 計分（T-Spin、消行、Combo、全消）----
function occupied(x,y){return x<0||x>=COLS||y<0||y>=ROWS||Boolean(grid[y][x])}
function detectTSpin(){if(piece.name!=='T'||!lastRotate)return null;var cx=piece.x+1,cy=piece.y+1,corners=[[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1]],filled=corners.filter(function(p){return occupied(p[0],p[1])}).length;if(filled<3)return null;var fronts=[[[cx-1,cy-1],[cx+1,cy-1]],[[cx+1,cy-1],[cx+1,cy+1]],[[cx-1,cy+1],[cx+1,cy+1]],[[cx-1,cy-1],[cx-1,cy+1]]][piece.r];return{is:true,mini:fronts.filter(function(p){return occupied(p[0],p[1])}).length<2}}
function lockPiece(){var spin=detectTSpin();for(var y=0;y<piece.m.length;y++)for(var x=0;x<piece.m[y].length;x++)if(piece.m[y][x]){var ny=piece.y+y;if(ny<0){finish('Game Over','方塊堆到頂端 Blocks reached the top.');return}grid[ny][piece.x+x]=piece.m[y][x]}clearLines(spin);spawn();drawPreviews()}
function clearLines(spin){var lv=Math.floor(lines/10)+1,count=0;for(var y=ROWS-1;y>=0;y--){if(grid[y].every(Boolean)){grid.splice(y,1);grid.unshift(Array(COLS).fill(0));count++;y++}}var isSpin=Boolean(spin&&spin.is),isMini=Boolean(isSpin&&spin.mini&&count<2),base;if(isSpin)base=isMini?[100,200,400][count]:[400,800,1200,1600][count];else base=[0,100,300,500,800][count];var difficult=count>0&&(count===4||isSpin),b2bApplied=difficult&&backToBack;if(b2bApplied)base=Math.floor(base*1.5);if(count>0){combo++;var comboBonus=combo>0?Math.min(combo,20)*50:0;var perfect=grid.every(function(r){return r.every(function(v){return !v})}),pcBonus=0;if(perfect)pcBonus=count===4&&b2bApplied?3200:[0,800,1000,1800,2000][count];score+=(base+comboBonus+pcBonus)*lv;lines+=count;if(difficult)backToBack=true;else backToBack=false}else{combo=-1;if(isSpin)score+=base*lv}updateHud()}
function gravity(){return Math.max(90,650-Math.floor(lines/10)*55)}
function ghostY(){var y=piece.y;while(!collision(piece,0,y-piece.y+1))y++;return y}

// ---- 繪圖 ----
function cell(c,x,y,color,alpha){if(y<0)return;c.globalAlpha=alpha==null?1:alpha;c.fillStyle=color;c.fillRect(x*SIZE+1,y*SIZE+1,SIZE-2,SIZE-2);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(x*SIZE+3,y*SIZE+3,SIZE-6,4);c.globalAlpha=1}
function draw(){ctx.clearRect(0,0,board.width,board.height);ctx.fillStyle='#10252b';ctx.fillRect(0,0,board.width,board.height);ctx.strokeStyle='rgba(255,255,255,.045)';for(var x=1;x<COLS;x++){ctx.beginPath();ctx.moveTo(x*SIZE,0);ctx.lineTo(x*SIZE,board.height);ctx.stroke()}for(var y=1;y<ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*SIZE);ctx.lineTo(board.width,y*SIZE);ctx.stroke()}for(var gy=0;gy<ROWS;gy++)for(var gx=0;gx<COLS;gx++)if(grid[gy][gx])cell(ctx,gx,gy,COLORS[grid[gy][gx]]);if(piece){var ghost=ghostY();for(var py=0;py<piece.m.length;py++)for(var px=0;px<piece.m[py].length;px++)if(piece.m[py][px]){cell(ctx,piece.x+px,ghost+py,COLORS[piece.m[py][px]],.18);cell(ctx,piece.x+px,piece.y+py,COLORS[piece.m[py][px]])}}}
function mini(c,canvas,name,offsetY){if(!name)return;var m=SHAPES[name],unit=20,w=m[0].length*unit,h=m.length*unit,ox=(canvas.width-w)/2,oy=offsetY+(70-h)/2;c.fillStyle=COLORS[NAMES.indexOf(name)+1];for(var y=0;y<m.length;y++)for(var x=0;x<m[y].length;x++)if(m[y][x]){c.fillRect(ox+x*unit+1,oy+y*unit+1,unit-2,unit-2);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(ox+x*unit+3,oy+y*unit+3,unit-6,3);c.fillStyle=COLORS[NAMES.indexOf(name)+1]}}
function drawPreviews(){holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);mini(holdCtx,holdCanvas,held,0);for(var i=0;i<3;i++)mini(nextCtx,nextCanvas,queue[i],i*70)}
function updateHud(){$('score').textContent=score.toLocaleString('en-US');$('lines').textContent=lines;$('level').textContent=Math.floor(lines/10)+1;$('combo').textContent=Math.max(0,combo);var sec=Math.max(0,Math.ceil(remaining/1000));$('time').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function setOverlay(show,title,text,button,intro){$('overlay').hidden=!show;if(title)$('overlayTitle').textContent=title;if(intro)text='按下開始後進行三分鐘練習\nPress Start for a 3-minute run';if(text)$('overlayText').innerText=text;if(button)$('start').textContent=button}
function status(zh,en){$('status').innerText=zh+'\n'+en}

// ---- 遊戲流程 ----
function reset(){cancelAnimationFrame(animation);grid=blank();queue=[];bag=[];held=null;canHold=true;score=0;lines=0;combo=-1;backToBack=false;lastRotate=false;remaining=TIME_LIMIT;running=false;paused=false;last=0;dropClock=0;lockClock=0;piece=null;refill();spawn();running=false;updateHud();drawPreviews();draw();$('pause').disabled=true;$('pause').textContent='Pause';status('尚未開始 · 成績不會上傳或保存','Not started · Scores are not saved');setOverlay(true,'Ready?',null,'Start',true)}
function start(){if(running)return;releaseAll();grid=blank();queue=[];bag=[];held=null;score=0;lines=0;combo=-1;backToBack=false;lastRotate=false;remaining=TIME_LIMIT;running=true;paused=false;last=performance.now();dropClock=0;lockClock=0;refill();spawn();drawPreviews();updateHud();setOverlay(false);$('pause').disabled=false;$('pause').textContent='Pause';status('練習進行中 · Esc 可暫停','Playing · Esc to pause');animation=requestAnimationFrame(loop)}
function finish(title,text){releaseAll();running=false;paused=false;cancelAnimationFrame(animation);$('pause').disabled=true;status('練習結束 · 最終分數 '+score.toLocaleString('zh-TW'),'Finished · Final score '+score.toLocaleString('en-US'));setOverlay(true,title,text+'\n最終分數 Final score: '+score.toLocaleString('en-US'),'Play again');draw()}
function togglePause(){if(!running)return;releaseAll();paused=!paused;$('pause').textContent=paused?'Resume':'Pause';if(paused)status('已暫停','Paused');else status('練習進行中 · Esc 可暫停','Playing · Esc to pause');if(paused)setOverlay(true,'Paused','按 Esc 或 Resume 回到遊戲\nPress Esc or Resume to continue','Resume');else{setOverlay(false);last=performance.now();animation=requestAnimationFrame(loop)}}
function loop(now){if(!running||paused)return;var dt=Math.min(50,now-last);last=now;remaining-=dt;handleHeld(dt);if(!running)return;if(remaining<=0){remaining=0;updateHud();finish('Time\'s up!','三分鐘練習完成 3 minutes done.');return}dropClock+=dt;if(dropClock>=gravity()){dropClock=0;down(false)}if(collision(piece,0,1)){lockClock+=dt;if(lockClock>=450)lockPiece()}else lockClock=0;updateHud();draw();animation=requestAnimationFrame(loop)}

// ---- 鍵盤 ----
// 按住左右／下：遊戲自己計時重複（DAS／ARR），不靠作業系統的按鍵重複，手感才會順
var DAS=150,ARR=35,SOFT=30; // 按住多久開始連續移動、連續移動間隔、按住下的下降間隔（毫秒）
var keysDown={},dir=0,dasClock=0,arrClock=0,softClock=0;
function releaseAll(){keysDown={};dir=0;dasClock=0;arrClock=0;softClock=0}
function handleHeld(dt){if(dir){dasClock+=dt;if(dasClock>=DAS){arrClock+=dt;while(arrClock>=ARR){arrClock-=ARR;move(dir)}}}if(keysDown.s){softClock+=dt;while(softClock>=SOFT){softClock-=SOFT;down(true)}}}
// 用 e.code（實體按鍵位置）判斷，不用 e.key（打出來的字）：
// Mac 開著注音輸入法時，按 A 會得到「ㄇ」而不是「a」，用 e.key 會完全沒反應。
var KEY_CODES={KeyA:'a',KeyD:'d',KeyS:'s',KeyW:'w',KeyL:'l',KeyP:'p',Space:' ',Escape:'escape'};
function keyName(e){return KEY_CODES[e.code]||String(e.key||'').toLowerCase()}
function keyUp(e){var k=keyName(e);if(!keysDown[k])return;delete keysDown[k];if(k==='a'||k==='d'){dir=keysDown.d?1:keysDown.a?-1:0;dasClock=0;arrClock=0}if(k==='s')softClock=0}
function key(e){var k=keyName(e);if(['a','d','s','w','l','p',' ','escape'].indexOf(k)<0)return;e.preventDefault();if(k==='escape'){releaseAll();togglePause();return}if(!running||paused)return;if((k==='a'||k==='d'||k==='s')&&e.repeat)return;if(k==='a'||k==='d'){keysDown[k]=true;dir=k==='a'?-1:1;dasClock=0;arrClock=0;move(dir)}else if(k==='s'){keysDown.s=true;softClock=0;down(true)}else if(k==='w'&&!e.repeat){if(hardDropOn)hardDrop()}else if(k==='l'&&!e.repeat)rotate(-1);else if(k==='p'&&!e.repeat)rotate(1);else if(k===' '&&!e.repeat)holdPiece();draw()}

document.addEventListener('keydown',key);
document.addEventListener('keyup',keyUp);
window.addEventListener('blur',releaseAll);
function setHardDrop(on){hardDropOn=on;$('hardDrop').checked=on;$('hardDropState').textContent=on?'ON':'OFF';$('hardDropKey').classList.toggle('off',!on);try{localStorage.setItem('hardDrop',on?'1':'0')}catch(e){}}
$('hardDrop').onchange=function(){setHardDrop(this.checked);this.blur()};
try{setHardDrop(localStorage.getItem('hardDrop')!=='0')}catch(e){setHardDrop(true)}
$('start').onclick=function(){if(paused)togglePause();else start()};
$('restart').onclick=reset;
$('pause').onclick=togglePause;
document.addEventListener('visibilitychange',function(){if(document.hidden&&running&&!paused)togglePause()});
reset();
})();
