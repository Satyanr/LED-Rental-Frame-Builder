import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clothPinnedCorners,clothSurfacePoint} from '../src/geometry.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('.verification');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,offline:true});
const errors=[],requests=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});});
const page=await context.newPage();
const change=async(id,value,p=page)=>{await p.locator(`#${id}`).fill(String(value));await p.locator(`#${id}`).press('Tab');};
const choose=async(id,p=page)=>p.locator(`.object-row[data-id="${id}"]`).click();
const save=async(p=page,name='cloth-roundtrip.json')=>{
  const pending=p.waitForEvent('download');await p.locator('#save-project').evaluate(b=>b.click());
  const file=resolve(output,name);await (await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'));
};
function projectPoint(frame,local,camera,rect){
  const aspect=rect.width/rect.height,span=camera.span;
  const view=camera.type==='orthographic'?new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.01,15000):new THREE.PerspectiveCamera(40,aspect,.01,15000);
  view.up.fromArray(camera.up);view.position.fromArray(camera.position);view.lookAt(new THREE.Vector3(...camera.target));view.updateMatrixWorld(true);
  const point=new THREE.Vector3(...local).applyEuler(new THREE.Euler(...frame.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...frame.position)).project(view);
  return {x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2};
}
function assertPins(p,id){
  const source=p.frames.find(f=>f.id===id),expected=clothPinnedCorners(source,new Map(p.frames.map(f=>[f.id,f])));
  source.clothPins.forEach((pin,i)=>{if(pin)assert.ok(new THREE.Vector3(...source.clothCorners[i]).distanceTo(new THREE.Vector3(...expected[i]))<2e-6);});
}
try{
  await page.goto(pathToFileURL(resolve('index.html')).href);await page.locator('#loading').waitFor({state:'hidden'});
  await change('frame-width',2000);await change('frame-brace-spacing',1000);let p=await save();const frameId=p.frames[0].id;
  await page.locator('#tab-ballast').click();await page.locator('#accessory-kind').selectOption('cloth');
  await page.locator('#add-cloth-color').fill('#39424b');await page.locator('#add-cloth-sag').fill('100');await page.locator('#add-cloth-form button[type=submit]').click();
  assert.equal(await page.locator('#inspector-title').textContent(),'Properti kain');assert.ok(await page.locator('#cloth-controls').isVisible());assert.ok(await page.locator('#tie-controls').isHidden());
  await page.locator('#cloth-corner').selectOption('2');await change('cloth-point-x',1.3);await page.locator('#cloth-point-z').fill('0.4');
  p=await save();const clothId=p.frames[1].id;assert.equal(p.frames[1].clothCorners[2][2],.4);assert.equal(p.frames[1].clothColor,'#39424b');assert.equal(p.frames[1].clothSag,.1);
  await page.locator('#undo').click();assert.equal((await save()).frames[1].clothCorners[2][2],0);await page.locator('#redo').click();assert.equal((await save()).frames[1].clothCorners[2][2],.4);
  await change('frame-width',2500);p=await save();assert.equal(p.frames[1].width,2.5);assert.ok(Math.abs(p.frames[1].clothCorners[2][0]-1.625)<1e-6);await page.locator('#undo').click();assert.equal((await save()).frames[1].width,2);
  // Drag a real corner handle in the viewport and cancel a second drag with Esc.
  await page.locator('[data-view=front]').click();await page.locator('#fit-all').click();await page.locator('#cloth-edit-corners').click();p=await save();
  let source=p.frames[1],point=projectPoint(source,source.clothCorners[3],p.camera,await page.locator('#viewport').boundingBox());
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x-45,point.y-25,{steps:8});await page.mouse.up();
  let moved=await save();assert.notDeepEqual(moved.frames[1].clothCorners[3],source.clothCorners[3]);assert.deepEqual(moved.frames[1].position,source.position);
  source=moved.frames[1];point=projectPoint(source,source.clothCorners[3],moved.camera,await page.locator('#viewport').boundingBox());
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+40,point.y+30,{steps:6});await page.keyboard.press('Escape');await page.mouse.up();
  p=await save();assert.deepEqual(p.frames[1].clothCorners[3],source.clothCorners[3]);
  // Top left by dropdown; top right by clicking a locked hollow through the cloth.
  await page.locator('#cloth-corner').selectOption('0');await page.locator('#cloth-pin-target').selectOption(frameId);await change('cloth-pin-t',1);
  p=await save();assertPins(p,clothId);assert.ok(await page.locator('#cloth-point-x').isDisabled());
  await choose(frameId);await page.locator('#object-locked').check();await choose(clothId);await page.locator('#cloth-corner').selectOption('1');
  await page.locator('[data-view=front]').click();p=await save();point=projectPoint(p.frames[0],[.75,.98,0],p.camera,await page.locator('#viewport').boundingBox());
  await page.locator('#cloth-pin-side').selectOption('-1');await page.locator('#cloth-pin-pick').click();assert.ok(await page.locator('#tie-pick-banner').isVisible());await page.mouse.click(point.x,point.y);
  assert.ok(await page.locator('#tie-pick-banner').isHidden());p=await save();assert.equal(p.frames[1].clothPins[1].targetId,frameId);assert.equal(p.frames[1].clothPins[1].side,-1);assertPins(p,clothId);await page.locator('#cloth-pin-side').selectOption('1');
  await page.locator('#cloth-pin-pick').click();await page.keyboard.press('Escape');assert.ok(await page.locator('#tie-pick-banner').isHidden());
  const freeCorner=[...p.frames[1].clothCorners[2]];await choose(frameId);await page.locator('#object-locked').uncheck();await change('rotation-y',35);await change('position-x',.5);await change('frame-width',2800);
  p=await save();assertPins(p,clothId);assert.deepEqual(p.frames[1].clothCorners[2],freeCorner);
  await choose(clothId);const pinnedBefore=[...p.frames[1].clothCorners[0]];await change('frame-width',2400);p=await save();assertPins(p,clothId);assert.ok(new THREE.Vector3(...p.frames[1].clothCorners[0]).distanceTo(new THREE.Vector3(...pinnedBefore))<1e-6);await page.locator('#undo').click();await save();
  // Removing a brace releases just its pinned corner and Undo restores it.
  await choose(clothId);await page.locator('#cloth-corner').selectOption('0');await page.locator('#cloth-pin-member').selectOption('4');
  await choose(frameId);await change('frame-brace-spacing',0);p=await save();assert.equal(p.frames[1].clothPins[0],null);assert.ok(p.frames[1].clothPins[1]);await page.locator('#undo').click();assert.ok((await save()).frames[1].clothPins[0]);
  // Third corner uses a different straight hollow and its rear side.
  await page.locator('#tab-frame').click();await page.locator('#shape-hollow').click();await page.locator('#add-form button[type=submit]').click();await change('position-x',2);await change('position-z',.5);
  p=await save();const hollowId=p.frames[2].id;await choose(clothId);await page.locator('#cloth-corner').selectOption('2');await page.locator('#cloth-pin-target').selectOption(hollowId);await page.locator('#cloth-pin-side').selectOption('-1');await change('cloth-pin-t',15);
  p=await save();assertPins(p,clothId);assert.equal(p.frames[1].clothPins[2].side,-1);
  const lastCorner=[...p.frames[1].clothCorners[2]];await page.locator('#cloth-pin-detach').click();p=await save();assert.equal(p.frames[1].clothPins[2],null);assert.ok(new THREE.Vector3(...p.frames[1].clothCorners[2]).distanceTo(new THREE.Vector3(...lastCorner))<1e-6);await page.locator('#undo').click();assertPins(await save(),clothId);
  await choose(hollowId);await page.locator('#delete').click();p=await save();assert.equal(p.frames[1].clothPins[2],null);await page.locator('#undo').click();assertPins(await save(),clothId);
  await choose(clothId);await page.locator('#cloth-sag').fill('180');p=await save();assert.equal(p.frames[1].clothSag,.18);
  await page.locator('#cloth-color').fill('#405068');p=await save();assert.equal(p.frames[1].clothColor,'#405068');
  // Add per-piece rigging, change length, rotate, and count it separately.
  await page.locator('#tab-ballast').click();await page.locator('#accessory-kind').selectOption('rigging');await page.locator('#add-rigging-length').fill('2500');await page.locator('#add-rigging-form button[type=submit]').click();
  assert.equal(await page.locator('#frame-height-label').textContent(),'Panjang');assert.ok(await page.locator('#frame-width').isHidden());
  await change('position-x',-2);await page.locator('[data-rotate=z]').click();await page.locator('#frame-height').fill('3000');p=await save();assert.equal(p.frames[3].height,3);assert.equal(p.frames[3].width,.29);assert.equal(p.frames[3].riggingKind,'segment');
  assert.match(await page.locator('#frame-summary-body').textContent(),/Rigging batang/);assert.match(await page.locator('#frame-summary-body').textContent(),/Kain penutup/);
  // Copy all targets and cloth, group the copies, and rotate together.
  await page.locator('#select-all').click();await page.locator('#duplicate').click();p=await save();assert.equal(p.frames.length,8);
  const copy=p.frames.find(f=>f.type==='cloth'&&f.id!==clothId);copy.clothPins.filter(Boolean).forEach(pin=>assert.ok(![frameId,hollowId].includes(pin.targetId)));assertPins(p,copy.id);
  await page.locator('#group-selection').click();await change('position-x',4);await page.locator('[data-rotate=y]').click();p=await save();assertPins(p,copy.id);
  // Offline standalone round trip, including all cloth data and templates.
  await choose(clothId);await page.locator('#accessory-kind').selectOption('cloth');p=await save();
  const restored=await context.newPage();await restored.goto(pathToFileURL(resolve('Contruction-Builder-LED-Rental.html')).href);await restored.locator('#loading').waitFor({state:'hidden'});
  await restored.locator('#project-file').setInputFiles(resolve(output,'cloth-roundtrip.json'));await restored.locator('#object-count').filter({hasText:'8'}).waitFor();
  let roundtrip=await save(restored,'cloth-restored.json');assert.equal(roundtrip.frames.length,8);assert.equal(roundtrip.palette.accessory,'cloth');
  for(const f of roundtrip.frames.filter(f=>f.type==='cloth'))assertPins(roundtrip,f.id);
  assert.deepEqual(roundtrip.frames.filter(f=>f.type==='cloth').map(f=>f.clothPins),p.frames.filter(f=>f.type==='cloth').map(f=>f.clothPins));
  await choose(clothId,restored);assert.equal(await restored.locator('#cloth-color').inputValue(),'#405068');assert.equal(await restored.locator('#cloth-sag').inputValue(),'180');
  // Bad pins cannot partially replace the project.
  const invalid=structuredClone(p);invalid.frames.find(f=>f.type==='cloth').clothPins[0].targetId='missing';await writeFile(resolve(output,'invalid-cloth.json'),JSON.stringify(invalid));
  await restored.locator('#project-file').setInputFiles(resolve(output,'invalid-cloth.json'));await restored.locator('#toast').filter({hasText:'Tujuan sudut kain tidak ditemukan'}).waitFor();assert.equal(await restored.locator('.object-row').count(),8);
  await restored.locator('[data-view=iso]').click();await restored.locator('#fit-all').click();await restored.locator('#cloth-edit-corners').click();await restored.locator('#cloth-controls').scrollIntoViewIfNeeded();await restored.screenshot({path:resolve(output,'kain-rigging-desktop.png')});
  const png=restored.waitForEvent('download');await restored.locator('#export-png').click();const pngFile=resolve(output,'kain-rigging-export.png');await(await png).saveAs(pngFile);assert.deepEqual([...(await readFile(pngFile)).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  await restored.setViewportSize({width:390,height:844});await restored.locator('#toggle-inspector').click();await restored.locator('#cloth-controls').scrollIntoViewIfNeeded();assert.ok(await restored.locator('#cloth-corner').isVisible());assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await restored.screenshot({path:resolve(output,'kain-mobile.png')});
  await restored.locator('#cloth-detach-all').click();roundtrip=await save(restored,'cloth-detached.json');assert.deepEqual(roundtrip.frames.find(f=>f.id===clothId).clothPins,[null,null,null,null]);
  const dropped=await context.newPage();await dropped.goto(pathToFileURL(resolve('index.html')).href);await dropped.locator('#loading').waitFor({state:'hidden'});await dropped.locator('#tab-ballast').click();await dropped.locator('#accessory-kind').selectOption('cloth');
  await dropped.locator('#cloth-palette').dragTo(dropped.locator('#viewport'),{targetPosition:{x:350,y:420}});assert.equal(await dropped.locator('.object-row').count(),2);
  await dropped.locator('[data-view=back]').click();const dropProject=await save(dropped,'cloth-drop.json'),dropCloth=dropProject.frames.find(f=>f.type==='cloth');assert.ok(dropCloth);
  await dropped.locator('#viewport').click({position:{x:30,y:300}});point=projectPoint(dropCloth,clothSurfacePoint(dropCloth,.5,.5).toArray(),dropProject.camera,await dropped.locator('#viewport').boundingBox());await dropped.mouse.click(point.x,point.y);assert.equal(await dropped.locator('#inspector-title').textContent(),'Properti kain');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS: flexible cloth add/style/size; pending-input JSON; free-corner numeric edits, real 3D handle drag and Esc cancellation; separate pins by dropdown and viewport click through cloth to locked hollow; follow transforms/resize; front/rear sides, detach, target/brace deletion and Undo/Redo; single truss length/rotation; mixed copy, remapped pins and group transforms; offline standalone and templates; invalid import preservation; mobile and PNG; no JS errors or remote requests.');
}finally{await browser.close();}
