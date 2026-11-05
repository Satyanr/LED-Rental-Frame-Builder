import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { HOLLOW, MAX_FRAMES, MAX_PROJECT_BRACES, LIMIT_POSITION, DEFAULT_SETTINGS, uid, dimension, braceSpacing, braceOffsetsMm, frameMembers, numeric, normalizeDegrees, snapValue, validateProject, makeProject } from './project.js';

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const numberFormat = new Intl.NumberFormat('id-ID',{maximumFractionDigits:3});
const fmt = n => numberFormat.format(Math.abs(n)<0.0000001 ? 0 : n);
const inputNumber = input => input.value.trim() === '' ? NaN : Number(input.value);
const round = n => Math.abs(n)<1e-8 ? 0 : Number(n.toFixed(6));
const inputSpacing = input => braceSpacing(input.value.trim()===''?0:Number(input.value));
let toastTimer;
function toast(message,error=false) {
  clearTimeout(toastTimer); $('toast').textContent=message; $('toast').classList.toggle('error',error); $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,error?6000:3400);
}
function confirmAction(title,message) {
  return new Promise(resolve=>{
    const dialog=$('confirm-dialog'); $('confirm-title').textContent=title; $('confirm-message').textContent=message;
    const done=value=>{dialog.close(); $('confirm-ok').onclick=null; $('confirm-cancel').onclick=null; dialog.oncancel=null;resolve(value);};
    $('confirm-ok').onclick=()=>done(true); $('confirm-cancel').onclick=()=>done(false); dialog.oncancel=e=>{e.preventDefault();done(false);};dialog.showModal();
  });
}
function download(blob,name) {
  const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function main() {
  const stage=$('stage'), viewport=$('viewport');
  let renderer;
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false});
  } catch {
    $('loading').classList.add('error-loading');$('loading').replaceChildren();
    const title=document.createElement('strong');title.textContent='WebGL belum tersedia';
    const detail=document.createElement('p');detail.textContent='Buka dengan Chrome, Edge, atau Firefox terbaru dan aktifkan akselerasi grafis browser. Lalu muat ulang halaman ini.';
    $('loading').append(title,detail); return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0xf0f3ee);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  stage.append(renderer.domElement); const canvas=renderer.domElement;canvas.setAttribute('aria-label','Viewport rangka 3D; klik batang rangka untuk memilih dan geser');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f3ee);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a9981,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,9,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xccdfef,1.5);rim.position.set(-5,3,-4);scene.add(rim);
  const framesRoot=new THREE.Group();scene.add(framesRoot);
  const cube=new THREE.BoxGeometry(1,1,1), cubeEdges=new THREE.EdgesGeometry(cube);
  const objects=new Map();let selected=null;let settings={...DEFAULT_SETTINGS};
  let currentView='iso', orthoSpan=5.5, dirty=true, projectDirty=false, savedFrames='', frameCounter=1;
  let mode='translate', drag=null, gizmoGesture=false, ignoreNextGizmoCommit=false;
  let histories=[], historyIndex=-1;
  const perspective=new THREE.PerspectiveCamera(40,1,0.01,15000);
  const orthographic=new THREE.OrthographicCamera(-3,3,3,-3,0.01,15000);
  let camera=perspective; camera.position.set(4.5,3.5,6);
  const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,0.9,0);orbit.enableDamping=true;orbit.dampingFactor=.12;orbit.minDistance=.12;orbit.maxDistance=3000;orbit.minZoom=.03;orbit.maxZoom=100;
  orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  orbit.addEventListener('change',()=>{dirty=true;});
  orbit.addEventListener('start',()=>{
    currentView='custom';updateViewButtons();
  });
  const transform=new TransformControls(camera,canvas); transform.setSize(.8); transform.setSpace('world');
  const gizmo=transform.getHelper();scene.add(gizmo);
  transform.addEventListener('change',()=>{dirty=true;});
  transform.addEventListener('dragging-changed',e=>{
    orbit.enabled=!e.value;
    if(e.value){gizmoGesture=true;canvas.style.cursor='grabbing';}
    else {canvas.style.cursor='';syncSelected();if(!ignoreNextGizmoCommit)pushHistory();ignoreNextGizmoCommit=false;}
  });
  transform.addEventListener('objectChange',()=>{
    if(!selected)return;
    selected.position.clampScalar(-LIMIT_POSITION,LIMIT_POSITION);syncSelected();syncFields();dirty=true;
  });
  // Exterior envelopes represent the perimeter tubes and optional horizontal braces.
  // All members belong to the same frame group; the openings remain empty.
  function buildFrame(data) {
    const group=new THREE.Group();group.userData.frame={...data,position:[...data.position],rotation:[...data.rotation]};
    const mat=new THREE.MeshStandardMaterial({color:0x8faaa0,metalness:.45,roughness:.36});
    const edgeMat=new THREE.LineBasicMaterial({color:0x587466,transparent:true,opacity:.66});
    group.userData.material=mat;group.userData.edgeMaterial=edgeMat;
    resizeFrame(group,data.width,data.height,data.braceSpacingMm??0);
    group.position.fromArray(data.position);group.rotation.set(...data.rotation.map(THREE.MathUtils.degToRad),'XYZ');
    framesRoot.add(group);objects.set(data.id,group);return group;
  }
  function resizeFrame(group,w,h,spacingMm=group.userData.frame.braceSpacingMm??0) {
    const members=frameMembers(w,h,spacingMm);
    while(group.children.length>members.length)group.remove(group.children[group.children.length-1]);
    while(group.children.length<members.length){
      const mesh=new THREE.Mesh(cube,group.userData.material);mesh.userData.frameRoot=group;mesh.name='beam';
      mesh.add(new THREE.LineSegments(cubeEdges,group.userData.edgeMaterial));group.add(mesh);
    }
    members.forEach((member,i)=>{group.children[i].scale.fromArray(member.size);group.children[i].position.fromArray(member.position);});
    group.userData.frame.width=w;group.userData.frame.height=h;group.userData.frame.braceSpacingMm=spacingMm;dirty=true;
  }
  function disposeFrame(group) {framesRoot.remove(group);group.userData.material.dispose();group.userData.edgeMaterial.dispose();}
  function frameData(group) {
    const f=group.userData.frame;
    return {id:f.id,name:f.name,width:f.width,height:f.height,braceSpacingMm:f.braceSpacingMm??0,position:group.position.toArray().map(round),rotation:[group.rotation.x,group.rotation.y,group.rotation.z].map(v=>round(normalizeDegrees(THREE.MathUtils.radToDeg(v))))};
  }
  function allFrames() {return [...objects.values()].map(frameData);}
  function syncSelected() {if(selected){const f=frameData(selected);selected.userData.frame=f;updateListItem(selected);}}
  const gridRoot=new THREE.Group();scene.add(gridRoot);let gridSize=0;
  function updateGrid() {
    let extent=10;
    for(const g of objects.values()){const f=g.userData.frame;extent=Math.max(extent,Math.abs(g.position.x)+Math.max(f.width,f.height),Math.abs(g.position.z)+Math.max(f.width,f.height));}
    const size=Math.min(1200,Math.ceil(extent/10)*20);
    if(size===gridSize)return;
    for(const g of [...gridRoot.children]){gridRoot.remove(g);g.geometry.dispose();if(Array.isArray(g.material))g.material.forEach(m=>m.dispose());else g.material.dispose();}
    const major=new THREE.GridHelper(size,size,0xbac9ad,0xd3ddca);major.position.y=-.006;gridRoot.add(major);
    // Minor grid stays near the origin, avoiding millions of lines on large projects.
    const minorSize=Math.min(size,40);const minor=new THREE.GridHelper(minorSize,minorSize*10,0xdce3d6,0xe4e9de);minor.position.y=-.009;gridRoot.add(minor);
    const axisPoints=[new THREE.Vector3(-size/2,-.004,0),new THREE.Vector3(size/2,-.004,0),new THREE.Vector3(0,-.003,-size/2),new THREE.Vector3(0,-.003,size/2)];
    const axGeo=new THREE.BufferGeometry().setFromPoints(axisPoints);axGeo.setAttribute('color',new THREE.Float32BufferAttribute([.75,.55,.48,.75,.55,.48,.48,.62,.73,.48,.62,.73],3));gridRoot.add(new THREE.LineSegments(axGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.55})));gridSize=size;
  }
  updateGrid();
  const dimensionRoot=new THREE.Group();scene.add(dimensionRoot);
  const dimensionGeometry=new THREE.BufferGeometry();const dimensionLines=new THREE.LineSegments(dimensionGeometry,new THREE.LineBasicMaterial({color:0x7d9a6d,transparent:true,opacity:.65,depthTest:false}));dimensionLines.renderOrder=3;dimensionRoot.add(dimensionLines);
  const dimensionAnchors=[new THREE.Vector3(),new THREE.Vector3()];
  function updateDimensions() {
    const visible=!!selected&&settings.dimensions;dimensionRoot.visible=visible;
    $('dimension-width').hidden=!visible;$('dimension-height').hidden=!visible;
    if(!visible)return;
    const {width:w,height:h}=selected.userData.frame;const gap=Math.max(.15,Math.min(w,h)*.09),tick=gap*.18;
    const x=-w/2-gap,y=-h/2-gap;const pts=[];
    const line=(a,b)=>pts.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
    line([-w/2,y,0],[w/2,y,0]);line([x,-h/2,0],[x,h/2,0]);
    for(const a of [-w/2,w/2]){line([a,-h/2-gap*.2,0],[a,y-tick*2,0]);line([a-tick,y-tick,0],[a+tick,y+tick,0]);}
    for(const b of [-h/2,h/2]){line([-w/2-gap*.2,b,0],[x-tick*2,b,0]);line([x-tick,b-tick,0],[x+tick,b+tick,0]);}
    dimensionGeometry.setFromPoints(pts);dimensionGeometry.computeBoundingSphere();dimensionRoot.position.copy(selected.position);dimensionRoot.quaternion.copy(selected.quaternion);
    dimensionAnchors[0].set(0,y,0);dimensionAnchors[1].set(x,0,0);
    $('dimension-width').textContent=`${fmt(w)} m`;$('dimension-height').textContent=`${fmt(h)} m`;
  }
  function positionDimensionLabels() {
    if(!dimensionRoot.visible)return;
    dimensionRoot.updateMatrixWorld(true);
    dimensionAnchors.forEach((v,i)=>{
      const p=dimensionRoot.localToWorld(v.clone()).project(camera),el=$(i===0?'dimension-width':'dimension-height');
      el.hidden=p.z < -1 || p.z>1 || Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;
      el.style.left=`${(p.x+1)*stage.clientWidth/2}px`;el.style.top=`${(1-p.y)*stage.clientHeight/2}px`;
    });
  }
  function updateListItem(group) {
    const row=$('object-list').querySelector(`[data-id="${CSS.escape(group.userData.frame.id)}"]`);if(!row)return;
    const f=group.userData.frame;row.querySelector('strong').textContent=f.name;row.querySelector('small').textContent=`${fmt(f.width)} × ${fmt(f.height)} m`;
  }
  function renderList() {
    $('object-list').replaceChildren();let index=0;
    for(const group of objects.values()){
      const f=group.userData.frame;index++;
      const row=document.createElement('button');row.type='button';row.className='object-row';row.dataset.id=f.id;row.setAttribute('role','option');
      const icon=document.createElement('span');icon.className='object-icon';
      const info=document.createElement('span');info.className='object-info';
      const name=document.createElement('strong');name.textContent=f.name;const size=document.createElement('small');size.textContent=`${fmt(f.width)} × ${fmt(f.height)} m`;info.append(name,size);
      const number=document.createElement('span');number.className='object-index';number.textContent=String(index).padStart(2,'0');row.append(icon,info,number);
      row.addEventListener('click',()=>{select(group);if(innerWidth<=800){document.querySelector('.library').classList.remove('panel-open');}});
      $('object-list').append(row);
    }
    $('object-count').textContent=String(objects.size);$('status-count').textContent=`${objects.size} frame`;$('empty-list').hidden=objects.size>0;$('viewport-empty').hidden=objects.size>0;updateSelectionList();
  }
  function updateSelectionList() {for(const row of $('object-list').children){const active=row.dataset.id===selected?.userData.frame.id;row.classList.toggle('active',active);row.setAttribute('aria-selected',String(active));}}
  function select(group) {
    if(selected){selected.userData.material.color.setHex(0x8faaa0);selected.userData.material.emissive.setHex(0);selected.userData.edgeMaterial.color.setHex(0x587466);}
    selected=group||null;transform.detach();
    if(selected){selected.userData.material.color.setHex(0x628f72);selected.userData.material.emissive.setHex(0x0c2110);selected.userData.edgeMaterial.color.setHex(0x356349);transform.attach(selected);}
    $('no-selection').hidden=!!selected;$('selection-controls').hidden=!selected;updateSelectionList();syncFields();updateDimensions();dirty=true;
    $('status-text').textContent=selected?selected.userData.frame.name:'Siap menyusun';
  }
  function syncFields() {
    if(!selected)return;
    const f=frameData(selected);const id=f.name.toUpperCase();$('selected-id').textContent=id.length>24?id.slice(0,24)+'…':id;
    const fields={'frame-name':f.name,'frame-width':round(f.width*1000),'frame-height':round(f.height*1000),'frame-brace-spacing':f.braceSpacingMm};
    ['x','y','z'].forEach((axis,i)=>{fields[`position-${axis}`]=f.position[i];fields[`rotation-${axis}`]=Number(f.rotation[i].toFixed(3));});
    for(const [id,value] of Object.entries(fields)){if(document.activeElement!==$(id))$(id).value=String(value);}
    updateBraceSummary('frame');updateDimensions();
  }
  function contentDigest() {return JSON.stringify({frames:allFrames(),settings});}
  function markEdited() {projectDirty=contentDigest()!==savedFrames;$('save-status').textContent=projectDirty?'Perubahan belum disimpan':'Proyek tersimpan · lokal';}
  function snapshot() {return JSON.stringify({frames:allFrames(),selected:selected?.userData.frame.id||null});}
  function pushHistory() {
    const state=snapshot();
    if(historyIndex>=0&&histories[historyIndex]===state){updateGrid();return;}
    histories=histories.slice(0,historyIndex+1);histories.push(state);
    if(histories.length>80)histories.shift();historyIndex=histories.length-1;
    updateHistoryButtons();markEdited();updateGrid();
  }
  function updateHistoryButtons() {$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=histories.length-1;}
  function replaceFrames(frames,selectedId=null) {
    select(null);for(const g of objects.values())disposeFrame(g);objects.clear();frames.forEach(buildFrame);renderList();select(objects.get(selectedId)||null);updateGrid();dirty=true;
  }
  function restoreHistory(delta) {
    if(drag||transform.dragging)return;
    const next=historyIndex+delta;if(next<0||next>=histories.length)return;historyIndex=next;
    const state=JSON.parse(histories[historyIndex]);replaceFrames(state.frames,state.selected);updateHistoryButtons();markEdited();toast(delta<0?'Perubahan dibatalkan.':'Perubahan dikembalikan.');
  }
  function ensureBraceBudget(height,spacingMm,replace=null) {
    let total=braceOffsetsMm(height,spacingMm).length;
    for(const g of objects.values())if(g!==replace)total+=braceOffsetsMm(g.userData.frame.height,g.userData.frame.braceSpacingMm??0).length;
    if(total>MAX_PROJECT_BRACES)throw new Error(`Maksimal ${MAX_PROJECT_BRACES} hollow tengah dalam satu proyek. Perbesar jarak atau kurangi frame.`);
  }
  function updateBraceSummary(prefix) {
    const el=$(`${prefix}-brace-summary`);
    try{
      const height=inputNumber($(`${prefix}-height`))/1000,spacingMm=inputSpacing($(`${prefix}-brace-spacing`));
      const offsets=braceOffsetsMm(height,spacingMm);
      el.textContent=offsets.length?`${offsets.length} hollow horizontal · ${offsets.length<=4?offsets.map(fmt).join(', ')+' mm dari bawah':'setiap '+fmt(spacingMm)+' mm dari bawah'}`:'Tanpa hollow tengah.';
    }catch{el.textContent='Isi tinggi valid dan jarak 0 atau minimal 100 mm.';}
  }
  function addFrame(position=null) {
    if(objects.size>=MAX_FRAMES){toast(`Maksimal ${MAX_FRAMES} frame per proyek.`,true);return;}
    try {
      const width=dimension(inputNumber($('add-width'))/1000,'Lebar'),height=dimension(inputNumber($('add-height'))/1000,'Tinggi'),spacingMm=inputSpacing($('add-brace-spacing'));
      ensureBraceBudget(height,spacingMm);
      const p=position||[0,height/2,0];
      const group=buildFrame({id:uid(),name:`Frame ${String(frameCounter++).padStart(2,'0')}`,width,height,braceSpacingMm:spacingMm,position:p,rotation:[0,0,0]});
      renderList();select(group);pushHistory();
    if(!position)fitAll(true);toast(`${group.userData.frame.name} ditambahkan${position?' di lantai.':' di titik asal.'}`);
      if(innerWidth<=800)document.querySelector('.library').classList.remove('panel-open');
    }catch(e){toast(e.message,true);}
  }
  function duplicate() {
    if(!selected)return;if(objects.size>=MAX_FRAMES){toast(`Maksimal ${MAX_FRAMES} frame per proyek.`,true);return;}
    try{ensureBraceBudget(selected.userData.frame.height,selected.userData.frame.braceSpacingMm??0);}catch(e){toast(e.message,true);return;}
    const data=frameData(selected);data.id=uid();data.name=`Frame ${String(frameCounter++).padStart(2,'0')}`;
    // A small depth offset makes duplicates individually selectable, without arranging a pattern.
    const offset=data.position[2]+.15<=LIMIT_POSITION ? .15 : -.15;data.position[2]=round(data.position[2]+offset);
    const group=buildFrame(data);renderList();select(group);pushHistory();toast(`Frame diduplikat dengan offset Z ${offset>0?'+':'−'}0,15 m.`);
  }
  function removeSelected() {if(!selected)return;const id=selected.userData.frame.id;const group=selected;select(null);disposeFrame(group);objects.delete(id);renderList();pushHistory();toast('Frame dihapus. Ctrl+Z untuk mengembalikan.');}
  function applySelectedChange(callback) {
    if(!selected)return;
    try{callback();syncSelected();syncFields();pushHistory();dirty=true;}catch(e){toast(e.message,true);const active=document.activeElement;active?.blur();syncFields();}
  }
  function setMode(value) {
    if(drag||transform.dragging)return;mode=value;transform.setMode(value);$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===value));dirty=true;
  }
  function updateSettings() {
    settings={snap:$('snap-enabled').checked,positionStep:Number($('snap-position').value),rotationStep:Number($('snap-rotation').value),grid:$('grid-enabled').checked,dimensions:$('dimensions-enabled').checked,space:$('transform-space').value};
    transform.setTranslationSnap(settings.snap?settings.positionStep:null);transform.setRotationSnap(settings.snap?THREE.MathUtils.degToRad(settings.rotationStep):null);transform.setSpace(settings.space);gridRoot.visible=settings.grid;updateDimensions();if(savedFrames)markEdited();dirty=true;
  }
  function applySettings() {
    $('snap-enabled').checked=settings.snap;$('snap-position').value=String(settings.positionStep);$('snap-rotation').value=String(settings.rotationStep);$('grid-enabled').checked=settings.grid;$('dimensions-enabled').checked=settings.dimensions;$('transform-space').value=settings.space;updateSettings();
  }
  function measureScene() {
    const box=new THREE.Box3();for(const g of objects.values()){g.updateMatrixWorld(true);box.union(new THREE.Box3().setFromObject(g));}
    if(box.isEmpty())box.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));return box;
  }
  function resize() {
    const width=Math.max(stage.clientWidth,1),height=Math.max(stage.clientHeight,1),aspect=width/height;
    renderer.setSize(width,height,false);perspective.aspect=aspect;perspective.updateProjectionMatrix();
    orthographic.left=-orthoSpan*aspect/2;orthographic.right=orthoSpan*aspect/2;orthographic.top=orthoSpan/2;orthographic.bottom=-orthoSpan/2;orthographic.updateProjectionMatrix();dirty=true;
  }
  function useCamera(next) {camera=next;orbit.object=camera;transform.camera=camera;orbit.update();resize();}
  function updateViewButtons() {
    const names={front:'FRONT',back:'BACK',left:'LEFT',right:'RIGHT',top:'TOP',iso:'ISOMETRIC',custom:'ORBIT'};
    $('view-name').textContent=names[currentView];$('projection-name').textContent=camera.isOrthographicCamera?'ORTHOGRAPHIC':'PERSPECTIVE';$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
  }
  function fitAll(keepDirection=true) {
    const box=measureScene(),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const direction=keepDirection?camera.position.clone().sub(orbit.target).normalize():new THREE.Vector3(1.1,.7,1.5).normalize();
    if(direction.lengthSq()<.01)direction.set(1,.7,1).normalize();
    const radius=Math.max(size.length()/2,.3),aspect=Math.max(stage.clientWidth/Math.max(stage.clientHeight,1),.15);
    orbit.target.copy(center);
    if(camera.isPerspectiveCamera){const halfAngle=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*aspect));camera.position.copy(center).addScaledVector(direction,radius/Math.sin(halfAngle)*1.55);}
    else {
      camera.position.copy(center).addScaledVector(direction,Math.max(radius*4,10));camera.lookAt(center);camera.updateMatrixWorld(true);
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      const horizontal=Math.abs(right.x)*size.x+Math.abs(right.y)*size.y+Math.abs(right.z)*size.z;
      const vertical=Math.abs(up.x)*size.x+Math.abs(up.y)*size.y+Math.abs(up.z)*size.z;
      orthoSpan=Math.max(vertical,horizontal/aspect,.7)*1.7;camera.zoom=1;
    }
    orbit.update();resize();dirty=true;
  }
  function setView(view) {
    if(drag||transform.dragging)return;
    orbit.enableDamping=false;orbit.update();
    currentView=view;const center=measureScene().getCenter(new THREE.Vector3());
    const directions={front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,0],iso:[1.1,.7,1.5]};
    const next=view==='iso'?perspective:orthographic;next.up.set(0,1,0);if(view==='top')next.up.set(0,0,-1);
    orbit.target.copy(center);next.position.copy(center).add(new THREE.Vector3(...directions[view]).multiplyScalar(10));next.lookAt(center);
    useCamera(next);fitAll(true);orbit.enableDamping=true;updateViewButtons();
  }
  function cameraData() {return {view:currentView,type:camera.isOrthographicCamera?'orthographic':'perspective',position:camera.position.toArray(),target:orbit.target.toArray(),up:camera.up.toArray(),span:orthoSpan/camera.zoom};}
  function restoreCamera(c) {
    if(!c){setView('iso');return;}orbit.enableDamping=false;orbit.update();currentView=c.view;orthoSpan=c.span;
    const next=c.type==='orthographic'?orthographic:perspective;next.zoom=1;next.up.fromArray(c.up);next.position.fromArray(c.position);orbit.target.fromArray(c.target);next.lookAt(orbit.target);useCamera(next);orbit.enableDamping=true;updateViewButtons();
  }
  // The capture listener owns direct object drags, so OrbitControls never starts
  // an orbit for the same gesture. Gizmo hits retain TransformControls ownership.
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function setRay(clientX,clientY) {
    const rect=canvas.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
  }
  function hitFrame(event) {setRay(event.clientX,event.clientY);framesRoot.updateMatrixWorld(true);return raycaster.intersectObjects([...objects.values()],true).find(h=>h.object.name==='beam')?.object.userData.frameRoot||null;}
  function hitGizmo(event) {
    if(!selected)return false;setRay(event.clientX,event.clientY);gizmo.updateMatrixWorld(true);
    const picker=gizmo.children.find(c=>c.type==='TransformControlsGizmo')?.picker?.[mode];
    // Use the public helper's runtime picker; it belongs to the pinned Three.js version.
    if(!picker)return transform.axis!==null;
    return raycaster.intersectObject(picker,true).some(h=>h.object.visible);
  }
  canvas.addEventListener('pointerdown',event=>{
    if(drag){event.stopImmediatePropagation();event.preventDefault();return;}
    if(event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||transform.dragging)return;
    if(hitGizmo(event)){orbit.enabled=false;return;}
    const hit=hitFrame(event);
    if(!hit)return;
    event.stopImmediatePropagation();event.preventDefault();select(hit);
    if(mode==='rotate')return;
    setRay(event.clientX,event.clientY);const normal=camera.getWorldDirection(new THREE.Vector3());const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.position);const start=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
    orbit.enabled=false;canvas.style.cursor='grabbing';
    drag={id:event.pointerId,group:hit,plane,start,origin:hit.position.clone(),x:event.clientX,y:event.clientY,moved:false};
    canvas.setPointerCapture(event.pointerId);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!drag){if(!transform.dragging&&event.pointerType!=='touch')canvas.style.cursor=hitFrame(event)?(mode==='translate'?'grab':'pointer'):'';return;}
    if(event.pointerId!==drag.id)return;event.stopImmediatePropagation();event.preventDefault();
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3&&!drag.moved)return;drag.moved=true;
    setRay(event.clientX,event.clientY);const p=raycaster.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!p)return;
    p.sub(drag.start).add(drag.origin);if(settings.snap)p.set(...p.toArray().map(n=>snapValue(n,settings.positionStep)));p.clampScalar(-LIMIT_POSITION,LIMIT_POSITION);
    drag.group.position.copy(p);syncSelected();syncFields();dirty=true;
  },true);
  function endDirectDrag(cancel=false) {
    if(!drag)return;const d=drag;drag=null;
    if(cancel)d.group.position.copy(d.origin);
    if(canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);
    orbit.enabled=true;canvas.style.cursor='';syncSelected();syncFields();if(!cancel&&d.moved)pushHistory();dirty=true;
  }
  canvas.addEventListener('pointerup',event=>{
    if(drag&&event.pointerId===drag.id){event.stopImmediatePropagation();endDirectDrag();return;}
    if(gizmoGesture){gizmoGesture=false;return;}
    if(!transform.dragging)orbit.enabled=true;
  },true);
  function cancelGizmo() {if(transform.dragging){ignoreNextGizmoCommit=true;transform.reset();transform.dragging=false;transform.axis=null;orbit.enabled=true;gizmoGesture=false;canvas.style.cursor='';}}
  canvas.addEventListener('pointercancel',()=>{endDirectDrag(true);cancelGizmo();},true);
  canvas.addEventListener('lostpointercapture',()=>{if(drag)endDirectDrag(true);});
  window.addEventListener('blur',()=>{endDirectDrag(true);cancelGizmo();});
  // A plain background click clears selection, while a background drag orbits.
  let backgroundPress=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&!hitGizmo(e)&&!hitFrame(e))backgroundPress=[e.clientX,e.clientY];},false);
  canvas.addEventListener('pointerup',e=>{if(backgroundPress&&Math.hypot(e.clientX-backgroundPress[0],e.clientY-backgroundPress[1])<3&&!gizmoGesture)select(null);backgroundPress=null;},false);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  const palette=$('frame-palette');let paletteDrag=false;
  palette.addEventListener('dragstart',event=>{
    try{dimension(inputNumber($('add-width'))/1000);const height=dimension(inputNumber($('add-height'))/1000);ensureBraceBudget(height,inputSpacing($('add-brace-spacing')));}catch(e){event.preventDefault();toast(e.message,true);return;}
    paletteDrag=true;event.dataTransfer.setData('application/x-led-frame','new-frame');event.dataTransfer.effectAllowed='copy';$('drop-overlay').hidden=false;
  });
  palette.addEventListener('dragend',()=>{paletteDrag=false;$('drop-overlay').hidden=true;});
  viewport.addEventListener('dragover',e=>{if(paletteDrag){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  viewport.addEventListener('drop',event=>{
    event.preventDefault();$('drop-overlay').hidden=true;if(!paletteDrag)return;paletteDrag=false;
    setRay(event.clientX,event.clientY);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!point||Math.abs(raycaster.ray.direction.y)<.025){toast('Penempatan di lantai memerlukan tampilan Iso atau Top. Pilih salah satu, lalu seret kembali.',true);return;}
    let {x,z}=point;if(settings.snap){x=snapValue(x,settings.positionStep);z=snapValue(z,settings.positionStep);}
    if(Math.abs(x)>LIMIT_POSITION||Math.abs(z)>LIMIT_POSITION){toast('Titik penempatan di luar batas ±500 meter.',true);return;}
    addFrame([x,inputNumber($('add-height'))/2000,z]);
  });
  $('add-form').addEventListener('submit',e=>{e.preventDefault();addFrame();});
  $('frame-name').addEventListener('change',()=>applySelectedChange(()=>{selected.userData.frame.name=$('frame-name').value.trim()||'Frame';$('frame-name').value=selected.userData.frame.name;$('status-text').textContent=selected.userData.frame.name;}));
  for(const field of ['width','height'])$(`frame-${field}`).addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;const value=dimension(inputNumber($(`frame-${field}`))/1000,field==='width'?'Lebar':'Tinggi');
    const w=field==='width'?value:f.width,h=field==='height'?value:f.height;ensureBraceBudget(h,f.braceSpacingMm??0,selected);resizeFrame(selected,w,h);
  }));
  $('frame-brace-spacing').addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame,spacingMm=inputSpacing($('frame-brace-spacing'));ensureBraceBudget(f.height,spacingMm,selected);resizeFrame(selected,f.width,f.height,spacingMm);
  }));
  ['add-height','add-brace-spacing'].forEach(id=>$(id).addEventListener('input',()=>updateBraceSummary('add')));
  for(const axis of ['x','y','z']){
    $(`position-${axis}`).addEventListener('change',()=>applySelectedChange(()=>{selected.position[axis]=numeric(inputNumber($(`position-${axis}`)),-LIMIT_POSITION,LIMIT_POSITION,'Posisi (meter)');}));
    $(`rotation-${axis}`).addEventListener('change',()=>applySelectedChange(()=>{selected.rotation[axis]=THREE.MathUtils.degToRad(normalizeDegrees(numeric(inputNumber($(`rotation-${axis}`)),-36000,36000,'Rotasi (derajat)')));}));
  }
  $$('[data-rotate]').forEach(button=>button.addEventListener('click',()=>applySelectedChange(()=>{
    const axis=new THREE.Vector3(button.dataset.rotate==='x'?1:0,button.dataset.rotate==='y'?1:0,button.dataset.rotate==='z'?1:0);
    if(settings.space==='world')selected.rotateOnWorldAxis(axis,Math.PI/2);else selected.rotateOnAxis(axis,Math.PI/2);
  })));
  $('ground-frame').addEventListener('click',()=>applySelectedChange(()=>{selected.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(selected);const y=selected.position.y-box.min.y;numeric(y,-LIMIT_POSITION,LIMIT_POSITION,'Posisi Y');selected.position.y=y;}));
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  ['snap-enabled','snap-position','snap-rotation','grid-enabled','dimensions-enabled','transform-space'].forEach(id=>$(id).addEventListener('change',updateSettings));
  $('fit-all').addEventListener('click',()=>fitAll());$('duplicate').addEventListener('click',duplicate);$('delete').addEventListener('click',removeSelected);
  $('undo').addEventListener('click',()=>restoreHistory(-1));$('redo').addEventListener('click',()=>restoreHistory(1));
  $('save-project').addEventListener('click',()=>{
    const project=makeProject(allFrames(),settings,cameraData());const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`led-frame-project-${date}.json`);savedFrames=contentDigest();markEdited();toast('JSON proyek diekspor ke folder unduhan.');
  });
  $('load-project').addEventListener('click',()=>$('project-file').click());
  $('project-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('File JSON maksimal 5 MB.');
      let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('File bukan JSON yang valid.');}
      const project=validateProject(parsed);
      if(projectDirty&&!await confirmAction('Muat proyek?', 'Proyek saat ini memiliki perubahan yang belum disimpan. Memuat file akan menggantinya. Simpan JSON terlebih dahulu bila masih diperlukan.'))return;
      replaceFrames(project.frames,project.frames[0]?.id);settings=project.settings;applySettings();restoreCamera(project.camera);frameCounter=project.frames.length+1;
      histories=[];historyIndex=-1;savedFrames=contentDigest();pushHistory();toast(`${objects.size} frame berhasil dimuat.`);
    } catch(e){toast(e.message||'Gagal membaca proyek.',true);}
  });
  $('new-project').addEventListener('click',async()=>{
    if(objects.size&&!await confirmAction('Buat proyek kosong?', 'Semua frame akan dikeluarkan dari area kerja. Anda dapat mengembalikannya dengan Undo. Simpan JSON terlebih dahulu jika diperlukan.'))return;
    replaceFrames([]);pushHistory();frameCounter=1;setView('iso');toast('Proyek kosong siap.');
  });
  $('export-png').addEventListener('click',async()=>{
    if(drag||transform.dragging)return;
    const button=$('export-png');button.disabled=true;
    try {
      const old=gizmo.visible;gizmo.visible=false;renderer.render(scene,camera);
      const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const ctx=output.getContext('2d');if(!ctx)throw new Error('Tidak dapat membuat PNG.');ctx.drawImage(canvas,0,0);
      const scale=canvas.width/stage.clientWidth;ctx.scale(scale,scale);
      if(dimensionRoot.visible){positionDimensionLabels();for(const id of ['dimension-width','dimension-height']){const el=$(id);if(el.hidden)continue;const x=parseFloat(el.style.left),y=parseFloat(el.style.top);ctx.font='12px Consolas, monospace';const width=ctx.measureText(el.textContent).width+14;ctx.fillStyle='#f6f9f0';ctx.fillRect(x-width/2,y-10,width,20);ctx.strokeStyle='#bdcfb4';ctx.strokeRect(x-width/2,y-10,width,20);ctx.fillStyle='#3f6854';ctx.textAlign='center';ctx.fillText(el.textContent,x,y+4);}}
      ctx.font='11px Segoe UI, sans-serif';ctx.fillStyle='#748b69';ctx.textAlign='left';ctx.fillText('LED Rental Frame Builder  /  Hollow 40 × 40 mm  /  Meter',18,stage.clientHeight-17);
      gizmo.visible=old;dirty=true;
      const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw new Error('Ekspor PNG gagal.');download(blob,'led-frame-structure.png');toast('PNG tampilan 3D berhasil diekspor.');
    }catch(e){gizmo.visible=!!selected;dirty=true;toast(e.message,true);}finally{button.disabled=false;}
  });
  $('help').addEventListener('click',()=>$('help-dialog').showModal());$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('toggle-library').addEventListener('click',()=>{document.querySelector('.inspector').classList.remove('panel-open');document.querySelector('.library').classList.toggle('panel-open');});
  $('toggle-inspector').addEventListener('click',()=>{document.querySelector('.library').classList.remove('panel-open');document.querySelector('.inspector').classList.toggle('panel-open');});
  window.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    const editing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    const modifier=event.ctrlKey||event.metaKey;
    if(modifier&&event.key.toLowerCase()==='s'){event.preventDefault();document.activeElement?.blur();$('save-project').click();return;}
    if(editing)return;
    if(event.key==='Escape'){
      if(drag)endDirectDrag(true);
      else if(transform.dragging)cancelGizmo();
      else select(null);
      document.querySelectorAll('.panel-open').forEach(el=>el.classList.remove('panel-open'));return;
    }
    if(drag||transform.dragging)return;
    if(modifier&&event.key.toLowerCase()==='d'){event.preventDefault();duplicate();return;}
    if(modifier&&event.key.toLowerCase()==='z'){event.preventDefault();restoreHistory(event.shiftKey?1:-1);return;}
    if(modifier&&event.key.toLowerCase()==='y'){event.preventDefault();restoreHistory(1);return;}
    if(modifier||event.altKey)return;
    if(event.key.toLowerCase()==='w')setMode('translate');if(event.key.toLowerCase()==='e')setMode('rotate');if(event.key.toLowerCase()==='f')fitAll();if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();}
  });
  window.addEventListener('beforeunload',event=>{if(projectDirty){event.preventDefault();event.returnValue='';}});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();toast('Konteks grafis terhenti. Simpan JSON, lalu muat ulang halaman.',true);});
  canvas.addEventListener('webglcontextrestored',()=>{dirty=true;toast('Area 3D kembali aktif.');});
  let lastStageWidth=0,lastStageHeight=0;
  new ResizeObserver(()=>{
    const width=stage.clientWidth,height=stage.clientHeight;
    const changed=lastStageWidth>0&&(width!==lastStageWidth||height!==lastStageHeight);
    lastStageWidth=width;lastStageHeight=height;resize();if(changed)fitAll(true);
  }).observe(stage);window.addEventListener('resize',resize);
  const first=buildFrame({id:uid(),name:'Frame 01',width:1,height:2,braceSpacingMm:0,position:[0,1,0],rotation:[0,0,0]});frameCounter=2;renderList();select(first);updateBraceSummary('add');applySettings();setView('iso');savedFrames=contentDigest();pushHistory();$('save-status').textContent='Contoh 1000 × 2000 mm · siap disusun';$('loading').hidden=true;
  function render() {requestAnimationFrame(render);orbit.update();if(dirty){renderer.render(scene,camera);positionDimensionLabels();dirty=false;}}
  render();
}
try{main();}catch(error){console.error(error);$('loading').hidden=false;$('loading').classList.add('error-loading');$('loading').textContent=`Area 3D gagal dimulai: ${error.message}. Pastikan app.bundle.js berada di folder yang sama dengan index.html, lalu muat ulang.`;}
