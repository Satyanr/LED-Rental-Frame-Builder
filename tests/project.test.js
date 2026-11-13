import test from 'node:test';
import assert from 'node:assert/strict';
import {HOLLOW, LED_DEPTH, LED_BEZEL, BALLAST_PRESETS, MAX_FRAMES, DEFAULT_SETTINGS, dimension, braceSpacing, braceOffsetsMm, frameMembers, ledMembers, objectMembers, objectSummary, frameSummary, validateBallastTemplate, validateTie, tubeAnchor, normalizeDegrees, snapValue, validateProject, makeProject} from '../src/project.js';
import * as THREE from 'three';
import {memberGeometry, fitMeshesToDimensions, tieVisualPoints} from '../src/geometry.js';

const frame = () => ({id:'frame-01',name:'Frame 01',width:1,height:2,braceSpacingMm:0,position:[0,1,0],rotation:[0,90,0]});
const project = () => makeProject([frame()],DEFAULT_SETTINGS,null);

test('JSON round trip preserves dimensions, position, rotation and fixed hollow',()=>{
  const source=project();const parsed=validateProject(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(parsed.frames,source.frames);assert.deepEqual(parsed.settings,DEFAULT_SETTINGS);assert.equal(source.hollow.width,HOLLOW);assert.equal(source.hollow.height,.04);
});
test('invalid dimensions and nonfinite input are rejected',()=>{
  for(const value of [0,-1,.09,50.01,NaN,Infinity,'2',null])assert.throws(()=>dimension(value));
  assert.equal(dimension(.1),.1);assert.equal(dimension(50),50);
});
test('bad project never passes schema validation',()=>{
  for(const mutate of [
    p=>p.version=2,p=>p.units='mm',p=>p.hollow.width=.06,p=>p.frames[0].position=[0,1],
    p=>p.frames[0].rotation=[0,Infinity,0],p=>p.frames[0].position=[501,0,0],
    p=>p.frames.push({...frame()}),p=>p.frames=Array.from({length:MAX_FRAMES+1},(_,i)=>({...frame(),id:String(i)}))
  ]){const p=project();mutate(p);assert.throws(()=>validateProject(p));}
});
test('blank project works and untrusted labels remain plain text',()=>{
  assert.deepEqual(validateProject(makeProject([],DEFAULT_SETTINGS,null)).frames,[]);
  const p=project();p.frames[0].name='<img src=x onerror=alert(1)>';assert.equal(validateProject(p).frames[0].name,p.frames[0].name);
});
test('step snap works symmetrically and large rotations preserve orientation',()=>{
  assert.ok(Math.abs(snapValue(.36,.1)-.4)<1e-10);assert.ok(Math.abs(snapValue(-.36,.1)+.4)<1e-10);
  assert.equal(normalizeDegrees(450),90);assert.equal(normalizeDegrees(-450),-90);assert.equal(normalizeDegrees(360),0);
});
test('unknown settings fall back to allowed values',()=>{
  const p=project();p.settings={snap:'yes',positionStep:0,rotationStep:1,space:'scale',grid:'yes',dimensions:8};
  assert.deepEqual(validateProject(p).settings,DEFAULT_SETTINGS);
});
test('camera only restored with finite valid parameters',()=>{
  const p=project();p.camera={view:'top',type:'orthographic',position:[0,10,0],target:[0,0,0],up:[0,0,-1],span:6};
  assert.deepEqual(validateProject(p).camera,p.camera);p.camera.span=-1;assert.equal(validateProject(p).camera,null);
});

test('2000 x 2000 mm at 1000 mm creates one full-width internal tube at mid-height',()=>{
  const members=frameMembers(2,2,1000);
  assert.equal(members.length,5);assert.deepEqual(braceOffsetsMm(2,1000),[1000]);
  assert.deepEqual(members[4],{size:[1.92,.04,.04],position:[0,0,0]});
  const leftInner=-1+.04,rightInner=1-.04;
  assert.equal(members[4].position[0]-members[4].size[0]/2,leftInner);
  assert.equal(members[4].position[0]+members[4].size[0]/2,rightInner);
});
test('spacing repeats up the height and never duplicates outer perimeter tubes',()=>{
  assert.deepEqual(braceOffsetsMm(3,1000),[1000,2000]);
  assert.deepEqual(braceOffsetsMm(2,500),[500,1000,1500]);
  assert.deepEqual(braceOffsetsMm(2,2000),[]);
  assert.deepEqual(braceOffsetsMm(2,3000),[]);
  assert.deepEqual(braceOffsetsMm(2,1990),[]);
  assert.equal(frameMembers(2,2,0).length,4);
});
test('legacy projects open with no middle tubes and new projects preserve spacing and transforms',()=>{
  const legacy=project();delete legacy.frames[0].braceSpacingMm;
  assert.equal(validateProject(legacy).frames[0].braceSpacingMm,0);
  const p=project();p.frames[0].braceSpacingMm=1000;
  const result=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(result.frames,p.frames);assert.equal(frameMembers(result.frames[0].width,result.frames[0].height,result.frames[0].braceSpacingMm).length,5);
});
test('invalid and excessive middle-tube spacing are rejected before geometry is built',()=>{
  for(const value of [-1,1,99,NaN,Infinity,'1000',null,50001])assert.throws(()=>braceSpacing(value));
  assert.equal(braceSpacing(0),0);assert.equal(braceSpacing(1000),1000);
  assert.throws(()=>braceOffsetsMm(50,100),/200/);
  const p=project();p.frames=Array.from({length:8},(_,i)=>({...frame(),id:String(i),height:20.1,braceSpacingMm:100}));
  assert.throws(()=>validateProject(p),/1500/);
});

test('export preserves per-object spacing and a different Add Frame template across real JSON serialization',()=>{
  const frames=[{...frame(),braceSpacingMm:500},{...frame(),id:'second',braceSpacingMm:1000}];
  const template={width:2,height:3,braceSpacingMm:750};
  const serialized=JSON.stringify(makeProject(frames,DEFAULT_SETTINGS,null,template));
  const parsed=validateProject(JSON.parse(serialized));
  assert.deepEqual(parsed.frames.map(f=>f.braceSpacingMm),[500,1000]);
  assert.deepEqual(parsed.frameTemplate,template);
  assert.deepEqual(parsed.frames.map(f=>braceOffsetsMm(f.height,f.braceSpacingMm).length),[3,1]);
});
test('old JSON restores Add Frame from the first frame when the template was not saved',()=>{
  const p=project();delete p.frameTemplate;p.frames[0].braceSpacingMm=1000;
  assert.deepEqual(validateProject(p).frameTemplate,{width:1,height:2,braceSpacingMm:1000});
});
test('counts 20 frames of 2x2 and 10 of 2x1, independent of orientation, rotation and brace spacing',()=>{
  const frames=[...Array.from({length:20},(_,i)=>({...frame(),id:`square-${i}`,width:2,height:2,braceSpacingMm:i%2?1000:0})),...Array.from({length:10},(_,i)=>({...frame(),id:`rectangle-${i}`,width:i%2?1:2,height:i%2?2:1}))];
  assert.deepEqual(frameSummary(frames),{total:30,bySize:[{width:2,height:2,quantity:20},{width:2,height:1,quantity:10}]});
  const data=makeProject(frames,DEFAULT_SETTINGS,null);assert.deepEqual(data.summary,frameSummary(frames));
  data.summary.total=999;assert.equal(frameSummary(validateProject(data).frames).total,30);
});
test('counts respond to duplicate, deletion, resize and an empty scene',()=>{
  const frames=[frame()];frames.push({...frame(),id:'copy'});assert.equal(frameSummary(frames).bySize[0].quantity,2);
  frames[1].width=2;assert.equal(frameSummary(frames).bySize.length,2);
  frames.pop();assert.equal(frameSummary(frames).total,1);
  assert.deepEqual(frameSummary([]),{total:0,bySize:[]});
});

test('old v1.2 files without object types open as frames with inferred shapes',()=>{
  const legacy=project();delete legacy.frames[0].type;delete legacy.frames[0].shape;
  delete legacy.ledTemplate;delete legacy.palette;
  const p=validateProject(legacy);
  assert.equal(p.frames[0].type,'frame');assert.equal(p.frames[0].shape,'rectangle');
  assert.deepEqual(p.ledTemplate,{width:1,height:.5});assert.deepEqual(p.palette,{type:'frame',shape:'rectangle'});
});

test('square and rectangular frames preserve their shapes without changing perimeter geometry',()=>{
  const p=project();p.frames=[{...frame(),type:'frame',shape:'square',width:2,height:2},{...frame(),id:'rectangle',type:'frame',shape:'rectangle',width:3,height:1}];
  const parsed=validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(parsed.frames.map(f=>f.shape),['square','rectangle']);
  assert.equal(objectMembers(parsed.frames[0]).length,4);assert.equal(objectMembers(parsed.frames[1]).length,4);
  p.frames[0].height=1;assert.throws(()=>validateProject(p),/kotak/);
});

test('hollow straight member keeps a fixed 40 x 40 section and custom length',()=>{
  const hollow={...frame(),type:'hollow',width:HOLLOW,height:3.25};
  assert.deepEqual(objectMembers(hollow),[{size:[.04,3.25,.04],position:[0,0,0]}]);
  const parsed=validateProject(makeProject([hollow],DEFAULT_SETTINGS,null));
  assert.equal(parsed.frames[0].width,HOLLOW);assert.equal(parsed.frames[0].height,3.25);
  assert.deepEqual(parsed.frameTemplate,{width:1,height:2,braceSpacingMm:0});
  for(const change of [{width:.05},{braceSpacingMm:1000},{height:.09}])assert.throws(()=>makeProject([{...hollow,...change}],DEFAULT_SETTINGS,null));
});

test('LED presets and custom sizes have exact outside bounds and 2 mm bezels',()=>{
  for(const [width,height] of [[1,.5],[.5,.5],[1.28,.72],[.1,.1],[50,50]]){
    const [body,...screens]=ledMembers(width,height);
    assert.deepEqual(body.size,[width,height,LED_DEPTH]);assert.equal(screens.length,2);
    for(const screen of screens){
      assert.ok(Math.abs((width-screen.size[0])/2-LED_BEZEL)<1e-12);
      assert.ok(Math.abs((height-screen.size[1])/2-LED_BEZEL)<1e-12);
      assert.equal(Math.abs(screen.position[2]),LED_DEPTH/2+.0005);
    }
  }
  assert.throws(()=>ledMembers(.05,.5));assert.throws(()=>ledMembers(1,NaN));
});

test('two adjacent LED cabinets each retain a bezel at their shared boundary',()=>{
  const width=1,height=.5;
  const screen=ledMembers(width,height)[1];
  const firstRight=screen.size[0]/2,secondLeft=width-screen.size[0]/2;
  assert.ok(Math.abs(secondLeft-firstRight-2*LED_BEZEL)<1e-12);
});

test('mixed objects round trip types, dimensions, transforms, custom LED template and palette',()=>{
  const objects=[{...frame(),type:'frame',shape:'rectangle',braceSpacingMm:1000},{...frame(),id:'tube',type:'hollow',width:HOLLOW,height:2.5},{...frame(),id:'screen',type:'led',width:1.28,height:.72,position:[2,.36,.1],rotation:[0,45,0]}];
  const source=makeProject(objects,DEFAULT_SETTINGS,null,{width:2,height:3,braceSpacingMm:750},{width:1.28,height:.72},{type:'led',shape:'hollow'});
  const parsed=validateProject(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(parsed.frames,source.frames);assert.deepEqual(parsed.ledTemplate,{width:1.28,height:.72});
  assert.deepEqual(parsed.palette,{type:'led',shape:'hollow'});assert.equal(source.summary.total,1);assert.equal(source.objectsSummary.total,3);
});

test('material summary separates equal-size frames and screens and counts hollow lengths',()=>{
  const objects=[frame(),{...frame(),id:'led',type:'led'},{...frame(),id:'tube',type:'hollow',width:HOLLOW},{...frame(),id:'copy',type:'led',width:2,height:1}];
  const summary=objectSummary(objects);
  assert.equal(summary.total,4);assert.equal(summary.bySize.length,3);
  assert.equal(summary.bySize.find(x=>x.type==='led').quantity,2);
  assert.deepEqual(frameSummary(objects),frameSummary([frame()]));
  assert.equal(objectSummary(objects.slice(0,-1)).bySize.find(x=>x.type==='led').quantity,1);
});

test('invalid object types, screen braces and LED templates are rejected before import',()=>{
  for(const change of [{type:'unsupported'},{type:'led',braceSpacingMm:500},{type:'led',width:0},{type:'frame',shape:'triangle'}]){
    const p=project();Object.assign(p.frames[0],change);assert.throws(()=>validateProject(p));
  }
  for(const value of [null,[],{width:0,height:.5},{width:1,height:'500'},{width:Infinity,height:.5}]){
    const p=project();p.ledTemplate=value;assert.throws(()=>validateProject(p));
  }
});

const ballast = (kind='water-jerrycan',extra={}) => ({...frame(),id:kind,type:'ballast',ballastKind:kind,...BALLAST_PRESETS[kind],position:[1,BALLAST_PRESETS[kind].height/2,-.5],rotation:[0,45,0],...extra});

test('ballast kinds, custom depth, transforms, palette and creation template survive JSON round trips',()=>{
  const objects=[frame(),ballast(),ballast('concrete-block',{depth:.45,rotation:[90,20,45]})];
  const template={kind:'concrete-block',width:.8,height:.4,depth:.35};
  const source=makeProject(objects,DEFAULT_SETTINGS,null,undefined,undefined,{type:'ballast',shape:'rectangle'},template);
  const parsed=validateProject(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(parsed.frames,source.frames);assert.deepEqual(parsed.ballastTemplate,template);
  assert.equal(parsed.palette.type,'ballast');assert.equal(parsed.frames[2].depth,.45);
  assert.equal(source.summary.total,1);assert.equal(source.objectsSummary.total,3);
});

test('legacy files receive a default ballast template without changing existing objects',()=>{
  const p=project();delete p.ballastTemplate;
  assert.deepEqual(validateProject(p).ballastTemplate,{kind:'water-jerrycan',...BALLAST_PRESETS['water-jerrycan']});
  assert.deepEqual(validateProject(p).frames,p.frames);
});

test('unknown ballast kinds, missing depth, nonfinite dimensions and braces are rejected',()=>{
  for(const change of [{ballastKind:'stone'},{ballastKind:'__proto__'},{ballastKind:'unknown',kind:'water-jerrycan'},{depth:undefined},{depth:0},{depth:50.1},{depth:Infinity},{depth:'300'},{height:NaN},{braceSpacingMm:100}]){
    assert.throws(()=>makeProject([ballast('water-jerrycan',change)],DEFAULT_SETTINGS,null));
  }
  for(const value of [null,[],{kind:'stone',width:1,height:1,depth:1},{kind:'water-jerrycan',width:.35,height:.5}, {kind:'concrete-block',width:.6,height:.3,depth:-1}])assert.throws(()=>validateBallastTemplate(value));
  const p=project();p.ballastTemplate={kind:'unknown'};assert.throws(()=>validateProject(p));
});

test('ballast summaries distinguish type and depth, and count duplicate, resized and deleted objects',()=>{
  const objects=[ballast(),ballast('water-jerrycan',{id:'copy',rotation:[0,90,0]}),ballast('water-jerrycan',{id:'deep',depth:.4}),ballast('concrete-block',{width:.35,height:.5,depth:.25})];
  const summary=objectSummary(objects);assert.equal(summary.total,4);assert.equal(summary.bySize.length,3);
  assert.equal(summary.bySize.find(f=>f.ballastKind==='water-jerrycan'&&f.depth===.25).quantity,2);
  assert.equal(frameSummary(objects).total,0);
  objects[1].depth=.4;assert.equal(objectSummary(objects).bySize.find(f=>f.depth===.4).quantity,2);
  objects.pop();assert.equal(objectSummary(objects).total,3);
});

test('rendered ballast bounds match outside dimensions and rest exactly on the floor, including rope',()=>{
  for(const kind of Object.keys(BALLAST_PRESETS))for(const dimensions of [BALLAST_PRESETS[kind],{width:.1,height:.1,depth:.1},{width:1.2,height:.7,depth:.8},{width:50,height:.1,depth:.1}]){
    const data=ballast(kind,dimensions),members=objectMembers(data),group=new THREE.Group();
    for(const member of members){
      const mesh=new THREE.Mesh(memberGeometry(member));mesh.position.fromArray(member.position??[0,0,0]);group.add(mesh);
      assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    }
    fitMeshesToDimensions(group.children,[data.width,data.height,data.depth]);
    group.position.y=data.height/2;group.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3());
    for(const [i,value] of [data.width,data.height,data.depth].entries())assert.ok(Math.abs(size.getComponent(i)-value)<1e-5,`${kind}: dimension ${i}`);
    assert.ok(Math.abs(box.min.y)<1e-6,`${kind}: floor`);
    if(kind==='water-jerrycan'){
      assert.ok(members.some(m=>m.surface==='cap'));assert.ok(members.filter(m=>m.geometry==='rope'&&m.closed).length>=3);
    }
    group.rotation.set(.2,.5,.8);group.updateMatrixWorld(true);
    group.position.y-=new THREE.Box3().setFromObject(group).min.y;group.updateMatrixWorld(true);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(group).min.y)<1e-6);
    group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  }
});

