import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {wheelMountPose} from '../src/geometry.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('.verification');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,offline:true});
const errors=[],remoteRequests=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))remoteRequests.push(r.url());});});
const page=await context.newPage();
const change=async(id,value)=>{await page.locator(`#${id}`).fill(String(value));await page.locator(`#${id}`).press('Tab');};
const choose=async id=>page.locator(`.object-row[data-id="${id}"]`).click();
const save=async(p=page,name='aksesoris-roundtrip.json')=>{
  const pending=p.waitForEvent('download');await p.locator('#save-project').evaluate(b=>b.click());
  const file=resolve(output,name);await (await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'));
};
function assertMount(p,wheelId){
  const wheel=p.frames.find(f=>f.id===wheelId),target=p.frames.find(f=>f.id===wheel.mount?.targetId);assert.ok(target);
  const expected=wheelMountPose(wheel,target);
  assert.ok(new THREE.Vector3(...wheel.position).distanceTo(new THREE.Vector3(...expected.position))<2e-6);
  const q=f=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...f.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
  assert.ok(q(wheel).angleTo(q(expected))<1e-6);
}
function projectPoint(frame,local,camera,rect){
  const aspect=rect.width/rect.height,span=camera.span;
  const view=camera.type==='orthographic'?new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.01,15000):new THREE.PerspectiveCamera(40,aspect,.01,15000);
  view.up.fromArray(camera.up);view.position.fromArray(camera.position);view.lookAt(new THREE.Vector3(...camera.target));view.updateMatrixWorld(true);
  const point=new THREE.Vector3(...local).applyEuler(new THREE.Euler(...frame.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...frame.position)).project(view);
  return {x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2};
}
try{
  await page.goto(pathToFileURL(resolve('index.html')).href);await page.locator('#loading').waitFor({state:'hidden'});
  assert.equal(await page.locator('#tab-ballast').textContent(),'Aksesoris LED');
  await change('position-y',1.18);let p=await save();const targetId=p.frames[0].id;
  await page.locator('#object-locked').check();
  await page.locator('#tab-ballast').click();await page.locator('#accessory-kind').selectOption('wheel');
  assert.ok(await page.locator('#ballast-accessory-panel').isHidden());
  await page.locator('#add-wheel-form button[type=submit]').click();
  assert.equal(await page.locator('#inspector-title').textContent(),'Properti roda');
  p=await save();const wheelId=p.frames[1].id;
  await page.locator('#tie-target').selectOption(targetId);await page.locator('#tie-member').selectOption('1');await change('tie-position',15);
  p=await save();assertMount(p,wheelId);assert.ok(await page.locator('#position-x').isDisabled());
  await choose(targetId);await page.locator('#object-locked').uncheck();await change('position-x',.75);await change('rotation-y',25);await change('frame-width',2500);
  p=await save();assertMount(p,wheelId);assert.equal(p.frames[1].mount.t,.15);
  await choose(wheelId);await change('frame-height',220);p=await save();assertMount(p,wheelId);assert.equal(p.frames[1].height,.22);
  await page.locator('#position-x').evaluate(el=>{el.value='42';el.dispatchEvent(new Event('change'));});p=await save();assertMount(p,wheelId);
  await page.locator('#tie-detach').click();assert.ok(!(await save()).frames[1].mount);assert.ok(await page.locator('#position-x').isEnabled());
  await page.locator('#undo').click();assertMount(await save(),wheelId);await page.locator('#redo').click();assert.ok(!(await save()).frames[1].mount);await page.locator('#undo').click();
  await choose(targetId);await change('rotation-y',0);await change('position-x',0);await page.locator('#object-locked').check();
  await page.locator('[data-view=front]').click();p=await save();
  const point=projectPoint(p.frames[0],[.75,-.98,0],p.camera,await page.locator('#viewport').boundingBox());
  await choose(wheelId);await page.locator('#tie-pick').click();await page.mouse.click(point.x,point.y);
  assert.ok(await page.locator('#tie-pick-banner').isHidden());p=await save();assert.equal(p.frames[1].mount.memberIndex,1);assertMount(p,wheelId);
  await page.locator('#tie-pick').click();await page.keyboard.press('Escape');assert.ok(await page.locator('#tie-pick-banner').isHidden());
  // A wheel can also mount to a brace or vertical straight hollow.
  await choose(targetId);await change('frame-brace-spacing',1000);
  await choose(wheelId);await page.locator('#tie-member').selectOption('4');assertMount(await save(),wheelId);
  await choose(targetId);await change('frame-brace-spacing',0);assert.ok(!(await save()).frames[1].mount);await page.locator('#undo').click();assertMount(await save(),wheelId);
  await page.locator('#tab-frame').click();await page.locator('#shape-hollow').click();await page.locator('#add-form button[type=submit]').click();await change('position-x',-2);
  p=await save();const hollowId=p.frames[2].id;
  await choose(wheelId);await page.locator('#tie-target').selectOption(hollowId);await change('tie-position',80);assertMount(await save(),wheelId);
  await choose(hollowId);await change('rotation-z',90);await change('position-y',.4);assertMount(await save(),wheelId);
  await choose(wheelId);await page.locator('#tie-target').selectOption(targetId);await page.locator('#tie-member').selectOption('1');await change('tie-position',15);
  await choose(hollowId);await page.locator('#delete').click();
  // Copy a mixed selection: mounts must point at the copied frame.
  await choose(targetId);await page.locator(`.object-row[data-id="${wheelId}"]`).click({modifiers:['Control']});await page.locator('#duplicate').click();
  p=await save();assert.equal(p.frames.length,4);const copiedWheel=p.frames.find(f=>f.type==='wheel'&&f.id!==wheelId);assert.notEqual(copiedWheel.mount.targetId,targetId);assertMount(p,copiedWheel.id);
  await change('position-x',3);p=await save();assertMount(p,copiedWheel.id);
  await page.locator('#undo').click();await page.locator('#undo').click();p=await save();assert.equal(p.frames.length,2);
  await choose(targetId);await page.locator('#delete').click();assert.ok(!(await save()).frames[0].mount);await page.locator('#undo').click();assertMount(await save(),wheelId);
  // Resize rigging and verify pending input, summary, templates, and Undo/Redo.
  await page.locator('#tab-ballast').click();await page.locator('#accessory-kind').selectOption('rigging');
  await page.locator('#add-rigging-length').fill('3200');await page.locator('#add-rigging-form button[type=submit]').click();
  assert.equal(await page.locator('#inspector-title').textContent(),'Properti rigging');assert.ok(await page.locator('#frame-depth-field').isHidden());
  assert.ok(await page.locator('#frame-width').isDisabled());assert.equal(await page.locator('#frame-width').inputValue(),'290');
  await change('position-x',3);await change('frame-height',3600);await change('frame-height',50);assert.equal(await page.locator('#frame-height').inputValue(),'3600');
  await page.locator('#undo').click();assert.equal(await page.locator('#frame-height').inputValue(),'3200');await page.locator('#redo').click();
  await page.locator('#frame-height').fill('2600');p=await save();assert.equal(p.frames[2].height,2.6);assert.equal(p.frames[2].type,'rigging');assert.equal(p.palette.accessory,'rigging');
  assert.match(await page.locator('#frame-summary-body').textContent(),/Rigging batang/);assert.match(await page.locator('#frame-summary-body').textContent(),/Roda caster/);
  // Load both new objects in the offline standalone and keep the creation controls.
  const restored=await context.newPage();await restored.goto(pathToFileURL(resolve('Contruction-Builder-LED-Rental.html')).href);await restored.locator('#loading').waitFor({state:'hidden'});
  await restored.locator('#project-file').setInputFiles(resolve(output,'aksesoris-roundtrip.json'));await restored.locator('#object-count').filter({hasText:'3'}).waitFor();
  assert.equal(await restored.locator('#accessory-kind').inputValue(),'rigging');assert.equal(await restored.locator('#add-rigging-length').inputValue(),'3200');
  const loaded=await save(restored,'aksesoris-restored.json');assert.deepEqual(loaded.frames,p.frames);assertMount(loaded,wheelId);
  // Invalid mount input must preserve the existing scene.
  const invalid=structuredClone(p);invalid.frames[1].mount.targetId='missing';await writeFile(resolve(output,'invalid-mount.json'),JSON.stringify(invalid));
  await restored.locator('#project-file').setInputFiles(resolve(output,'invalid-mount.json'));await restored.locator('#toast').filter({hasText:'Tujuan dudukan roda tidak ditemukan'}).waitFor();assert.equal(await restored.locator('.object-row').count(),3);
  await restored.locator('[data-view=iso]').click();await restored.locator('#fit-all').click();await restored.screenshot({path:resolve(output,'aksesoris-desktop.png')});
  const png=restored.waitForEvent('download');await restored.locator('#export-png').click();await(await png).saveAs(resolve(output,'aksesoris-export.png'));
  await restored.setViewportSize({width:390,height:844});await restored.locator('#toggle-library').click();await restored.locator('#accessory-kind').selectOption('wheel');await restored.screenshot({path:resolve(output,'aksesoris-mobile.png')});
  assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await restored.locator('#toggle-library').click();await restored.locator(`.object-row[data-id="${wheelId}"]`).evaluate(b=>b.click());await restored.locator('#toggle-inspector').click();await restored.locator('#tie-controls').scrollIntoViewIfNeeded();assert.ok(await restored.locator('#tie-pick').isVisible());
  // File from before accessories still loads with the old ballast UI.
  const legacy=await context.newPage();await legacy.goto(pathToFileURL(resolve('index.html')).href);await legacy.locator('#loading').waitFor({state:'hidden'});
  await legacy.locator('#project-file').setInputFiles(resolve('contoh-frame-dan-pemberat.json'));await legacy.locator('.object-icon.ballast').first().waitFor();assert.equal(await legacy.locator('#accessory-kind').inputValue(),'ballast');
  // Exercise actual card drops and mesh picking for both new geometries.
  const drops=await context.newPage();await drops.goto(pathToFileURL(resolve('index.html')).href);await drops.locator('#loading').waitFor({state:'hidden'});
  await drops.locator('#new-project').click();await drops.locator('#confirm-ok').click();await drops.locator('#tab-ballast').click();await drops.locator('#accessory-kind').selectOption('wheel');
  await drops.locator('#wheel-palette').dragTo(drops.locator('#viewport'),{targetPosition:{x:390,y:430}});assert.equal(await drops.locator('.object-row').count(),1);
  await drops.locator('[data-view=front]').click();await drops.locator('#fit-all').click();let dropped=await save(drops,'accessory-drop.json');assert.equal(dropped.frames[0].type,'wheel');
  assert.ok(Math.abs(dropped.frames[0].position[1]-dropped.frames[0].height/2)<1e-6);
  await drops.locator('#viewport').click({position:{x:30,y:300}});
  const wheelPoint=projectPoint(dropped.frames[0],[0,-dropped.frames[0].height*.175,0],dropped.camera,await drops.locator('#viewport').boundingBox());await drops.mouse.click(wheelPoint.x,wheelPoint.y);
  assert.equal(await drops.locator('#inspector-title').textContent(),'Properti roda');
  await drops.locator('[data-view=iso]').click();await drops.locator('#viewport').click({position:{x:30,y:300}});await drops.screenshot({path:resolve(output,'roda-caster-detail.png')});
  await drops.locator('#accessory-kind').selectOption('rigging');await drops.locator('#rigging-palette').dragTo(drops.locator('#viewport'),{targetPosition:{x:480,y:420}});assert.equal(await drops.locator('.object-row').count(),2);
  assert.equal(await drops.locator('#inspector-title').textContent(),'Properti rigging');
  await drops.locator('[data-view=front]').click();await drops.locator('#fit-all').click();dropped=await save(drops,'accessory-drop.json');
  await drops.locator('#viewport').click({position:{x:30,y:300}});const r=dropped.frames[1],riggingPoint=projectPoint(r,[.12,0,.12],dropped.camera,await drops.locator('#viewport').boundingBox());await drops.mouse.click(riggingPoint.x,riggingPoint.y);
  assert.equal(await drops.locator('#inspector-title').textContent(),'Properti rigging');
  assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
  console.log('PASS: accessories tab; caster dimensions and attachment by click/dropdown to locked frames, braces and straight hollow; follow move/rotation/resize; detach, deletion and Undo/Redo; clone mount remapping and shared transforms; custom truss dimensions; invalid input/import preservation; pending-input JSON and offline standalone round trip; old ballast JSON; new card drag/drop and mesh picking; desktop/mobile and PNG; no JavaScript errors or network requests.');
}finally{await browser.close();}
