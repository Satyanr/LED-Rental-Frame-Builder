import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { HOLLOW, BALLAST_PRESETS, MAX_FRAMES, MAX_PROJECT_BRACES, LIMIT_POSITION, DEFAULT_SETTINGS, uid, dimension, braceSpacing, braceOffsetsMm, objectMembers, objectSummary, objectLabel, isBallast, isJerrycan, isTubeTarget, validateTie, tubeAnchor, validateBallastTemplate, validateFrameTemplate, validateLedTemplate, numeric, normalizeDegrees, snapValue, validateProject, makeProject, cloneObjects } from './project.js';
import { memberGeometry, fitMeshesToDimensions, concreteTexture, tieVisualPoints } from './geometry.js';
import { isWheel, hasDepth, isCustomGeometry, RIGGING_DEPTH, validateWheelTemplate, validateRiggingTemplate } from './project.js';
import { wheelMountPose, mergedMemberGeometry } from './geometry.js';
import { isCloth, isRiggingSegment, validateCloth, validateClothPin, validateClothTemplate, defaultClothCorners } from './project.js';
import { clothGeometry, clothPinnedCorners } from './geometry.js';

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
  stage.append(renderer.domElement); const canvas=renderer.domElement;canvas.setAttribute('aria-label','Viewport 3D; klik objek untuk memilih dan geser');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f3ee);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a9981,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,9,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xccdfef,1.5);rim.position.set(-5,3,-4);scene.add(rim);
  const framesRoot=new THREE.Group();scene.add(framesRoot);
  const tiesRoot=new THREE.Group();scene.add(tiesRoot);const tieMeshes=new Map();
  const tieMaterial=new THREE.MeshStandardMaterial({color:0xc39b57,roughness:1});
  const cube=new THREE.BoxGeometry(1,1,1), cubeEdges=new THREE.EdgesGeometry(cube);
  const objects=new Map();let selected=null;let settings={...DEFAULT_SETTINGS};let lastSummary='';
  const selection=new Set(),selectionProxy=new THREE.Object3D();scene.add(selectionProxy);
  const selectionBounds=new THREE.Box3(),selectionOutline=new THREE.Box3Helper(selectionBounds,0x69964f);scene.add(selectionOutline);selectionOutline.visible=false;
  const clothHandles=new THREE.Group();scene.add(clothHandles);clothHandles.visible=false;
  const handleGeometry=new THREE.SphereGeometry(1,12,8);
  for(let i=0;i<4;i++){const mesh=new THREE.Mesh(handleGeometry,new THREE.MeshBasicMaterial({color:0x4d9467,depthTest:false}));mesh.userData.corner=i;mesh.renderOrder=10;clothHandles.add(mesh);}
  let clothEditing=false,clothCorner=0,clothPickingCorner=null,clothPickingSide=1;
  let proxyMatrix=new THREE.Matrix4(),clipboard=[],pasteCount=0;
  let currentView='iso', orthoSpan=5.5, dirty=true, projectDirty=false, savedFrames='', frameCounter=1;
  let mode='translate', drag=null, gizmoGesture=false, ignoreNextGizmoCommit=false;
  let histories=[], historyIndex=-1;
  let tiePicking=null;
  let paletteType='frame', frameShape='rectangle', accessoryKind='ballast';
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
    if(selection.size>1){try{applyProxyDelta();}catch(e){toast(e.message,true);}}else selected.position.clampScalar(-LIMIT_POSITION,LIMIT_POSITION);
    syncSelected();syncFields();dirty=true;
  });
  // Exterior envelopes represent the perimeter tubes and optional horizontal braces.
  // All members belong to the same frame group; the openings remain empty.
  function buildFrame(data,register=true) {
    const group=new THREE.Group();group.userData.frame={...data,...(isCloth(data)?validateCloth(data):{}),position:[...data.position],rotation:[...data.rotation]};
    const isLed=data.type==='led',ballast=isBallast(data),concrete=ballast&&data.ballastKind==='concrete-block',metalAccessory=isWheel(data)||data.type==='rigging';
    const baseColor=isCloth(data)?group.userData.frame.clothColor:metalAccessory?0xb5bdc4:ballast?(concrete?0xa4a397:0x267ca1):isLed?0x202b35:0x8faaa0;
    const mat=new THREE.MeshStandardMaterial({color:baseColor,metalness:ballast?0:.45,roughness:ballast?(concrete?1:.65):.36});
    const edgeMat=new THREE.LineBasicMaterial({color:ballast?0x66675d:isLed?0x718594:0x587466,transparent:true,opacity:isLed ? .9 : .66});
    group.userData.baseColor=baseColor;
    group.userData.material=mat;group.userData.edgeMaterial=edgeMat;
    if(isCloth(data)){mat.side=THREE.DoubleSide;mat.metalness=0;mat.roughness=1;}
    if(isLed)group.userData.screenMaterial=new THREE.MeshBasicMaterial({color:0x203c55});
    if(metalAccessory){mat.metalness=.72;mat.roughness=.32;group.userData.detailMaterials={rubber:new THREE.MeshStandardMaterial({color:0x242a2e,roughness:.9}),hub:new THREE.MeshStandardMaterial({color:0x828d98,metalness:.65,roughness:.35})};}
    if(ballast){
      group.userData.detailMaterials={rope:new THREE.MeshStandardMaterial({color:0xd2b57d,roughness:1}),cap:new THREE.MeshStandardMaterial({color:0x153d52,roughness:.8}),rib:new THREE.MeshStandardMaterial({color:0x246c8a,roughness:.7})};
      if(concrete)mat.map=concreteTexture();
    }
    try{
      resizeFrame(group,data.width,data.height,data.braceSpacingMm??0);
      group.position.fromArray(data.position);group.rotation.set(...data.rotation.map(THREE.MathUtils.degToRad),'XYZ');
      if(register){framesRoot.add(group);objects.set(data.id,group);}return group;
    }catch(e){disposeFrame(group);throw e;}
  }
  function clearBallastMeshes(group) {
    for(const mesh of [...group.children]){mesh.geometry.dispose();group.remove(mesh);}
  }
  function updateClothMesh(group) {
    const f=group.userData.frame,signature=JSON.stringify([f.clothCorners,f.clothSag]);
    if(signature!==group.userData.clothSignature){
      const geometry=clothGeometry(f);clearBallastMeshes(group);const mesh=new THREE.Mesh(geometry,group.userData.material);mesh.name='beam';mesh.userData.frameRoot=group;group.add(mesh);group.userData.clothSignature=signature;
    }
    group.userData.baseColor=f.clothColor;group.userData.material.color.set(f.clothColor);dirty=true;
  }
  function resizeFrame(group,w,h,spacingMm=group.userData.frame.braceSpacingMm??0,depth=group.userData.frame.depth) {
    const f=group.userData.frame;
    if(isCloth(f)){
      dimension(w,'Lebar kain');dimension(h,'Tinggi kain');
      const corners=f.clothCorners.map(p=>[p[0]*w/f.width,p[1]*h/f.height,p[2]]),next=validateCloth({...f,width:w,height:h,clothCorners:corners});
      Object.assign(f,next,{width:w,height:h});updateClothMesh(group);return;
    }
    const members=objectMembers({...f,width:w,height:h,braceSpacingMm:spacingMm,depth});
    if(isCustomGeometry(f)){
      clearBallastMeshes(group);
      if(f.type==='rigging'){
        const mesh=new THREE.Mesh(mergedMemberGeometry(members),group.userData.material);
        mesh.userData.frameRoot=group;mesh.name='beam';group.add(mesh);
      }else for(const member of members){
        const mesh=new THREE.Mesh(memberGeometry(member),group.userData.detailMaterials[member.surface]??group.userData.material);
        mesh.position.fromArray(member.position??[0,0,0]);mesh.userData.frameRoot=group;mesh.name='beam';group.add(mesh);
      }
      fitMeshesToDimensions(group.children,[w,h,f.type==='rigging'?RIGGING_DEPTH:depth]);
      f.width=w;f.height=h;if(hasDepth(f))f.depth=depth;f.braceSpacingMm=0;dirty=true;return;
    }
    while(group.children.length>members.length)group.remove(group.children[group.children.length-1]);
    while(group.children.length<members.length){
      const mesh=new THREE.Mesh(cube,group.userData.material);mesh.userData.frameRoot=group;mesh.name='beam';
      mesh.add(new THREE.LineSegments(cubeEdges,group.userData.edgeMaterial));group.add(mesh);
    }
    members.forEach((member,i)=>{const mesh=group.children[i];mesh.userData.memberIndex=i;mesh.scale.fromArray(member.size);mesh.position.fromArray(member.position);mesh.material=member.surface==='screen'?group.userData.screenMaterial:group.userData.material;mesh.children[0].visible=member.surface!=='screen';});
    f.width=w;f.height=h;f.braceSpacingMm=spacingMm;
    if(!f.type||f.type==='frame'){f.type='frame';f.shape=w===h?'square':'rectangle';}
    dirty=true;
  }
  function disposeFrame(group) {framesRoot.remove(group);if(isCustomGeometry(group.userData.frame))clearBallastMeshes(group);group.userData.material.map?.dispose();group.userData.material.dispose();group.userData.edgeMaterial.dispose();group.userData.screenMaterial?.dispose();Object.values(group.userData.detailMaterials??{}).forEach(m=>m.dispose());}
  function frameData(group) {
    const f=group.userData.frame;
    return {id:f.id,name:f.name,type:f.type??'frame',locked:f.locked??false,...(f.groupId?{groupId:f.groupId}:{}),...(f.tie?{tie:{...f.tie}}:{}),...(f.mount?{mount:{...f.mount}}:{}),...(f.type==='frame'?{shape:f.shape}:{}),...(f.type==='rigging'?{riggingKind:isRiggingSegment(f)?'segment':'legacy-frame'}:{}),...(isCloth(f)?validateCloth(f):{}),...(hasDepth(f)?{depth:f.depth}:{}),...(isBallast(f)?{ballastKind:f.ballastKind}:{}),width:f.width,height:f.height,braceSpacingMm:f.braceSpacingMm??0,position:group.position.toArray().map(round),rotation:[group.rotation.x,group.rotation.y,group.rotation.z].map(v=>round(normalizeDegrees(THREE.MathUtils.radToDeg(v))))};
  }
  function allFrames() {return [...objects.values()].map(frameData);}
  function syncMountedWheels() {
    for(const group of objects.values()){
      const f=group.userData.frame,target=objects.get(f.mount?.targetId);if(!isWheel(f)||!target)continue;
      try{const pose=wheelMountPose(f,frameData(target));group.position.fromArray(pose.position);group.rotation.set(...pose.rotation.map(THREE.MathUtils.degToRad),'XYZ');group.userData.frame=frameData(group);}catch{delete f.mount;}
    }
  }
  function syncCloths() {
    const data=new Map([...objects.values()].filter(g=>isTubeTarget(g.userData.frame)).map(g=>[g.userData.frame.id,frameData(g)]));
    for(const group of objects.values())if(isCloth(group.userData.frame)){
      const f=group.userData.frame;f.clothCorners=clothPinnedCorners(frameData(group),data);updateClothMesh(group);
    }
  }
  function syncSelected() {syncMountedWheels();syncCloths();for(const group of selection){group.userData.frame=frameData(group);updateListItem(group);}}
  const transformTarget=()=>selection.size>1?selectionProxy:selected;
  const selectionLocked=()=>[...selection].some(g=>g.userData.frame.locked||(g.userData.frame.mount&&!selection.has(objects.get(g.userData.frame.mount.targetId))));
  function resetProxy() {
    const box=new THREE.Box3();for(const g of selection){g.updateMatrixWorld(true);box.union(new THREE.Box3().setFromObject(g));}
    if(!box.isEmpty())selectionProxy.position.copy(box.getCenter(new THREE.Vector3()));
    selectionProxy.quaternion.identity();selectionProxy.updateMatrix();proxyMatrix.copy(selectionProxy.matrix);
  }
  function updateSelectionOutline() {
    selectionOutline.visible=selection.size>1;if(!selectionOutline.visible)return;
    selectionBounds.makeEmpty();for(const g of selection){g.updateMatrixWorld(true);selectionBounds.union(new THREE.Box3().setFromObject(g));}
  }
  function applyProxyDelta() {
    selectionProxy.updateMatrix();const delta=new THREE.Matrix4().multiplyMatrices(selectionProxy.matrix,proxyMatrix.clone().invert());
    try{
      const poses=[...selection].map(g=>{
        g.updateMatrix();const matrix=new THREE.Matrix4().multiplyMatrices(delta,g.matrix),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,quaternion,scale);
        if(position.toArray().some(n=>!Number.isFinite(n)||Math.abs(n)>LIMIT_POSITION))throw new Error('Pilihan melewati batas posisi ±500 meter.');
        return {g,position,quaternion};
      });
      for(const {g,position,quaternion} of poses){g.position.copy(position);g.quaternion.copy(quaternion);}
      proxyMatrix.copy(selectionProxy.matrix);
    }catch(e){proxyMatrix.decompose(selectionProxy.position,selectionProxy.quaternion,selectionProxy.scale);selectionProxy.updateMatrix();throw e;}
  }
  function reconcileTies() {
    for(const group of objects.values()){
      const f=group.userData.frame;if(!f.tie)continue;
      const target=objects.get(f.tie.targetId);
      try{if(!target)throw new Error();tubeAnchor(target.userData.frame,f.tie);}catch{delete f.tie;}
    }
    for(const group of objects.values()){
      const f=group.userData.frame;if(!f.mount)continue;
      try{const target=objects.get(f.mount.targetId);if(!target)throw new Error();tubeAnchor(target.userData.frame,f.mount);}catch{delete f.mount;}
    }
    for(const group of objects.values())if(isCloth(group.userData.frame)){
      const f=group.userData.frame;f.clothPins=f.clothPins.map(pin=>{
        if(!pin)return null;try{const target=objects.get(pin.targetId);if(!target)throw new Error();tubeAnchor(target.userData.frame,pin);return pin;}catch{return null;}
      });
    }
    syncMountedWheels();syncCloths();
  }
  function removeTieMesh(id) {
    const entry=tieMeshes.get(id);if(!entry)return;
    entry.group.children.forEach(mesh=>mesh.geometry.dispose());tiesRoot.remove(entry.group);tieMeshes.delete(id);
  }
  function updateTies() {
    const active=new Set();
    for(const group of objects.values()){
      const source=frameData(group),target=objects.get(source.tie?.targetId);if(!target)continue;
      active.add(source.id);const points=tieVisualPoints(source,frameData(target)),signature=JSON.stringify(points);
      if(tieMeshes.get(source.id)?.signature===signature)continue;
      removeTieMesh(source.id);const visual=new THREE.Group();visual.userData.sourceId=source.id;
      for(const member of [{geometry:'rope',points:[points.start,points.end],radius:.005},{geometry:'rope',points:points.loop,radius:.005,closed:true}])visual.add(new THREE.Mesh(memberGeometry(member),tieMaterial));
      tiesRoot.add(visual);tieMeshes.set(source.id,{group:visual,signature});
    }
    for(const id of tieMeshes.keys())if(!active.has(id))removeTieMesh(id);
  }
  function setTiePicking(sourceId=null,corner=null) {
    if(sourceId&&corner!==null)clothPickingSide=Number($('cloth-pin-side').value);
    clothPickingCorner=sourceId?corner:null;
    tiePicking=sourceId;$('tie-pick-banner').hidden=!sourceId;canvas.style.cursor=sourceId?'crosshair':'';
    if(sourceId){transform.detach();document.querySelectorAll('.panel-open').forEach(el=>el.classList.remove('panel-open'));}
    $('tie-pick-banner').querySelector('span').textContent=corner!==null&&sourceId?`Klik hollow untuk sudut kain ${corner+1}. Esc untuk batal.`:sourceId&&isWheel(objects.get(sourceId)?.userData.frame??{})?'Klik batang hollow untuk dudukan roda. Esc untuk batal.':'Klik batang hollow tujuan tali. Esc untuk batal.';
    syncLockControls();syncTieControls();syncClothControls();dirty=true;
  }
  function memberLabel(target,index) {
    if(target.type==='hollow')return 'Batang hollow lurus';
    return ['Hollow atas','Hollow bawah','Hollow kanan','Hollow kiri'][index]??`Hollow tengah ${index-3} · ${fmt(braceOffsetsMm(target.height,target.braceSpacingMm)[index-4])} mm dari bawah`;
  }
  function fillOptions(select,options,value) {
    const key=JSON.stringify(options);if(select.dataset.options!==key){select.replaceChildren(...options.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));select.dataset.options=key;}
    select.value=String(value);
  }
  function syncTieControls() {
    const source=selected?frameData(selected):null,visible=selection.size===1&&!!source&&(isJerrycan(source)||isWheel(source));$('tie-controls').hidden=!visible;if(!visible)return;
    const wheel=isWheel(source),connection=wheel?source.mount:source.tie;
    $('connection-title').textContent=wheel?'Dudukan roda ke hollow':'Tali pengikat jerigen';$('connection-location').textContent=wheel?'pelat atas':'atas belakang';
    $('connection-member-label').textContent=wheel?'Batang tempat menempel':'Batang tempat ikat';
    $('tie-detach').textContent=wheel?'Lepaskan roda dari hollow':'Lepaskan tali dari hollow';
    const targets=[...objects.values()].filter(g=>isTubeTarget(g.userData.frame));
    fillOptions($('tie-target'),[['',wheel?'Belum menempel':'Belum diikat'],...targets.map(g=>[g.userData.frame.id,g.userData.frame.name])],connection?.targetId??'');
    const target=objects.get(connection?.targetId)?.userData.frame;
    fillOptions($('tie-member'),target?objectMembers(target).map((_,i)=>[String(i),memberLabel(target,i)]):[['','Pilih frame / hollow tujuan']],connection?.memberIndex??'');
    $('tie-member').disabled=!target;$('tie-position').disabled=!target;
    if(document.activeElement!==$('tie-position'))$('tie-position').value=String(round((connection?.t??.5)*100));
    $('tie-detach').disabled=!target;$('tie-pick').disabled=!targets.length;$('tie-pick').setAttribute('aria-pressed',String(!!tiePicking));
    const points=target&&!wheel?tieVisualPoints(source,frameData(objects.get(target.id))):null;
    $('tie-status').textContent=wheel?(target?`Menempel ke ${target.name}. Dudukan mengikuti posisi, rotasi, dan ukuran hollow. Lepaskan untuk menggeser roda sendiri.`:'Pilih hollow tujuan untuk menempelkan pelat atas roda.'):
      target?`Terikat ke ${target.name}. Panjang ${fmt(new THREE.Vector3(...points.start).distanceTo(new THREE.Vector3(...points.end)))} m.`:targets.length?'Pilih hollow tujuan. Tali mengikuti perpindahan jerigen dan hollow.':'Tambahkan frame atau hollow lurus sebagai tujuan tali.';
  }
  function attachTie(targetId,memberIndex=0,t=.5) {
    applySelectedChange(()=>{const f=selected.userData.frame;if(!isJerrycan(f)&&!isWheel(f))return;const tie=validateTie({targetId,memberIndex,t});const target=objects.get(targetId);if(!target)throw new Error('Tujuan hollow tidak tersedia.');tubeAnchor(target.userData.frame,tie);if(isWheel(f))f.mount=tie;else f.tie=tie;});
  }
  function syncClothControls() {
    const f=selected?.userData.frame,visible=selection.size===1&&!!f&&isCloth(f);$('cloth-controls').hidden=!visible;
    if(!visible){clothHandles.visible=false;return;}
    const pin=f.clothPins[clothCorner],targets=[...objects.values()].filter(g=>isTubeTarget(g.userData.frame)),target=objects.get(pin?.targetId)?.userData.frame;
    $('cloth-corner').value=String(clothCorner);
    const values={'cloth-color':f.clothColor,'cloth-sag':round(f.clothSag*1000),'cloth-pin-t':round((pin?.t??.5)*100),'cloth-pin-side':String(pin?.side??1)};
    for(const [i,axis] of ['x','y','z'].entries()){values[`cloth-point-${axis}`]=round(f.clothCorners[clothCorner][i]);$(`cloth-point-${axis}`).disabled=!!pin;}
    for(const [id,value] of Object.entries(values))if(document.activeElement!==$(id))$(id).value=String(value);
    fillOptions($('cloth-pin-target'),[['','Sudut bebas'],...targets.map(g=>[g.userData.frame.id,g.userData.frame.name])],pin?.targetId??'');
    fillOptions($('cloth-pin-member'),target?objectMembers(target).map((_,i)=>[String(i),memberLabel(target,i)]):[['','Pilih hollow tujuan']],pin?.memberIndex??'');
    $('cloth-pin-member').disabled=!target;$('cloth-pin-t').disabled=!target;$('cloth-pin-detach').disabled=!pin;$('cloth-pin-pick').disabled=!targets.length;
    $('cloth-detach-all').disabled=!f.clothPins.some(Boolean);$('cloth-edit-corners').setAttribute('aria-pressed',String(clothEditing));
    $('cloth-pin-pick').setAttribute('aria-pressed',String(clothPickingCorner!==null&&!!tiePicking));
    $('cloth-pin-status').textContent=target?`Sudut ${clothCorner+1} menempel ke ${target.name}. Titik mengikuti hollow; lepaskan untuk mengatur XYZ sendiri.`:`Sudut ${clothCorner+1} bebas. Atur XYZ lokal atau aktifkan Edit sudut di 3D dan seret titiknya.`;
  }
  function attachClothPin(targetId,memberIndex=0,t=.5,corner=clothCorner,side=Number($('cloth-pin-side').value)) {
    applySelectedChange(()=>{
      const f=selected.userData.frame;if(!isCloth(f))return;
      const pin=validateClothPin({targetId,memberIndex,t,side}),target=objects.get(targetId);
      if(!target)throw new Error('Tujuan sudut kain tidak tersedia.');tubeAnchor(target.userData.frame,pin);f.clothPins[corner]=pin;
    });
  }
  function updateClothHandles() {
    clothHandles.visible=clothEditing&&selection.size===1&&!!selected&&isCloth(selected.userData.frame)&&!tiePicking;
    if(!clothHandles.visible)return;selected.updateMatrixWorld(true);
    for(const [i,handle] of clothHandles.children.entries()){
      handle.position.copy(selected.localToWorld(new THREE.Vector3(...selected.userData.frame.clothCorners[i])));
      const size=camera.isOrthographicCamera?orthoSpan/camera.zoom:2*camera.position.distanceTo(handle.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      handle.scale.setScalar(Math.max(.002,size/Math.max(stage.clientHeight,1)*8));
      handle.material.color.setHex(selected.userData.frame.clothPins[i]?0xd5a446:i===clothCorner?0x287ec4:0x4b9e65);
    }
    clothHandles.updateMatrixWorld(true);
  }
  function syncLockControls() {
    const locked=selectionLocked(),allLocked=selection.size>0&&[...selection].every(g=>g.userData.frame.locked);$('object-locked').checked=allLocked;$('object-locked').indeterminate=locked&&!allLocked;
    $('lock-hint').textContent=selected?.userData.frame.mount?'Roda mengikuti hollow. Lepaskan dudukan untuk menggeser atau memutar roda sendiri.':locked?'Terkunci. Buka semua kunci pilihan untuk menggeser atau memutar.':'Aktifkan setelah posisi dan rotasi sudah sesuai.';
    for(const el of $$('[id^="position-"],[id^="rotation-"],[data-rotate],#ground-frame'))el.disabled=locked;
    transform.enabled=!locked&&!tiePicking&&!clothEditing;
    const target=transformTarget();if(target&&!locked&&!tiePicking&&!clothEditing){if(transform.object!==target)transform.attach(target);}else if(transform.object)transform.detach();
    if(selected)$('status-text').textContent=`${selection.size>1?selection.size+' objek terpilih':selected.userData.frame.name}${locked?' · terkunci':''}`;
  }
  const gridRoot=new THREE.Group();scene.add(gridRoot);let gridSize=0;
  function updateGrid() {
    let extent=10;
    for(const g of objects.values()){const f=g.userData.frame;extent=Math.max(extent,Math.abs(g.position.x)+Math.max(f.width,f.height,f.depth??0),Math.abs(g.position.z)+Math.max(f.width,f.height,f.depth??0));if(isCloth(f)){g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);extent=Math.max(extent,Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z));}}
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
    const visible=selection.size===1&&!!selected&&settings.dimensions;dimensionRoot.visible=visible;
    $('dimension-width').hidden=!visible;$('dimension-height').hidden=!visible;
    if(!visible)return;
    let {width:w,height:h}=selected.userData.frame;const center=new THREE.Vector3();
    if(isCloth(selected.userData.frame)){const bounds=selected.children[0].geometry.boundingBox;bounds.getCenter(center);const size=bounds.getSize(new THREE.Vector3());w=size.x;h=size.y;}
    const gap=Math.max(.15,Math.min(w,h)*.09),tick=gap*.18;
    const x=-w/2-gap,y=-h/2-gap;const pts=[];
    const line=(a,b)=>pts.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
    line([-w/2,y,0],[w/2,y,0]);line([x,-h/2,0],[x,h/2,0]);
    for(const a of [-w/2,w/2]){line([a,-h/2-gap*.2,0],[a,y-tick*2,0]);line([a-tick,y-tick,0],[a+tick,y+tick,0]);}
    for(const b of [-h/2,h/2]){line([-w/2-gap*.2,b,0],[x-tick*2,b,0]);line([x-tick,b-tick,0],[x+tick,b+tick,0]);}
    dimensionGeometry.setFromPoints(pts.map(p=>p.add(center)));dimensionGeometry.computeBoundingSphere();dimensionRoot.position.copy(selected.position);dimensionRoot.quaternion.copy(selected.quaternion);
    dimensionAnchors[0].set(0,y,0).add(center);dimensionAnchors[1].set(x,0,0).add(center);
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
    const f=group.userData.frame;row.querySelector('strong').textContent=f.name;row.querySelector('small').textContent=objectSize(f);
    row.classList.toggle('locked',!!f.locked);row.querySelector('.object-lock').hidden=!f.locked;
    row.querySelector('.group-badge').hidden=!f.groupId;
  }
  function objectSize(f) {return isRiggingSegment(f)?`Truss 290 × 290 · ${fmt(f.height*1000)} mm`:f.type==='hollow'?`Hollow 40 × 40 · ${fmt(f.height*1000)} mm`: `${f.type==='led'?'LED · ':''}${fmt(f.width*1000)} × ${fmt(f.height*1000)}${hasDepth(f)?' × '+fmt(f.depth*1000):''} mm`;}
  function renderList() {
    $('object-list').replaceChildren();let index=0;
    for(const group of objects.values()){
      const f=group.userData.frame;index++;
      const row=document.createElement('button');row.type='button';row.className='object-row';row.dataset.id=f.id;row.setAttribute('role','option');
      const icon=document.createElement('span');icon.className=`object-icon ${f.type??'frame'} ${f.ballastKind??''}`;
      const info=document.createElement('span');info.className='object-info';
      const name=document.createElement('strong');name.textContent=f.name;const size=document.createElement('small');size.textContent=objectSize(f);info.append(name,size);
      const number=document.createElement('span');number.className='object-index';number.textContent=String(index).padStart(2,'0');row.append(icon,info,number);
      const lock=document.createElement('span');lock.className='object-lock';lock.innerHTML='<svg aria-hidden="true"><use href="#i-lock"/></svg>';lock.title='Posisi dan rotasi terkunci';lock.setAttribute('aria-label','Terkunci');lock.hidden=!f.locked;row.append(lock);row.classList.toggle('locked',!!f.locked);
      const badge=document.createElement('span');badge.className='group-badge';badge.textContent='G';badge.title='Anggota grup · Alt+klik untuk pilih satu anggota';badge.hidden=!f.groupId;row.append(badge);
      row.addEventListener('click',event=>{select(group,{additive:event.ctrlKey||event.metaKey||event.shiftKey,single:event.altKey});if(innerWidth<=800&&!event.ctrlKey&&!event.shiftKey){document.querySelector('.library').classList.remove('panel-open');}});
      $('object-list').append(row);
    }
    $('object-count').textContent=String(objects.size);const data=[...objects.values()].map(g=>g.userData.frame);$('status-count').textContent=`${objects.size} objek · ${data.filter(isBallast).length} pemberat${data.some(isWheel)?` · ${data.filter(isWheel).length} roda`:''}${data.some(f=>f.type==='rigging')?` · ${data.filter(f=>f.type==='rigging').length} rigging`:''}${data.some(isCloth)?` · ${data.filter(isCloth).length} kain`:''}`;$('empty-list').hidden=objects.size>0;$('viewport-empty').hidden=objects.size>0;updateSelectionList();renderFrameSummary();
  }
  function renderFrameSummary() {
    const summary=objectSummary(allFrames()),key=JSON.stringify(summary);if(key===lastSummary)return;lastSummary=key;$('summary-total').textContent=`${summary.total} pcs`;
    $('frame-summary-body').replaceChildren();$('frame-summary-empty').hidden=summary.total>0;$('frame-summary-table').hidden=summary.total===0;
    for(const item of summary.bySize){
      const row=document.createElement('tr'),size=document.createElement('td'),quantity=document.createElement('td');
      const kind=document.createElement('small');kind.className='summary-kind';kind.textContent=objectLabel(item);
      if(isCloth(item)){const swatch=document.createElement('span');swatch.className='cloth-swatch';swatch.style.backgroundColor=item.clothColor;kind.prepend(swatch);}
      size.append(kind,document.createTextNode(item.type==='hollow'?`40 × 40 · ${fmt(item.height*1000)} mm`:objectSize(item).replace(/^LED · /,'')));quantity.textContent=`${item.quantity} pcs`;row.append(size,quantity);$('frame-summary-body').append(row);
    }
  }
  function updateEditButtons() {
    $('selection-count').textContent=`${selection.size} dipilih`;
    $('copy-selection').disabled=!selection.size;$('paste-selection').disabled=!clipboard.length;
    $('group-selection').disabled=selection.size<2;$('ungroup-selection').disabled=![...selection].some(g=>g.userData.frame.groupId);
    $('select-all').disabled=!objects.size;
  }
  function updateSelectionList() {
    for(const row of $('object-list').children){const active=[...selection].some(g=>g.userData.frame.id===row.dataset.id);row.classList.toggle('active',active);row.setAttribute('aria-selected',String(active));}
    updateEditButtons();
  }
  function tintSelection(group,active) {
    const led=group.userData.frame.type==='led';
    if(isCloth(group.userData.frame))group.userData.material.color.set(group.userData.frame.clothColor);
    else group.userData.material.color.setHex(active&&!isBallast(group.userData.frame)?led?0x3b645f:0x628f72:group.userData.baseColor);
    group.userData.material.emissive.setHex(active?0x0c2110:0);
    group.userData.edgeMaterial.color.setHex(active?led?0x9ec4bd:0x356349:led?0x718594:0x587466);
    group.userData.screenMaterial?.color.setHex(active?0x2c5269:0x203c55);
  }
  function setSelection(groups,primary=null) {
    if(tiePicking&&(groups.length!==1||groups[0].userData.frame.id!==tiePicking))setTiePicking();
    for(const g of selection)tintSelection(g,false);selection.clear();
    for(const g of groups)if(objects.get(g.userData.frame.id)===g)selection.add(g);
    selected=selection.has(primary)?primary:[...selection].at(-1)??null;transform.detach();
    if(selection.size!==1||!selected||!isCloth(selected.userData.frame))clothEditing=false;
    syncClothControls();
    for(const g of selection)tintSelection(g,true);if(selection.size>1)resetProxy();
    $('no-selection').hidden=!!selected;$('selection-controls').hidden=!selected;
    if(!selected){$('inspector-title').textContent='Properti objek';$('status-text').textContent='Siap menyusun';}
    updateSelectionList();syncFields();updateDimensions();dirty=true;
  }
  function select(group,{additive=false,single=false}={}) {
    if(!group){setSelection([]);return;}
    const groupId=group.userData.frame.groupId;
    const batch=!single&&groupId?[...objects.values()].filter(g=>g.userData.frame.groupId===groupId):[group];
    if(!additive){setSelection(batch,group);return;}
    const next=new Set(selection),remove=batch.every(g=>next.has(g));for(const g of batch){if(remove)next.delete(g);else next.add(g);}
    setSelection([...next],group);
  }
  function syncFields() {
    if(!selected)return;
    const f=frameData(selected);const id=f.name.toUpperCase();$('selected-id').textContent=id.length>24?id.slice(0,24)+'…':id;
    const led=f.type==='led',hollow=f.type==='hollow',ballast=isBallast(f),wheel=isWheel(f),cloth=isCloth(f),rigging=f.type==='rigging',segment=isRiggingSegment(f),multi=selection.size>1;
    $('inspector-title').textContent=cloth?'Properti kain':wheel?'Properti roda':rigging?'Properti rigging':ballast?'Properti pemberat':led?'Properti LED Screen':hollow?'Properti hollow':'Properti frame';
    $('selected-type').textContent=cloth?'AKSESORIS LED · KAIN PENUTUP':wheel?'AKSESORIS LED · RODA CASTER':rigging?segment?'RIGGING · 1 BATANG TRUSS KOTAK':'RIGGING KELILING · FILE LAMA':ballast?`PEMBERAT · ${objectLabel(f).toUpperCase()}`:led?'VIDEOTRON · 1 KABINET':hollow?'HOLLOW LURUS · 40 × 40 MM':f.shape==='square'?'FRAME KOTAK':'FRAME PERSEGI PANJANG';
    $('frame-name').closest('label').hidden=multi;$('dimension-controls').hidden=multi;
    $('position-help').textContent=multi?'meter · pusat pilihan':'meter · titik tengah';
    if(multi){
      const groups=new Set([...selection].map(g=>g.userData.frame.groupId));
      $('selected-id').textContent=`${selection.size} OBJEK`;$('inspector-title').textContent='Properti pilihan';
      $('selected-type').textContent=groups.size===1&&f.groupId?'GRUP OBJEK':'PILIHAN BEBERAPA OBJEK';
    }
    $('frame-brace-controls').hidden=f.type!=='frame';$('frame-width').disabled=hollow||segment;$('frame-width').min=hollow?'40':segment?'290':rigging?'600':'100';$('frame-height').min=rigging&&!segment?'600':'100';
    $('frame-width').closest('label').hidden=segment;$('selected-size-fields').classList.toggle('single-field',segment);
    $('frame-depth-field').hidden=!hasDepth(f);$('frame-depth').disabled=!hasDepth(f);
    $('frame-height-label').textContent=hollow||segment?'Panjang':'Tinggi';$('selected-led-size-field').hidden=!led;
    $('selected-led-size').value=ledPreset(f.width,f.height);
    $('dimension-hint').textContent=cloth?'Ukuran dasar mengatur titik bebas. Sudut yang menempel tetap mengikuti hollow; bentuknya diatur melalui Titik kain.':wheel?'Ukuran luar termasuk ban, garpu, dan pelat dudukan atas.':segment?'1 objek = 1 batang truss. Penampang tetap 290 × 290 mm; panjang searah Y lokal. Putar untuk menyusun konstruksi.':rigging?'Rigging keliling dari file lama; objek baru dibuat per batang.':ballast?'Lebar × tinggi × kedalaman termasuk tali dan pegangan. Ukuran berpusat di titik tengah.':led?'Bezel 2 mm · tebal kabinet 80 mm. Ukuran berpusat di titik tengah.':hollow?'Profil tetap 40 × 40 mm. Panjang searah sumbu Y lokal.':'Perubahan ukuran berpusat di titik tengah.';
    const fields={'frame-name':f.name,'frame-width':round(f.width*1000),'frame-height':round(f.height*1000),'frame-brace-spacing':f.braceSpacingMm,'frame-depth':hasDepth(f)?round(f.depth*1000):''};
    const target=transformTarget();['x','y','z'].forEach((axis,i)=>{fields[`position-${axis}`]=multi?round(target.position[axis]):f.position[i];fields[`rotation-${axis}`]=multi?round(normalizeDegrees(THREE.MathUtils.radToDeg(target.rotation[axis]))):Number(f.rotation[i].toFixed(3));});
    for(const [id,value] of Object.entries(fields)){if(document.activeElement!==$(id))$(id).value=String(value);}
    syncLockControls();syncTieControls();syncClothControls();updateBraceSummary('frame');updateDimensions();
  }
  function readFrameTemplate() {return validateFrameTemplate({width:inputNumber($('add-width'))/1000,height:inputNumber($('add-height'))/1000,braceSpacingMm:frameShape==='hollow'?0:inputSpacing($('add-brace-spacing'))});}
  function restoreFrameTemplate(template) {$('add-width').value=String(round(template.width*1000));$('add-height').value=String(round(template.height*1000));$('add-brace-spacing').value=String(template.braceSpacingMm);updateBraceSummary('add');}
  function readLedTemplate() {return validateLedTemplate({width:inputNumber($('add-led-width'))/1000,height:inputNumber($('add-led-height'))/1000});}
  function ledPreset(w,h) {return w===1&&h===.5?'1000x500':w===.5&&h===.5?'500x500':'custom';}
  function restoreLedTemplate(t) {$('add-led-width').value=String(round(t.width*1000));$('add-led-height').value=String(round(t.height*1000));$('led-size').value=ledPreset(t.width,t.height);}
  function readBallastTemplate() {return validateBallastTemplate({kind:$('ballast-kind').value,width:inputNumber($('add-ballast-width'))/1000,height:inputNumber($('add-ballast-height'))/1000,depth:inputNumber($('add-ballast-depth'))/1000});}
  function readWheelTemplate() {return validateWheelTemplate(Object.fromEntries(['width','height','depth'].map(axis=>[axis,inputNumber($(`add-wheel-${axis}`))/1000])));}
  function readRiggingTemplate() {return validateRiggingTemplate({length:inputNumber($('add-rigging-length'))/1000});}
  function readClothTemplate() {return validateClothTemplate({width:inputNumber($('add-cloth-width'))/1000,height:inputNumber($('add-cloth-height'))/1000,color:$('add-cloth-color').value,sag:inputNumber($('add-cloth-sag'))/1000});}
  function restoreAccessoryTemplates(project) {
    for(const axis of ['width','height','depth'])$(`add-wheel-${axis}`).value=String(round(project.wheelTemplate[axis]*1000));
    $('add-rigging-length').value=String(round(project.riggingTemplate.length*1000));
    for(const axis of ['width','height'])$(`add-cloth-${axis}`).value=String(round(project.clothTemplate[axis]*1000));
    $('add-cloth-color').value=project.clothTemplate.color;$('add-cloth-sag').value=String(round(project.clothTemplate.sag*1000));
    accessoryKind=project.palette.accessory??'ballast';updateAccessoryPalette();
  }
  function updateAccessoryPalette() {
    $('accessory-kind').value=accessoryKind;
    for(const kind of ['ballast','wheel','rigging','cloth'])$(`${kind}-accessory-panel`).hidden=accessoryKind!==kind;
    if(savedFrames)markEdited();
  }
  function restoreBallastTemplate(t) {$('ballast-kind').value=t.kind;for(const axis of ['width','height','depth'])$(`add-ballast-${axis}`).value=String(round(t[axis]*1000));updateBallastPalette();}
  function updateBallastPalette() {
    const kind=$('ballast-kind').value;$('ballast-palette').dataset.kind=kind;
    $('ballast-palette-name').textContent=objectLabel({type:'ballast',ballastKind:kind});
    $('ballast-description').textContent=kind==='water-jerrycan'?'Jerigen dengan pegangan, tutup, dan tali pengikat terpasang.':'Balok semen padat dengan permukaan beton.';
  }
  function updatePalette() {
    $('frame-panel').hidden=paletteType!=='frame';$('led-panel').hidden=paletteType!=='led';$('ballast-panel').hidden=paletteType!=='ballast';
    for(const b of $$('[data-object-type]')){const on=b.dataset.objectType===paletteType;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
    for(const b of $$('[data-frame-shape]')){const on=b.dataset.frameShape===frameShape;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
    $('frame-shape-panel').setAttribute('aria-labelledby',`shape-${frameShape}`);
    const hollow=frameShape==='hollow';$('frame-palette').dataset.shape=frameShape;
    $('palette-name').textContent=hollow?'Batang hollow lurus':frameShape==='square'?'Frame kotak':'Frame persegi panjang';
    $('add-width-field').hidden=hollow;$('add-width').disabled=hollow;$('frame-size-fields').classList.toggle('single-field',hollow);
    $('add-height-label').textContent=hollow?'Panjang hollow':'Tinggi luar';$('add-brace-controls').hidden=hollow;$('add-brace-spacing').disabled=hollow;
    $('add-frame-label').textContent=hollow?'Add Hollow':'Add Frame';
    if(savedFrames)markEdited();
  }
  function contentDigest() {return JSON.stringify({frames:allFrames(),settings,paletteType,frameShape,accessoryKind,templateInputs:[$('add-width').value,$('add-height').value,$('add-brace-spacing').value,$('add-led-width').value,$('add-led-height').value,$('ballast-kind').value,...['ballast','wheel'].flatMap(kind=>['width','height','depth'].map(axis=>$(`add-${kind}-${axis}`).value)),$('add-rigging-length').value,...['width','height','color','sag'].map(key=>$(`add-cloth-${key}`).value)]});}
  function markEdited() {projectDirty=contentDigest()!==savedFrames;$('save-status').textContent=projectDirty?'Perubahan belum disimpan':'Proyek tersimpan · lokal';}
  function snapshot() {return JSON.stringify({frames:allFrames(),selected:[...selection].map(g=>g.userData.frame.id)});}
  function pushHistory() {
    reconcileTies();syncTieControls();syncClothControls();
    renderFrameSummary();
    const state=snapshot();
    if(historyIndex>=0&&histories[historyIndex]===state){updateGrid();return;}
    histories=histories.slice(0,historyIndex+1);histories.push(state);
    if(histories.length>80)histories.shift();historyIndex=histories.length-1;
    updateHistoryButtons();markEdited();updateGrid();
  }
  function updateHistoryButtons() {$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=histories.length-1;}
  function replaceFrames(frames,selectedId=null) {
    const staged=[];try{for(const f of frames)staged.push(buildFrame(f,false));}catch(e){staged.forEach(disposeFrame);throw e;}
    setTiePicking();select(null);for(const g of objects.values())disposeFrame(g);objects.clear();for(const id of tieMeshes.keys())removeTieMesh(id);
    for(const g of staged){framesRoot.add(g);objects.set(g.userData.frame.id,g);}reconcileTies();renderList();
    if(Array.isArray(selectedId))setSelection(selectedId.map(id=>objects.get(id)).filter(Boolean));else select(objects.get(selectedId)||null);
    updateGrid();dirty=true;
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
  function readNewObject(type=paletteType) {
    if(type==='ballast'&&accessoryKind!=='ballast')type=accessoryKind;
    if(type==='wheel')return {...readWheelTemplate(),type:'wheel',braceSpacingMm:0};
    if(type==='rigging')return {width:RIGGING_DEPTH,height:readRiggingTemplate().length,riggingKind:'segment',type:'rigging',braceSpacingMm:0};
    if(type==='cloth'){const {color,sag,...size}=readClothTemplate();return {...size,type:'cloth',clothColor:color,clothSag:sag,braceSpacingMm:0};}
    if(type==='ballast'){const {kind,...size}=readBallastTemplate();return {...size,type:'ballast',ballastKind:kind,braceSpacingMm:0};}
    if(type==='led')return {...readLedTemplate(),type:'led',braceSpacingMm:0};
    if(frameShape==='hollow')return {type:'hollow',width:HOLLOW,height:dimension(inputNumber($('add-height'))/1000,'Panjang hollow'),braceSpacingMm:0};
    const template=readFrameTemplate();
    if(frameShape==='square'&&template.width!==template.height)throw new Error('Lebar dan tinggi frame kotak harus sama.');
    return {...template,type:'frame',shape:frameShape};
  }
  function addFrame(position=null,type=paletteType) {
    if(objects.size>=MAX_FRAMES){toast(`Maksimal ${MAX_FRAMES} objek per proyek.`,true);return;}
    try {
      const data=readNewObject(type);ensureBraceBudget(data.height,data.braceSpacingMm);
      const p=position||[0,data.height/2,0];
      const name=objectLabel(data);
      const group=buildFrame({...data,id:uid(),name:`${name} ${String(frameCounter++).padStart(2,'0')}`,position:p,rotation:[0,0,0]});
      renderList();select(group);pushHistory();
    if(!position)fitAll(true);toast(`${group.userData.frame.name} ditambahkan${position?' di lantai.':' di titik asal.'}`);
      if(innerWidth<=800)document.querySelector('.library').classList.remove('panel-open');
    }catch(e){toast(e.message,true);}
  }
  function copySelection() {
    if(!selection.size)return;clipboard=JSON.parse(JSON.stringify([...selection].map(frameData)));pasteCount=0;updateEditButtons();toast(`${clipboard.length} objek disalin. Ctrl+V untuk menempel.`);
  }
  function pasteObjects(source=clipboard,offset=null) {
    if(!source.length){toast('Salin objek terlebih dahulu.',true);return;}
    try{
      const step=offset??[0,0,.15*(pasteCount+1)],copies=cloneObjects(source,allFrames(),step);
      replaceFrames([...allFrames(),...copies],copies.map(f=>f.id));if(!offset)pasteCount++;frameCounter+=copies.length;pushHistory();fitAll();toast(`${copies.length} objek ditempel, termasuk semua aksesoris yang disalin.`);
    }catch(e){toast(e.message,true);}
  }
  function duplicate() {if(selection.size)pasteObjects([...selection].map(frameData),[0,0,[...selection].some(g=>g.position.z+.15>LIMIT_POSITION)?-.15:.15]);}
  function selectAll() {setSelection([...objects.values()]);}
  function groupSelection() {
    if(selection.size<2)return;const id=uid();for(const g of selection)g.userData.frame.groupId=id;
    syncSelected();renderList();syncFields();pushHistory();toast(`${selection.size} objek dijadikan satu grup.`);
  }
  function ungroupSelection() {
    const ids=new Set([...selection].map(g=>g.userData.frame.groupId).filter(Boolean));if(!ids.size)return;
    for(const g of objects.values())if(ids.has(g.userData.frame.groupId))delete g.userData.frame.groupId;
    syncSelected();renderList();syncFields();pushHistory();toast('Grup dilepas. Objek tetap pada posisi semula.');
  }
  function removeSelected() {
    if(!selection.size)return;const removed=[...selection];select(null);for(const g of removed){disposeFrame(g);objects.delete(g.userData.frame.id);}reconcileTies();renderList();pushHistory();toast(`${removed.length} objek dihapus. Ctrl+Z untuk mengembalikan.`);
  }
  function applySelectedChange(callback) {
    if(!selected)return;
    try{callback();reconcileTies();syncSelected();syncFields();pushHistory();dirty=true;}catch(e){toast(e.message,true);const active=document.activeElement;active?.blur();syncFields();}
  }
  function applyTransformChange(callback) {if(selectionLocked()){toast([...selection].some(g=>g.userData.frame.mount)?'Roda mengikuti hollow. Pilih bersama hollow tujuan atau lepaskan dudukan untuk menggeser/putar.':'Pilihan terkunci. Buka semua kunci untuk menggeser atau memutar.');syncFields();return;}applySelectedChange(()=>{callback();if(selection.size>1)applyProxyDelta();});}
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
    if(!selected||selectionLocked()||tiePicking||clothEditing)return false;setRay(event.clientX,event.clientY);gizmo.updateMatrixWorld(true);
    const picker=gizmo.children.find(c=>c.type==='TransformControlsGizmo')?.picker?.[mode];
    // Use the public helper's runtime picker; it belongs to the pinned Three.js version.
    if(!picker)return transform.axis!==null;
    return raycaster.intersectObject(picker,true).some(h=>h.object.visible);
  }
  canvas.addEventListener('pointerdown',event=>{
    if(drag){event.stopImmediatePropagation();event.preventDefault();return;}
    if(event.button!==0||transform.dragging)return;
    if(tiePicking){
      setRay(event.clientX,event.clientY);framesRoot.updateMatrixWorld(true);
      const hit=raycaster.intersectObjects([...objects.values()].filter(g=>isTubeTarget(g.userData.frame)),true).find(h=>h.object.name==='beam');
      if(hit){
        event.stopImmediatePropagation();event.preventDefault();
        const target=hit.object.userData.frameRoot,index=hit.object.userData.memberIndex,member=objectMembers(target.userData.frame)[index],local=target.worldToLocal(hit.point.clone()),{axis}=tubeAnchor(target.userData.frame,{targetId:target.userData.frame.id,memberIndex:index,t:.5});
        const t=THREE.MathUtils.clamp(.5+(local.getComponent(axis)-member.position[axis])/Math.max(.0001,member.size[axis]-HOLLOW),0,1);
        const wheel=isWheel(selected.userData.frame),cloth=isCloth(selected.userData.frame);
        if(cloth)attachClothPin(target.userData.frame.id,index,t,clothPickingCorner,clothPickingSide);else attachTie(target.userData.frame.id,index,t);
        setTiePicking();toast(cloth?'Sudut kain menempel ke hollow pilihan.':wheel?'Roda menempel ke hollow pilihan.':'Tali jerigen diikat ke hollow pilihan.');return;
      }
      if(hitFrame(event)){event.stopImmediatePropagation();toast('Pilih batang frame atau hollow lurus sebagai tujuan.');}return;
    }
    if(clothEditing&&selected){
      updateClothHandles();setRay(event.clientX,event.clientY);const hit=raycaster.intersectObjects(clothHandles.children).at(0);
      if(hit){
        event.stopImmediatePropagation();event.preventDefault();clothCorner=hit.object.userData.corner;syncClothControls();
        if(selected.userData.frame.clothPins[clothCorner]){toast('Sudut menempel ke hollow. Lepaskan sudut untuk menyeretnya.');return;}
        if(selected.userData.frame.locked){toast('Buka kunci kain untuk menyeret sudut.');return;}
        const origin=new THREE.Vector3(...selected.userData.frame.clothCorners[clothCorner]),world=selected.localToWorld(origin.clone());
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),world),start=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
        drag={kind:'cloth',id:event.pointerId,target:selected,corner:clothCorner,origin,world,plane,start,x:event.clientX,y:event.clientY,moved:false};
        orbit.enabled=false;canvas.style.cursor='grabbing';canvas.setPointerCapture(event.pointerId);return;
      }
    }
    const additive=event.ctrlKey||event.metaKey||event.shiftKey;
    if(!additive&&!event.altKey&&hitGizmo(event)){orbit.enabled=false;return;}
    const hit=hitFrame(event);
    if(!hit)return;
    event.stopImmediatePropagation();event.preventDefault();
    if(additive){select(hit,{additive:true,single:event.altKey});return;}
    if(event.altKey||!selection.has(hit)||(selection.size===1&&hit.userData.frame.groupId))select(hit,{single:event.altKey});
    if(mode==='rotate'||selectionLocked())return;
    const target=transformTarget();setRay(event.clientX,event.clientY);const normal=camera.getWorldDirection(new THREE.Vector3());const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,target.position);const start=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
    orbit.enabled=false;canvas.style.cursor='grabbing';
    drag={id:event.pointerId,target,plane,start,origin:target.position.clone(),x:event.clientX,y:event.clientY,moved:false};
    canvas.setPointerCapture(event.pointerId);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!drag){if(tiePicking){canvas.style.cursor='crosshair';return;}if(!transform.dragging&&event.pointerType!=='touch'){const hit=hitFrame(event);canvas.style.cursor=hit?(mode==='translate'&&!hit.userData.frame.locked&&!(selection.has(hit)&&selectionLocked())?'grab':'pointer'):'';}return;}
    if(event.pointerId!==drag.id)return;event.stopImmediatePropagation();event.preventDefault();
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<3&&!drag.moved)return;drag.moved=true;
    setRay(event.clientX,event.clientY);const p=raycaster.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!p)return;
    if(drag.kind==='cloth'){
      p.sub(drag.start).add(drag.world);if(settings.snap)p.set(...p.toArray().map(n=>snapValue(n,settings.positionStep)));
      drag.target.worldToLocal(p);p.clampScalar(-1000,1000);drag.target.userData.frame.clothCorners[drag.corner]=p.toArray();updateClothMesh(drag.target);syncFields();dirty=true;return;
    }
    p.sub(drag.start).add(drag.origin);if(settings.snap)p.set(...p.toArray().map(n=>snapValue(n,settings.positionStep)));p.clampScalar(-LIMIT_POSITION,LIMIT_POSITION);
    drag.target.position.copy(p);if(selection.size>1){try{applyProxyDelta();}catch(e){toast(e.message,true);}}syncSelected();syncFields();dirty=true;
  },true);
  function endDirectDrag(cancel=false) {
    if(!drag)return;const d=drag;drag=null;
    if(cancel){if(d.kind==='cloth'){d.target.userData.frame.clothCorners[d.corner]=d.origin.toArray();updateClothMesh(d.target);}else {d.target.position.copy(d.origin);if(selection.size>1)applyProxyDelta();}}
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
  canvas.addEventListener('pointerdown',e=>{if(!tiePicking&&e.button===0&&!hitGizmo(e)&&!hitFrame(e))backgroundPress=[e.clientX,e.clientY];},false);
  canvas.addEventListener('pointerup',e=>{if(backgroundPress&&Math.hypot(e.clientX-backgroundPress[0],e.clientY-backgroundPress[1])<3&&!gizmoGesture)select(null);backgroundPress=null;},false);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let paletteDrag=null;
  for(const [id,type] of [['frame-palette','frame'],['led-palette','led'],['ballast-palette','ballast'],['wheel-palette','wheel'],['rigging-palette','rigging'],['cloth-palette','cloth']]){
    const palette=$(id);
    palette.addEventListener('dragstart',event=>{
      try{const data=readNewObject(type);ensureBraceBudget(data.height,data.braceSpacingMm);}catch(e){event.preventDefault();toast(e.message,true);return;}
      paletteDrag=type;event.dataTransfer.setData('application/x-led-frame',type);event.dataTransfer.effectAllowed='copy';$('drop-overlay').querySelector('strong').textContent=`Lepas untuk menambah ${objectLabel(readNewObject(type))}`;$('drop-overlay').hidden=false;
    });
    palette.addEventListener('dragend',()=>{paletteDrag=null;$('drop-overlay').hidden=true;});
  }
  viewport.addEventListener('dragover',e=>{if(paletteDrag){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  viewport.addEventListener('drop',event=>{
    event.preventDefault();$('drop-overlay').hidden=true;if(!paletteDrag)return;const type=paletteDrag;paletteDrag=null;
    setRay(event.clientX,event.clientY);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if(!point||Math.abs(raycaster.ray.direction.y)<.025){toast('Penempatan di lantai memerlukan tampilan Iso atau Top. Pilih salah satu, lalu seret kembali.',true);return;}
    let {x,z}=point;if(settings.snap){x=snapValue(x,settings.positionStep);z=snapValue(z,settings.positionStep);}
    if(Math.abs(x)>LIMIT_POSITION||Math.abs(z)>LIMIT_POSITION){toast('Titik penempatan di luar batas ±500 meter.',true);return;}
    try{addFrame([x,readNewObject(type).height/2,z],type);}catch(e){toast(e.message,true);}
  });
  $('add-form').addEventListener('submit',e=>{e.preventDefault();addFrame();});
  $('add-led-form').addEventListener('submit',e=>{e.preventDefault();addFrame(null,'led');});
  $('add-ballast-form').addEventListener('submit',e=>{e.preventDefault();addFrame(null,'ballast');});
  $('add-wheel-form').addEventListener('submit',e=>{e.preventDefault();addFrame(null,'wheel');});
  $('add-rigging-form').addEventListener('submit',e=>{e.preventDefault();addFrame(null,'rigging');});
  $('add-cloth-form').addEventListener('submit',e=>{e.preventDefault();addFrame(null,'cloth');});
  $('accessory-kind').addEventListener('change',()=>{accessoryKind=$('accessory-kind').value;updateAccessoryPalette();});
  for(const axis of ['width','height','depth'])$(`add-wheel-${axis}`).addEventListener('input',markEdited);
  $('add-rigging-length').addEventListener('input',markEdited);
  for(const key of ['width','height','color','sag'])$(`add-cloth-${key}`).addEventListener('input',markEdited);
  $('ballast-kind').addEventListener('change',()=>{const kind=$('ballast-kind').value;restoreBallastTemplate({kind,...BALLAST_PRESETS[kind]});markEdited();});
  ['width','height','depth'].forEach(axis=>$(`add-ballast-${axis}`).addEventListener('input',markEdited));
  $$('[data-object-type]').forEach(b=>b.addEventListener('click',()=>{paletteType=b.dataset.objectType;updatePalette();}));
  $$('[data-frame-shape]').forEach(b=>b.addEventListener('click',()=>{
    frameShape=b.dataset.frameShape;
    if(frameShape==='square')$('add-height').value=$('add-width').value;
    if(frameShape==='rectangle'&&$('add-width').value===$('add-height').value)$('add-height').value=String(inputNumber($('add-width'))===50000?25000:Math.min(50000,inputNumber($('add-width'))*2));
    updatePalette();updateBraceSummary('add');
  }));
  for(const tablist of $$('.object-tabs,.shape-tabs'))tablist.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
    const tabs=[...tablist.querySelectorAll('[role="tab"]')],i=tabs.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();
  });
  $('led-size').addEventListener('change',()=>{if($('led-size').value!=='custom'){const [w,h]=$('led-size').value.split('x').map(Number);restoreLedTemplate({width:w/1000,height:h/1000});}else $('add-led-width').focus();markEdited();});
  ['add-led-width','add-led-height'].forEach(id=>$(id).addEventListener('input',()=>{$('led-size').value=ledPreset(inputNumber($('add-led-width'))/1000,inputNumber($('add-led-height'))/1000);markEdited();}));
  $('selected-led-size').addEventListener('change',()=>{
    if($('selected-led-size').value==='custom'){$('frame-width').focus();return;}
    applySelectedChange(()=>{if(selected.userData.frame.type!=='led')return;const [w,h]=$('selected-led-size').value.split('x').map(n=>Number(n)/1000);resizeFrame(selected,w,h,0);});
  });
  $('frame-name').addEventListener('change',()=>applySelectedChange(()=>{selected.userData.frame.name=$('frame-name').value.trim()||'Frame';$('frame-name').value=selected.userData.frame.name;$('status-text').textContent=selected.userData.frame.name;}));
  $('object-locked').addEventListener('change',()=>{
    if(drag||transform.dragging){syncLockControls();return;}
    applySelectedChange(()=>{const locked=$('object-locked').checked;for(const g of selection)g.userData.frame.locked=locked;});
  });
  $('tie-target').addEventListener('change',()=>{
    if($('tie-target').value)attachTie($('tie-target').value);
    else applySelectedChange(()=>{delete selected.userData.frame[isWheel(selected.userData.frame)?'mount':'tie'];});
  });
  $('tie-member').addEventListener('change',()=>{if(selected?.userData.frame.tie||selected?.userData.frame.mount)attachTie($('tie-target').value,Number($('tie-member').value),inputNumber($('tie-position'))/100);});
  $('tie-position').addEventListener('change',()=>{if(selected?.userData.frame.tie||selected?.userData.frame.mount)attachTie($('tie-target').value,Number($('tie-member').value),inputNumber($('tie-position'))/100);});
  $('tie-detach').addEventListener('click',()=>{setTiePicking();applySelectedChange(()=>{delete selected.userData.frame[isWheel(selected.userData.frame)?'mount':'tie'];});});
  $('tie-pick').addEventListener('click',()=>{if(selected&&(isJerrycan(selected.userData.frame)||isWheel(selected.userData.frame)))setTiePicking(tiePicking?null:selected.userData.frame.id);});
  $('tie-pick-cancel').addEventListener('click',()=>setTiePicking());
  $('cloth-corner').addEventListener('change',()=>{const next=Number($('cloth-corner').value);setTiePicking();clothCorner=next;syncClothControls();dirty=true;});
  $('cloth-edit-corners').addEventListener('click',()=>{clothEditing=!clothEditing;syncLockControls();syncClothControls();dirty=true;});
  for(const axis of ['x','y','z'])$(`cloth-point-${axis}`).addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;if(!isCloth(f)||f.clothPins[clothCorner])return;
    f.clothCorners[clothCorner][['x','y','z'].indexOf(axis)]=numeric(inputNumber($(`cloth-point-${axis}`)),-1000,1000,'Koordinat sudut kain');updateClothMesh(selected);
  }));
  for(const id of ['cloth-color','cloth-sag'])$(id).addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;if(!isCloth(f))return;
    const next=validateCloth({...f,clothColor:$('cloth-color').value,clothSag:inputNumber($('cloth-sag'))/1000});Object.assign(f,next);updateClothMesh(selected);
  }));
  $('cloth-pin-target').addEventListener('change',()=>{
    if($('cloth-pin-target').value)attachClothPin($('cloth-pin-target').value);
    else applySelectedChange(()=>{selected.userData.frame.clothPins[clothCorner]=null;});
  });
  for(const id of ['cloth-pin-member','cloth-pin-t','cloth-pin-side'])$(id).addEventListener('change',()=>{if(selected?.userData.frame.clothPins?.[clothCorner])attachClothPin($('cloth-pin-target').value,Number($('cloth-pin-member').value),inputNumber($('cloth-pin-t'))/100);});
  $('cloth-pin-pick').addEventListener('click',()=>{if(selected&&isCloth(selected.userData.frame))setTiePicking(tiePicking?null:selected.userData.frame.id,clothCorner);});
  $('cloth-pin-detach').addEventListener('click',()=>{setTiePicking();applySelectedChange(()=>{selected.userData.frame.clothPins[clothCorner]=null;});});
  $('cloth-detach-all').addEventListener('click',()=>{setTiePicking();applySelectedChange(()=>{selected.userData.frame.clothPins=[null,null,null,null];});});
  for(const field of ['width','height'])$(`frame-${field}`).addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;if(field==='width'&&isRiggingSegment(f))return;const value=dimension(inputNumber($(`frame-${field}`))/1000,field==='width'?'Lebar':'Tinggi');
    const w=field==='width'?value:f.width,h=field==='height'?value:f.height;ensureBraceBudget(h,f.braceSpacingMm??0,selected);resizeFrame(selected,w,h);
  }));
  $('frame-depth').addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;if(!hasDepth(f))return;
    const depth=dimension(inputNumber($('frame-depth'))/1000,'Kedalaman objek');resizeFrame(selected,f.width,f.height,0,depth);
  }));
  $('frame-brace-spacing').addEventListener('change',()=>applySelectedChange(()=>{
    const f=selected.userData.frame;if(f.type!=='frame')return;const spacingMm=inputSpacing($('frame-brace-spacing'));ensureBraceBudget(f.height,spacingMm,selected);resizeFrame(selected,f.width,f.height,spacingMm);
  }));
  ['add-width','add-height','add-brace-spacing'].forEach(id=>$(id).addEventListener('input',()=>{
    if(frameShape==='square'&&id!=='add-brace-spacing')$(id==='add-width'?'add-height':'add-width').value=$(id).value;
    updateBraceSummary('add');if(savedFrames)markEdited();
  }));
  for(const axis of ['x','y','z']){
    $(`position-${axis}`).addEventListener('change',()=>applyTransformChange(()=>{transformTarget().position[axis]=numeric(inputNumber($(`position-${axis}`)),-LIMIT_POSITION,LIMIT_POSITION,'Posisi (meter)');}));
    $(`rotation-${axis}`).addEventListener('change',()=>applyTransformChange(()=>{transformTarget().rotation[axis]=THREE.MathUtils.degToRad(normalizeDegrees(numeric(inputNumber($(`rotation-${axis}`)),-36000,36000,'Rotasi (derajat)')));}));
  }
  $$('[data-rotate]').forEach(button=>button.addEventListener('click',()=>applyTransformChange(()=>{
    const axis=new THREE.Vector3(button.dataset.rotate==='x'?1:0,button.dataset.rotate==='y'?1:0,button.dataset.rotate==='z'?1:0);
    if(settings.space==='world')transformTarget().rotateOnWorldAxis(axis,Math.PI/2);else transformTarget().rotateOnAxis(axis,Math.PI/2);
  })));
  $('ground-frame').addEventListener('click',()=>applyTransformChange(()=>{const box=new THREE.Box3();for(const g of selection){g.updateMatrixWorld(true);box.union(new THREE.Box3().setFromObject(g));}const target=transformTarget(),y=target.position.y-box.min.y;numeric(y,-LIMIT_POSITION,LIMIT_POSITION,'Posisi Y');target.position.y=y;}));
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  ['snap-enabled','snap-position','snap-rotation','grid-enabled','dimensions-enabled','transform-space'].forEach(id=>$(id).addEventListener('change',updateSettings));
  $('fit-all').addEventListener('click',()=>fitAll());$('duplicate').addEventListener('click',duplicate);$('delete').addEventListener('click',removeSelected);
  $('undo').addEventListener('click',()=>restoreHistory(-1));$('redo').addEventListener('click',()=>restoreHistory(1));
  $('copy-selection').addEventListener('click',copySelection);$('paste-selection').addEventListener('click',()=>pasteObjects());
  $('select-all').addEventListener('click',selectAll);$('group-selection').addEventListener('click',groupSelection);$('ungroup-selection').addEventListener('click',ungroupSelection);
  $('save-project').addEventListener('click',()=>{
    try{
      if(drag||transform.dragging)throw new Error('Selesaikan geseran objek sebelum menyimpan.');
      // Read the editor explicitly: saving must not depend on a blur/change event.
      const template=readFrameTemplate(),ledTemplate=readLedTemplate(),ballastTemplate=readBallastTemplate(),wheelTemplate=readWheelTemplate(),riggingTemplate=readRiggingTemplate(),clothTemplate=readClothTemplate();
      if(selected&&selection.size===1){
        const f=selected.userData.frame,w=isRiggingSegment(f)?RIGGING_DEPTH:f.type==='hollow'?HOLLOW:dimension(inputNumber($('frame-width'))/1000,'Lebar'),h=dimension(inputNumber($('frame-height'))/1000,'Tinggi');
        const spacing=f.type==='frame'?inputSpacing($('frame-brace-spacing')):0;ensureBraceBudget(h,spacing,selected);
        const depth=hasDepth(f)?dimension(inputNumber($('frame-depth'))/1000,'Kedalaman objek'):undefined;
        const position=f.locked?selected.position.toArray():['x','y','z'].map(axis=>numeric(inputNumber($(`position-${axis}`)),-LIMIT_POSITION,LIMIT_POSITION,'Posisi'));
        const rotation=f.locked?[selected.rotation.x,selected.rotation.y,selected.rotation.z]:['x','y','z'].map(axis=>THREE.MathUtils.degToRad(normalizeDegrees(numeric(inputNumber($(`rotation-${axis}`)),-36000,36000,'Rotasi'))));
        if(f.tie)f.tie=validateTie({...f.tie,memberIndex:Number($('tie-member').value),t:inputNumber($('tie-position'))/100});
        if(f.mount)f.mount=validateTie({...f.mount,memberIndex:Number($('tie-member').value),t:inputNumber($('tie-position'))/100});
        if(isCloth(f)){
          const next=validateCloth({...f,clothColor:$('cloth-color').value,clothSag:inputNumber($('cloth-sag'))/1000});
          if(next.clothPins[clothCorner])next.clothPins[clothCorner]=validateClothPin({...next.clothPins[clothCorner],memberIndex:Number($('cloth-pin-member').value),t:inputNumber($('cloth-pin-t'))/100,side:Number($('cloth-pin-side').value)});
          else next.clothCorners[clothCorner]=['x','y','z'].map(axis=>numeric(inputNumber($(`cloth-point-${axis}`)),-1000,1000,'Koordinat sudut kain'));
          Object.assign(f,next);
        }
        f.name=$('frame-name').value.trim()||'Objek';resizeFrame(selected,w,h,spacing,depth);selected.position.fromArray(position);selected.rotation.set(...rotation,'XYZ');reconcileTies();syncSelected();pushHistory();
      }
      else if(selection.size>1&&!selectionLocked()){
        const position=['x','y','z'].map(axis=>numeric(inputNumber($(`position-${axis}`)),-LIMIT_POSITION,LIMIT_POSITION,'Posisi'));
        const rotation=['x','y','z'].map(axis=>THREE.MathUtils.degToRad(normalizeDegrees(numeric(inputNumber($(`rotation-${axis}`)),-36000,36000,'Rotasi'))));
        selectionProxy.position.fromArray(position);selectionProxy.rotation.set(...rotation,'XYZ');applyProxyDelta();syncSelected();pushHistory();
      }
      document.activeElement?.blur();syncFields();
      const project=makeProject(allFrames(),settings,cameraData(),template,ledTemplate,{type:paletteType,shape:frameShape,accessory:accessoryKind},ballastTemplate,wheelTemplate,riggingTemplate,clothTemplate);const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),`led-frame-project-v1.8-${date}.json`);savedFrames=contentDigest();markEdited();toast(`JSON tersimpan: ${project.frames.length} objek, ${project.frames.filter(isBallast).length} pemberat, ${project.frames.filter(isWheel).length} roda, ${project.frames.filter(f=>f.type==='rigging').length} rigging, ${project.frames.filter(isCloth).length} kain.`);
    }catch(e){toast(e.message||'Gagal menyimpan proyek.',true);}
  });
  $('load-project').addEventListener('click',()=>$('project-file').click());
  $('project-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('File JSON maksimal 5 MB.');
      let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('File bukan JSON yang valid.');}
      const project=validateProject(parsed);
      if(projectDirty&&!await confirmAction('Muat proyek?', 'Proyek saat ini memiliki perubahan yang belum disimpan. Memuat file akan menggantinya. Simpan JSON terlebih dahulu bila masih diperlukan.'))return;
      replaceFrames(project.frames,project.frames[0]?.id);restoreFrameTemplate(project.frameTemplate);restoreLedTemplate(project.ledTemplate);restoreBallastTemplate(project.ballastTemplate);restoreAccessoryTemplates(project);paletteType=project.palette.type;frameShape=project.palette.shape;updatePalette();settings=project.settings;applySettings();restoreCamera(project.camera);frameCounter=project.frames.length+1;
      histories=[];historyIndex=-1;savedFrames=contentDigest();pushHistory();const ballastCount=project.frames.filter(isBallast).length;
      toast(`${objects.size} objek berhasil dimuat, termasuk ${ballastCount} pemberat, ${project.frames.filter(isWheel).length} roda, ${project.frames.filter(f=>f.type==='rigging').length} rigging, ${project.frames.filter(isCloth).length} kain.${!ballastCount?' File ini tidak berisi objek pemberat.':''}`);
    } catch(e){toast(e.message||'Gagal membaca proyek.',true);}
  });
  $('new-project').addEventListener('click',async()=>{
    if(objects.size&&!await confirmAction('Buat proyek kosong?', 'Semua objek akan dikeluarkan dari area kerja. Anda dapat mengembalikannya dengan Undo. Simpan JSON terlebih dahulu jika diperlukan.'))return;
    replaceFrames([]);pushHistory();frameCounter=1;setView('iso');toast('Proyek kosong siap.');
  });
  $('export-png').addEventListener('click',async()=>{
    if(drag||transform.dragging)return;
    const button=$('export-png');button.disabled=true;
    try {
      const old=gizmo.visible,oldOutline=selectionOutline.visible,oldHandles=clothHandles.visible;gizmo.visible=false;selectionOutline.visible=false;clothHandles.visible=false;updateTies();renderer.render(scene,camera);
      const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const ctx=output.getContext('2d');if(!ctx)throw new Error('Tidak dapat membuat PNG.');ctx.drawImage(canvas,0,0);
      const scale=canvas.width/stage.clientWidth;ctx.scale(scale,scale);
      if(dimensionRoot.visible){positionDimensionLabels();for(const id of ['dimension-width','dimension-height']){const el=$(id);if(el.hidden)continue;const x=parseFloat(el.style.left),y=parseFloat(el.style.top);ctx.font='12px Consolas, monospace';const width=ctx.measureText(el.textContent).width+14;ctx.fillStyle='#f6f9f0';ctx.fillRect(x-width/2,y-10,width,20);ctx.strokeStyle='#bdcfb4';ctx.strokeRect(x-width/2,y-10,width,20);ctx.fillStyle='#3f6854';ctx.textAlign='center';ctx.fillText(el.textContent,x,y+4);}}
      ctx.font='11px Segoe UI, sans-serif';ctx.fillStyle='#748b69';ctx.textAlign='left';ctx.fillText('Contruction Builder (LED Rental)  /  Hollow 40 × 40 mm  /  Meter',18,stage.clientHeight-17);
      gizmo.visible=old;selectionOutline.visible=oldOutline;clothHandles.visible=oldHandles;dirty=true;
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
    if(event.key==='Escape'&&tiePicking){event.preventDefault();setTiePicking();return;}
    if(modifier&&event.key.toLowerCase()==='s'){event.preventDefault();$('save-project').click();return;}
    if(editing)return;
    if(event.key==='Escape'){
      if(drag)endDirectDrag(true);
      else if(transform.dragging)cancelGizmo();
      else if(clothEditing){clothEditing=false;syncFields();dirty=true;}
      else select(null);
      document.querySelectorAll('.panel-open').forEach(el=>el.classList.remove('panel-open'));return;
    }
    if(drag||transform.dragging)return;
    if(modifier&&event.key.toLowerCase()==='a'){event.preventDefault();selectAll();return;}
    if(modifier&&event.key.toLowerCase()==='c'){event.preventDefault();copySelection();return;}
    if(modifier&&event.key.toLowerCase()==='v'){event.preventDefault();pasteObjects();return;}
    if(modifier&&event.key.toLowerCase()==='g'){event.preventDefault();if(event.shiftKey)ungroupSelection();else groupSelection();return;}
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
  const first=buildFrame({id:uid(),name:'Frame 01',type:'frame',shape:'rectangle',width:1,height:2,braceSpacingMm:0,position:[0,1,0],rotation:[0,0,0]});frameCounter=2;renderList();select(first);updatePalette();updateBraceSummary('add');applySettings();setView('iso');savedFrames=contentDigest();pushHistory();$('save-status').textContent='Contoh 1000 × 2000 mm · siap disusun';$('loading').hidden=true;
  function render() {requestAnimationFrame(render);orbit.update();if(dirty){updateTies();updateSelectionOutline();updateClothHandles();renderer.render(scene,camera);positionDimensionLabels();dirty=false;}}
  render();
}
try{main();}catch(error){console.error(error);$('loading').hidden=false;$('loading').classList.add('error-loading');$('loading').textContent=`Area 3D gagal dimulai: ${error.message}. Pastikan app.bundle.js berada di folder yang sama dengan index.html, lalu muat ulang.`;}