test('ties and object locks survive JSON while old objects default to unlocked',()=>{
  const target={...frame(),locked:true},source=ballast('water-jerrycan',{tie:{targetId:target.id,memberIndex:0,t:.75}});
  const p=makeProject([target,source],DEFAULT_SETTINGS,null);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).frames,p.frames);
  assert.equal(p.frames[0].locked,true);assert.equal(p.frames[1].locked,false);
  delete p.frames[0].locked;assert.equal(validateProject(p).frames[0].locked,false);
  for(const locked of [0,1,'yes',null])assert.throws(()=>makeProject([{...frame(),locked}],DEFAULT_SETTINGS,null));
});

test('invalid, dangling, wrong-type and missing-member ties are rejected atomically',()=>{
  const target=frame(),tie={targetId:target.id,memberIndex:0,t:.5};
  for(const change of [{targetId:'missing'},{targetId:''},{targetId:42},{memberIndex:4},{memberIndex:-1},{memberIndex:1.5},{t:-.1},{t:1.1},{t:'50'},{t:NaN}])assert.throws(()=>makeProject([target,ballast('water-jerrycan',{tie:{...tie,...change}})],DEFAULT_SETTINGS,null));
  for(const type of ['led','ballast']){
    const wrongTarget=type==='led'?{...target,type}:ballast('concrete-block',{id:target.id});
    assert.throws(()=>makeProject([wrongTarget,ballast('water-jerrycan',{tie})],DEFAULT_SETTINGS,null));
  }
  assert.throws(()=>makeProject([target,ballast('concrete-block',{tie})],DEFAULT_SETTINGS,null));
  assert.throws(()=>validateTie([]));
});

