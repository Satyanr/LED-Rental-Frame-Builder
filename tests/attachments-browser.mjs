import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve('.verification');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--disable-background-networking']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,offline:true});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
const page=await context.newPage();
const change=async(id,value)=>{await page.locator(`#${id}`).fill(String(value));await page.locator(`#${id}`).press('Tab');};
const choose=async id=>page.locator(`.object-row[data-id="${id}"]`).click();
const save=async(name='tali-dan-kunci.json')=>{
  const pending=page.waitForEvent('download');await page.locator('#save-project').evaluate(b=>b.click());
  await (await pending).saveAs(resolve(output,name));return JSON.parse(await readFile(resolve(output,name),'utf8'));
};
function projectPoint(frame,local,camera,rect){
  const aspect=rect.width/rect.height,span=camera.span;
  const view=camera.type==='orthographic'?new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.01,15000):new THREE.PerspectiveCamera(40,aspect,.01,15000);
  view.up.fromArray(camera.up);view.position.fromArray(camera.position);view.lookAt(new THREE.Vector3(...camera.target));view.updateMatrixWorld(true);
  const world=new THREE.Vector3(...local).applyEuler(new THREE.Euler(...frame.rotation.map(THREE.MathUtils.degToRad),'XYZ')).add(new THREE.Vector3(...frame.position)).project(view);
  return {x:rect.x+(world.x+1)*rect.width/2,y:rect.y+(1-world.y)*rect.height/2};
}
async function dragAt(point){await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+60,point.y+20,{steps:8});await page.mouse.up();}
try{
  await page.goto(pathToFileURL(resolve('index.html')).href);await page.locator('#loading').waitFor({state:'hidden'});
  await change('frame-width',2000);await change('frame-brace-spacing',1000);await page.locator('[data-view=front]').click();
  await page.locator('#object-locked').check();assert.ok(await page.locator('#position-x').isDisabled());assert.ok(await page.locator('#rotation-y').isDisabled());assert.ok(await page.locator('#ground-frame').isDisabled());
  let p=await save();const frameId=p.frames[0].id;assert.equal(p.frames[0].locked,true);
  const rect=await page.locator('#viewport').boundingBox();
  await dragAt(projectPoint(p.frames[0],[0,.98,0],p.camera,rect));
  // Even synthetic change events must respect the lock.
  await page.locator('#position-x').evaluate(el=>{el.value='42';el.dispatchEvent(new Event('change'));});
  await page.locator('#rotation-y').evaluate(el=>{el.value='90';el.dispatchEvent(new Event('change'));});
  let locked=await save();assert.deepEqual(locked.frames[0].position,p.frames[0].position);assert.deepEqual(locked.frames[0].rotation,p.frames[0].rotation);
  await page.locator('#object-locked').uncheck();await dragAt(projectPoint(p.frames[0],[0,.98,0],p.camera,rect));
  const moved=await save();assert.notDeepEqual(moved.frames[0].position,p.frames[0].position);
  await change('position-x',0);await change('position-y',1);await change('position-z',0);await page.locator('#object-locked').check();
  await page.locator('#undo').click();assert.ok(!(await page.locator('#object-locked').isChecked()));
  await page.locator('#redo').click();assert.ok(await page.locator('#object-locked').isChecked());
  await page.locator('#tab-ballast').click();await page.locator('#add-ballast-form button[type=submit]').click();
  await change('position-x',.6);await change('position-z',1);
  await page.locator('#tie-target').selectOption(frameId);await change('tie-position',75);
  p=await save();const sourceId=p.frames[1].id;
  assert.deepEqual(p.frames[1].tie,{targetId:frameId,memberIndex:0,t:.75});assert.equal(p.frames[0].locked,true);
  await page.locator('[data-view=iso]').click();await page.locator('#dimensions-enabled').uncheck();await page.locator('#fit-all').click();
  await page.locator('#tie-controls').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,'tali-jerigen-ke-hollow.png')});
  const statusBefore=await page.locator('#tie-status').textContent();await change('position-z',1.5);
  assert.notEqual(await page.locator('#tie-status').textContent(),statusBefore);
  await page.locator('[data-view=front]').click();p=await save();
  const targetPoint=projectPoint(p.frames[0],[-.25,0,0],p.camera,await page.locator('#viewport').boundingBox());
  await page.locator('#tie-pick').click();assert.ok(await page.locator('#tie-pick-banner').isVisible());await page.mouse.click(targetPoint.x,targetPoint.y);
  assert.ok(await page.locator('#tie-pick-banner').isHidden());assert.match(await page.locator('#selected-type').textContent(),/JERIGEN/);
  p=await save();assert.equal(p.frames[1].tie.memberIndex,4);assert.ok(Math.abs(p.frames[1].tie.t-(.5-.25/1.88))<.015);assert.equal(p.frames[0].locked,true);
  await page.locator('#tie-pick').click();await page.keyboard.press('Escape');assert.ok(await page.locator('#tie-pick-banner').isHidden());
  await page.locator('#tie-detach').click();assert.ok(!(await save()).frames[1].tie);
  await page.locator('#undo').click();assert.ok((await save()).frames[1].tie);
  await page.locator('#redo').click();assert.ok(!(await save()).frames[1].tie);await page.locator('#undo').click();
  await choose(frameId);await change('frame-brace-spacing',0);
  assert.ok(!(await save()).frames[1].tie);await page.locator('#undo').click();assert.equal((await save()).frames[1].tie.memberIndex,4);
  await choose(frameId);await page.locator('#delete').click();p=await save();assert.equal(p.frames.length,1);assert.ok(!p.frames[0].tie);
  await page.locator('#undo').click();p=await save();assert.equal(p.frames.length,2);assert.equal(p.frames[1].tie.targetId,frameId);
  await page.locator('#tab-frame').click();await page.locator('#shape-hollow').click();await page.locator('#add-form button[type=submit]').click();await change('position-x',-1);
  p=await save();const hollowId=p.frames[2].id;
  await choose(sourceId);await page.locator('#tie-target').selectOption(hollowId);await change('tie-position',90);
  await choose(hollowId);await change('rotation-z',45);await change('position-z',-.5);
  await choose(sourceId);assert.match(await page.locator('#tie-status').textContent(),/Hollow/);
  await page.locator('#tie-target').selectOption(frameId);await page.locator('#tie-member').selectOption('0');await page.locator('#tie-position').fill('90');
  p=await save('tali-dan-kunci.json');assert.equal(p.frames[1].tie.t,.9);
  const invalid=structuredClone(p);invalid.frames[1].tie.targetId='missing';await writeFile(resolve(output,'invalid-tie.json'),JSON.stringify(invalid));
  await page.locator('#project-file').setInputFiles(resolve(output,'invalid-tie.json'));await page.locator('#toast').filter({hasText:'Tujuan tali tidak ditemukan'}).waitFor();assert.equal(await page.locator('.object-row').count(),3);assert.ok(!(await page.locator('#confirm-dialog').isVisible()));
  const restored=await context.newPage();await restored.goto(pathToFileURL(resolve('Contruction-Builder-LED-Rental.html')).href);await restored.locator('#loading').waitFor({state:'hidden'});
  await restored.locator('#project-file').setInputFiles(resolve(output,'tali-dan-kunci.json'));await restored.locator('#object-count').filter({hasText:'3'}).waitFor();
  assert.ok(await restored.locator('#object-locked').isChecked());assert.ok(await restored.locator('#position-x').isDisabled());
  await restored.locator(`.object-row[data-id="${sourceId}"]`).click();assert.equal(await restored.locator('#tie-position').inputValue(),'90');assert.equal(await restored.locator('#tie-target').inputValue(),frameId);
  await restored.locator('#duplicate').click();assert.ok(!(await restored.locator('#object-locked').isChecked()));await restored.locator('#tie-position').fill('20');await restored.locator('#tie-position').press('Tab');
  await restored.locator(`.object-row[data-id="${sourceId}"]`).click();assert.equal(await restored.locator('#tie-position').inputValue(),'90');
  await restored.setViewportSize({width:390,height:844});await restored.locator('#toggle-inspector').click();await restored.locator('#tie-controls').scrollIntoViewIfNeeded();
  assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await restored.screenshot({path:resolve(output,'tali-mobile.png')});
  const png=page.waitForEvent('download');await page.locator('[data-view=iso]').click();await page.locator('#fit-all').click();await page.locator('#export-png').click();await (await png).saveAs(resolve(output,'tali-export.png'));
  assert.deepEqual(errors,[]);
  console.log('PASS: lock blocks viewport drag and synthetic transforms; unlock and Undo/Redo work; attach by dropdown and viewport to locked frames; choose brace/position; cancel, detach, delete-target and remove-brace recovery; retarget straight hollow and follow rotations; pending-input JSON, invalid-import preservation, offline standalone, independent duplicate ties, mobile controls, PNG export; no browser errors.');
}finally{await browser.close();}
