import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeProject,DEFAULT_SETTINGS,BALLAST_PRESETS} from '../src/project.js';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('.verification');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,offline:true});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));let page;
const open=async(single=false)=>{const p=await context.newPage();await p.goto(pathToFileURL(resolve(single?'Contruction-Builder-LED-Rental.html':'index.html')).href);await p.locator('#loading').waitFor({state:'hidden'});return p;};
const change=async(id,value)=>{await page.locator(`#${id}`).fill(String(value));await page.locator(`#${id}`).press('Tab');};
const shortcut=async key=>{await page.locator('#viewport').focus();await page.keyboard.press(key);};
const count=async n=>assert.equal(await page.locator('.object-row').count(),n);
const selected=async n=>assert.equal(await page.locator('.object-row[aria-selected=true]').count(),n);
const save=async(name='selection.json')=>{const download=page.waitForEvent('download');await page.locator('#save-project').evaluate(b=>b.click());await(await download).saveAs(resolve(output,name));return JSON.parse(await readFile(resolve(output,name),'utf8'));};
function projectPoint(point,camera,rect){
  const aspect=rect.width/rect.height,span=camera.span;
  const view=camera.type==='orthographic'?new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.01,15000):new THREE.PerspectiveCamera(40,aspect,.01,15000);
  view.up.fromArray(camera.up);view.position.fromArray(camera.position);view.lookAt(new THREE.Vector3(...camera.target));view.updateMatrixWorld(true);
  const p=new THREE.Vector3(...point).project(view);return{x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
}
async function drag(point,dx=40,dy=-20){await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+dx,point.y+dy,{steps:8});await page.mouse.up();}
const positionDelta=(after,before)=>after.position.map((n,i)=>n-before.position[i]);
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<2e-5,`${a} vs ${b}`));
try{
  {
    const diagnosticFixture=process.env.IMPORT_FIXTURE||resolve(output,'no-ballast-fixture.json');
    if(!process.env.IMPORT_FIXTURE){
      const frames=Array.from({length:20},(_,i)=>({id:`old-${i}`,name:`Frame ${i+1}`,type:'frame',width:1,height:2,position:[i%5-2,1,-Math.floor(i/5)],rotation:[0,0,0]}));
      frames.push({id:'old-led',name:'LED',type:'led',width:1,height:.5,position:[0,.25,.1],rotation:[0,0,0]});
      await writeFile(diagnosticFixture,JSON.stringify(makeProject(frames,DEFAULT_SETTINGS,null)));
    }
    page=await open();await page.locator('#project-file').setInputFiles(diagnosticFixture);await page.locator('#object-count').filter({hasText:/^21$/}).waitFor();
    await page.locator('#toast').filter({hasText:'0 pemberat'}).waitFor();assert.equal(await page.locator('.object-icon.ballast').count(),0);
    await page.locator('#tab-ballast').click();await page.locator('#ballast-kind').selectOption('water-jerrycan');await page.locator('#add-ballast-form button[type=submit]').click();
    await page.locator('#ballast-kind').selectOption('concrete-block');await page.locator('#add-ballast-form button[type=submit]').click();await count(23);
    const repaired=await save('saved-with-two-ballasts.json');assert.equal(repaired.frames.filter(f=>f.type==='ballast').length,2);
    const restored=await open(true);await restored.locator('#project-file').setInputFiles(resolve(output,'saved-with-two-ballasts.json'));await restored.locator('#object-count').filter({hasText:/^23$/}).waitFor();assert.equal(await restored.locator('.object-icon.ballast').count(),2);
  }
  const base={braceSpacingMm:0,rotation:[0,0,0]};
  const fixture=makeProject([
    {...base,id:'f',name:'Frame',type:'frame',shape:'square',width:2,height:2,braceSpacingMm:1000,position:[0,1,0]},
    {...base,id:'h',name:'Hollow',type:'hollow',width:.04,height:2,position:[2,1,0],rotation:[0,0,30]},
    {...base,id:'l',name:'LED',type:'led',width:1,height:1,position:[-2,.5,0],rotation:[0,20,0]},
    {...base,id:'j',name:'Jerigen',type:'ballast',ballastKind:'water-jerrycan',...BALLAST_PRESETS['water-jerrycan'],position:[.5,.25,1],tie:{targetId:'f',memberIndex:0,t:.75}},
    {...base,id:'b',name:'Balok',type:'ballast',ballastKind:'concrete-block',...BALLAST_PRESETS['concrete-block'],position:[1.5,.15,1]},
  ],DEFAULT_SETTINGS,null);
  await writeFile(resolve(output,'selection-fixture.json'),JSON.stringify(fixture));page=await open();await page.locator('#project-file').setInputFiles(resolve(output,'selection-fixture.json'));await page.locator('#object-count').filter({hasText:/^5$/}).waitFor();
  // Text editing keeps the browser's native Ctrl+A behavior.
  await page.locator('#frame-name').focus();await page.keyboard.press('Control+a');await selected(1);
  assert.equal(await page.locator('#frame-name').evaluate(el=>el.selectionEnd-el.selectionStart),5);
  await shortcut('Control+a');await selected(5);assert.ok(await page.locator('#dimension-controls').isHidden());
  await shortcut('Control+g');let p=await save();const originalGroup=p.frames[0].groupId;assert.ok(p.frames.every(f=>f.groupId===originalGroup));
  await shortcut('Control+c');await shortcut('Control+v');await count(10);await selected(5);p=await save();
  const originals=new Set(fixture.frames.map(f=>f.id)),copies=p.frames.filter(f=>!originals.has(f.id)),copyIds=new Set(copies.map(f=>f.id)),copiedGroup=copies[0].groupId;
  assert.ok(copies.every(f=>f.groupId===copiedGroup&&f.groupId!==originalGroup&&!f.locked));assert.equal(p.frames.filter(f=>f.type==='ballast').length,4);
  assert.equal(copies.find(f=>f.ballastKind==='water-jerrycan').tie.targetId,copies.find(f=>f.type==='frame').id);
  await page.locator('[data-view=front]').click();p=await save();
  const block=p.frames.find(f=>copyIds.has(f.id)&&f.ballastKind==='concrete-block');
  await drag(projectPoint(block.position,p.camera,await page.locator('#viewport').boundingBox()));let after=await save();
  const delta=positionDelta(after.frames.find(f=>f.id===block.id),block);assert.ok(Math.abs(delta[0])>.001);
  for(const old of p.frames){const next=after.frames.find(f=>f.id===old.id);if(copyIds.has(old.id))near(positionDelta(next,old),delta);else near(next.position,old.position);}
  // Drag the actual world-X gizmo of the shared selection pivot.
  p=after;const pivot=await Promise.all(['x','y','z'].map(a=>page.locator(`#position-${a}`).inputValue().then(Number)));
  const gizmoPoint=[pivot[0]+p.camera.span*.8/4*.45,pivot[1],pivot[2]];
  await drag(projectPoint(gizmoPoint,p.camera,await page.locator('#viewport').boundingBox()),35,0);after=await save();
  const gizmoDelta=positionDelta(after.frames.find(f=>f.id===block.id),p.frames.find(f=>f.id===block.id));assert.ok(Math.abs(gizmoDelta[0])>.001);near(gizmoDelta.slice(1),[0,0]);
  for(const old of p.frames.filter(f=>copyIds.has(f.id)))near(positionDelta(after.frames.find(f=>f.id===old.id),old),gizmoDelta);
  p=after;await change('position-x',Number(await page.locator('#position-x').inputValue())+2);after=await save();
  for(const old of p.frames){const next=after.frames.find(f=>f.id===old.id);near(positionDelta(next,old),copyIds.has(old.id)?[2,0,0]:[0,0,0]);}
  const beforeRotate=after;await page.locator('[data-rotate=z]').click();const rotated=await save();
  const reference=copies[0].id;
  for(const id of copyIds){
    const beforeDistance=new THREE.Vector3(...beforeRotate.frames.find(f=>f.id===id).position).distanceTo(new THREE.Vector3(...beforeRotate.frames.find(f=>f.id===reference).position));
    const afterDistance=new THREE.Vector3(...rotated.frames.find(f=>f.id===id).position).distanceTo(new THREE.Vector3(...rotated.frames.find(f=>f.id===reference).position));assert.ok(Math.abs(beforeDistance-afterDistance)<2e-5);
  }
  await shortcut('Control+z');let undone=await save();for(const id of copyIds)near(undone.frames.find(f=>f.id===id).position,beforeRotate.frames.find(f=>f.id===id).position);
  await shortcut('Control+Shift+z');let redone=await save();for(const id of copyIds)near(redone.frames.find(f=>f.id===id).position,rotated.frames.find(f=>f.id===id).position);
  await shortcut('Control+Shift+g');p=await save('group-roundtrip.json');assert.ok(p.frames.filter(f=>copyIds.has(f.id)).every(f=>!f.groupId));assert.ok(p.frames.filter(f=>originals.has(f.id)).every(f=>f.groupId===originalGroup));
  await page.locator('.object-row[data-id=f]').click();await selected(5);
  const copiedCan=copies.find(f=>f.ballastKind==='water-jerrycan');await page.locator(`.object-row[data-id="${copiedCan.id}"]`).click({modifiers:['Control']});await selected(6);
  const copiedBlock=copies.find(f=>f.ballastKind==='concrete-block');await page.locator(`.object-row[data-id="${copiedBlock.id}"]`).click({modifiers:['Shift']});await selected(7);
  await page.locator('.object-row[data-id=j]').click({modifiers:['Alt']});await selected(1);assert.ok(await page.locator('#tie-controls').isVisible());
  await page.locator('.object-row[data-id=f]').click();await page.locator('#object-locked').check();await shortcut('Control+a');await selected(10);assert.ok(await page.locator('#position-x').isDisabled());
  await page.locator('#object-locked').check();await page.locator('#object-locked').uncheck();assert.ok(!(await page.locator('#position-x').isDisabled()));
  await page.locator(`.object-row[data-id="${copiedCan.id}"]`).click();await shortcut('Control+d');await count(11);await shortcut('Delete');await count(10);await shortcut('Control+z');await count(11);await shortcut('Control+Shift+z');await count(10);
  const restored=await open(true);await restored.locator('#project-file').setInputFiles(resolve(output,'group-roundtrip.json'));await restored.locator('#object-count').filter({hasText:/^10$/}).waitFor();
  assert.equal(await restored.locator('.object-icon.ballast').count(),4);assert.equal(await restored.locator('.object-row[aria-selected=true]').count(),5);
  await restored.locator('.object-row[data-id=j]').click({modifiers:['Alt']});assert.equal(await restored.locator('#tie-target').inputValue(),'f');
  await page.locator('.object-row[data-id=j]').click({modifiers:['Alt']});await shortcut('Control+c');
  await page.locator('#new-project').click();await page.locator('#confirm-ok').click();await count(0);await shortcut('Control+v');await count(1);p=await save();assert.equal(p.frames[0].type,'ballast');assert.ok(!p.frames[0].tie);assert.ok(!p.frames[0].groupId);
  await restored.locator('#select-all').click();await restored.locator('[data-view=iso]').click();await restored.locator('#fit-all').click();await restored.screenshot({path:resolve(output,'selection-desktop.png')});
  const pngDownload=restored.waitForEvent('download');await restored.locator('#export-png').click();await(await pngDownload).saveAs(resolve(output,'selection-export.png'));
  assert.deepEqual([...(await readFile(resolve(output,'selection-export.png'))).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const invalid=JSON.parse(await readFile(resolve(output,'group-roundtrip.json'),'utf8'));delete invalid.frames.find(f=>f.type==='ballast').depth;await writeFile(resolve(output,'invalid-ballast.json'),JSON.stringify(invalid));
  await restored.locator('#project-file').setInputFiles(resolve(output,'invalid-ballast.json'));await restored.locator('#toast').filter({hasText:'Kedalaman pemberat'}).waitFor();assert.equal(await restored.locator('.object-row').count(),10);assert.equal(await restored.locator('.object-icon.ballast').count(),4);
  await restored.setViewportSize({width:390,height:844});await restored.locator('#toggle-library').click();await restored.locator('#select-all').scrollIntoViewIfNeeded();assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await restored.screenshot({path:resolve(output,'selection-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: JSON counts distinguish absent ballast from saved form; both ballast types survive save/load; native text editing; Ctrl+A/C/V/D/G/Shift+G; multi-select; copied group/tie ID remapping; shared viewport and gizmo drag; rigid numeric translate/rotate; Undo/Redo; mixed locks; delete; groups persist offline; cross-project paste; desktop/mobile; no browser errors.');
}finally{await browser.close();}