test('tie anchors stay on selected perimeter, brace and straight hollow members',()=>{
  const target={...frame(),width:2,height:2,braceSpacingMm:1000};
  assert.deepEqual(tubeAnchor(target,{targetId:target.id,memberIndex:0,t:.5}),{axis:0,position:[0,.98,0]});
  assert.deepEqual(tubeAnchor(target,{targetId:target.id,memberIndex:2,t:.5}),{axis:1,position:[.98,0,0]});
  assert.deepEqual(tubeAnchor(target,{targetId:target.id,memberIndex:4,t:.5}),{axis:0,position:[0,0,0]});
  for(const t of [0,.25,.5,.75,1]){
    const anchor=tubeAnchor(target,{targetId:target.id,memberIndex:0,t});assert.ok(Math.abs(anchor.position[0])<=.98);
  }
  const straight={...target,type:'hollow',width:HOLLOW,height:3,braceSpacingMm:0};
  assert.deepEqual(tubeAnchor(straight,{targetId:target.id,memberIndex:0,t:.5}),{axis:1,position:[0,0,0]});
  assert.equal(tubeAnchor({...target,width:.1,height:.1,braceSpacingMm:0},{targetId:target.id,memberIndex:2,t:.5}).axis,1);
});

test('coincident tether endpoints produce finite geometry without a zero-length path failure',()=>{
  const geometry=memberGeometry({geometry:'rope',points:[[1,2,3],[1,2,3]],radius:.005});
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite));geometry.dispose();
});

test('tether starts at the upper rear of the container and follows both objects through transforms',()=>{
  const target={...frame(),width:2,rotation:[0,0,0]},source=ballast('water-jerrycan',{rotation:[0,0,0],tie:{targetId:target.id,memberIndex:0,t:.5}});
  const before=tieVisualPoints(source,target);
  assert.deepEqual(before.start,[source.position[0]+source.width*.08,source.position[1]+source.height*.4,source.position[2]-source.depth*.1]);
  before.end.forEach((n,i)=>assert.ok(Math.abs(n-[0,1.98,-.026][i])<1e-12));
  const delta=[2,3,-4],moved={...target,position:target.position.map((n,i)=>n+delta[i])},after=tieVisualPoints(source,moved);
  assert.deepEqual(after.start,before.start);after.end.forEach((n,i)=>assert.ok(Math.abs(n-before.end[i]-delta[i])<1e-12));
  const rotated=tieVisualPoints(source,{...target,rotation:[0,90,0]});
  assert.ok(Math.abs(rotated.end[0]+.026)<1e-12);assert.ok(Math.abs(rotated.end[2])<1e-12);
  const wider=tieVisualPoints({...source,tie:{...source.tie,t:1}},{...target,width:4});assert.ok(Math.abs(wider.end[0]-1.98)<1e-12);
  for(const points of [before,after,rotated,wider])assert.ok([...points.start,...points.end,...points.loop.flat()].every(Number.isFinite));
});
