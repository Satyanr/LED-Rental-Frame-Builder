// Project format is deliberately independent of Three.js and the DOM.
export const HOLLOW = 0.04;
export const APP_VERSION = '1.8.0';
export const WHEEL_PRESET = Object.freeze({width:.12,height:.18,depth:.1});
export const RIGGING_DEPTH = .29;
export const LED_DEPTH = 0.08;
export const LED_BEZEL = 0.002;
export const MAX_FRAMES = 300;
export const MAX_BRACES_PER_FRAME = 200;
export const MAX_PROJECT_BRACES = 1500;
export const LIMIT_POSITION = 500;
export const DEFAULT_SETTINGS = Object.freeze({snap:false, positionStep:0.1, rotationStep:15, grid:true, dimensions:true, space:'world'});
export const POSITION_STEPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
export const ROTATION_STEPS = [5, 15, 45, 90];
export const BALLAST_PRESETS = Object.freeze({
  'water-jerrycan':Object.freeze({width:.35,height:.5,depth:.25}),
  'concrete-block':Object.freeze({width:.6,height:.3,depth:.3}),
});
export const isBallast = data => data.type==='ballast';
export const isJerrycan = data => isBallast(data)&&data.ballastKind==='water-jerrycan';
export const isWheel = data => data.type==='wheel';
export const isCloth = data => data.type==='cloth';
export const isRiggingSegment = data => data.type==='rigging'&&(data.riggingKind==='segment'||data.riggingKind!=='legacy-frame'&&data.width===RIGGING_DEPTH);
export const hasDepth = data => isBallast(data)||isWheel(data);
export const isCustomGeometry = data => hasDepth(data)||data.type==='rigging'||isCloth(data);
export function validateWheelTemplate(value=WHEEL_PRESET) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ukuran roda tidak valid.');
  return {width:dimension(value.width,'Lebar roda'),height:dimension(value.height,'Tinggi roda'),depth:dimension(value.depth,'Kedalaman roda')};
}
export function validateRiggingTemplate(value={length:2}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ukuran rigging tidak valid.');
  if(value.length===undefined&&value.width!==undefined){numeric(value.width,.6,50,'Lebar rigging lama (meter)');numeric(value.height,.6,50,'Tinggi rigging lama (meter)');}
  return {length:dimension(value.length??value.height,'Panjang rigging')};
}
export function validateClothTemplate(value={width:2,height:2,color:'#20242a',sag:.03}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Pengaturan kain tidak valid.');
  const color=value.color??'#20242a';if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Warna kain harus berupa warna hex enam digit.');
  return {width:dimension(value.width,'Lebar kain'),height:dimension(value.height,'Tinggi kain'),color:color.toLowerCase(),sag:numeric(value.sag??.03,0,5,'Gelombang kain (meter)')};
}
export const defaultClothCorners = (w,h) => [[-w/2,h/2,0],[w/2,h/2,0],[w/2,-h/2,0],[-w/2,-h/2,0]];
export function validateClothPin(pin) {
  const side=pin.side??1;if(side!==1&&side!==-1)throw new Error('Sisi pemasangan kain tidak valid.');
  return {...validateTie(pin),side};
}
export function validateCloth(data) {
  const template=validateClothTemplate({width:data.width,height:data.height,color:data.clothColor,sag:data.clothSag});
  const corners=data.clothCorners??defaultClothCorners(template.width,template.height),pins=data.clothPins??[null,null,null,null];
  if(!Array.isArray(corners)||corners.length!==4||corners.some(p=>!Array.isArray(p)||p.length!==3))throw new Error('Kain harus memiliki empat titik sudut XYZ.');
  if(!Array.isArray(pins)||pins.length!==4)throw new Error('Kain harus memiliki empat pengaturan sambungan sudut.');
  return {clothColor:template.color,clothSag:template.sag,clothCorners:corners.map(p=>p.map(n=>numeric(n,-1000,1000,'Koordinat sudut kain'))),clothPins:pins.map(p=>p===null?null:validateClothPin(p))};
}
export const isTubeTarget = data => !data.type||data.type==='frame'||data.type==='hollow';
export function validateTie(tie) {
  if(!tie||typeof tie!=='object'||Array.isArray(tie)||typeof tie.targetId!=='string'||!tie.targetId.length||tie.targetId.length>=100)throw new Error('Tujuan tali tidak valid.');
  if(!Number.isInteger(tie.memberIndex)||tie.memberIndex<0||tie.memberIndex>=MAX_BRACES_PER_FRAME+4)throw new Error('Batang tujuan tali tidak valid.');
  return {targetId:tie.targetId,memberIndex:tie.memberIndex,t:numeric(tie.t,0,1,'Titik ikat tali')};
}
export function tubeAnchor(target,tie) {
  if(!isTubeTarget(target))throw new Error('Tali hanya dapat diikat ke frame atau hollow lurus.');
  const member=objectMembers(target)[validateTie(tie).memberIndex];
  if(!member)throw new Error('Batang tujuan tali sudah tidak tersedia.');
  const axis=target.type==='hollow'||tie.memberIndex===2||tie.memberIndex===3?1:0,position=[...member.position];
  position[axis]+=(tie.t-.5)*Math.max(0,member.size[axis]-HOLLOW);
  return {axis,position};
}
export function validateConnections(frames) {
  const byId=new Map(frames.map(f=>[f.id,f]));
  for(const f of frames)if(f.tie){
    const target=byId.get(f.tie.targetId);
    if(!target||target.id===f.id)throw new Error('Tujuan tali tidak ditemukan dalam proyek.');
    tubeAnchor(target,f.tie);
  }
  for(const f of frames)if(f.mount){
    const target=byId.get(f.mount.targetId);
    if(!target||target.id===f.id)throw new Error('Tujuan dudukan roda tidak ditemukan dalam proyek.');
    tubeAnchor(target,f.mount);
  }
  for(const f of frames)if(isCloth(f))for(const pin of f.clothPins){
    if(!pin)continue;const target=byId.get(pin.targetId);
    if(!target||target.id===f.id)throw new Error('Tujuan sudut kain tidak ditemukan dalam proyek.');
    tubeAnchor(target,pin);
  }
  return frames;
}
export function objectLabel(data) {return isCloth(data)?'Kain penutup':isWheel(data)?'Roda caster':data.type==='rigging'?isRiggingSegment(data)?'Rigging batang':'Rigging lama (keliling)':isBallast(data)?data.ballastKind==='water-jerrycan'?'Jerigen air bertali':'Balok semen':data.type==='led'?'LED Screen':data.type==='hollow'?'Hollow lurus':'Frame';}
export function validateBallastTemplate(value={kind:'water-jerrycan',...BALLAST_PRESETS['water-jerrycan']}) {
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(BALLAST_PRESETS,value.kind))throw new Error('Jenis pemberat tidak didukung.');
  return {kind:value.kind,width:dimension(value.width,'Lebar pemberat'),height:dimension(value.height,'Tinggi pemberat'),depth:dimension(value.depth,'Kedalaman pemberat')};
}
export function uid() { return globalThis.crypto?.randomUUID?.() ?? `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
export function numeric(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} harus antara ${min} dan ${max}.`);
  return value;
}
export function dimension(value, label='Dimensi') { return numeric(value, 0.1, 50, `${label} (meter)`); }
export function braceSpacing(value) {
  numeric(value,0,50000,'Jarak hollow tengah (mm)');
  if(value>0&&value<100)throw new Error('Jarak hollow tengah harus 0 atau minimal 100 mm.');
  return value;
}
// Offsets are measured from the outside bottom edge to each horizontal tube's centre.
export function braceOffsetsMm(height, spacingMm=0) {
  dimension(height,'Tinggi');braceSpacing(spacingMm);if(spacingMm===0)return [];
  const heightMm=height*1000,halfTube=HOLLOW*1000/2,innerBottom=HOLLOW*1000;
  const offsets=[];
  for(let i=1;i*spacingMm<heightMm;i++){
    const offset=i*spacingMm;
    if(offset-halfTube<innerBottom-1e-7||offset+halfTube>heightMm-innerBottom+1e-7)continue;
    offsets.push(offset);
    if(offsets.length>MAX_BRACES_PER_FRAME)throw new Error(`Maksimal ${MAX_BRACES_PER_FRAME} hollow tengah per frame. Perbesar jaraknya.`);
  }
  return offsets;
}
export function frameMembers(width,height,spacingMm=0) {
  dimension(width,'Lebar');dimension(height,'Tinggi');
  return [
    {size:[width,HOLLOW,HOLLOW],position:[0,(height-HOLLOW)/2,0]},
    {size:[width,HOLLOW,HOLLOW],position:[0,-(height-HOLLOW)/2,0]},
    {size:[HOLLOW,height-HOLLOW*2,HOLLOW],position:[(width-HOLLOW)/2,0,0]},
    {size:[HOLLOW,height-HOLLOW*2,HOLLOW],position:[-(width-HOLLOW)/2,0,0]},
    ...braceOffsetsMm(height,spacingMm).map(mm=>({size:[width-HOLLOW*2,HOLLOW,HOLLOW],position:[0,-height/2+mm/1000,0]})),
  ];
}
export function ledMembers(width,height) {
  dimension(width,'Lebar LED');dimension(height,'Tinggi LED');
  // The cabinet body defines the exact outside size. A 2 mm rim surrounds
  // the inset display on both sides, so adjoining cabinets remain distinct.
  return [
    {surface:'body',size:[width,height,LED_DEPTH],position:[0,0,0]},
    ...[-1,1].map(side=>({surface:'screen',size:[width-2*LED_BEZEL,height-2*LED_BEZEL,.001],position:[0,0,side*(LED_DEPTH/2+.0005)]})),
  ];
}
export function objectMembers(data) {
  if(isCloth(data))return [{geometry:'cloth',...validateCloth(data)}];
  if(isWheel(data))return wheelMembers(data);
  if(data.type==='rigging')return riggingMembers(data);
  if(isBallast(data))return ballastMembers(data);
  if(data.type==='led')return ledMembers(data.width,data.height);
  if(data.type==='hollow'){dimension(data.height,'Panjang hollow');return [{size:[HOLLOW,data.height,HOLLOW],position:[0,0,0]}];}
  return frameMembers(data.width,data.height,data.braceSpacingMm??0);
}
export function wheelMembers(data) {
  const {width:w,height:h,depth:d}=validateWheelTemplate(data);
  const box=(size,position,surface='body')=>({geometry:'rounded',size,position,surface});
  // The mounting plate is the exact top surface; the tyre touches the bottom.
  const wheel=(diameter,thickness,z,surface)=>({geometry:'wheel',size:[w*diameter,h*.65*diameter/.9,thickness],position:[0,-h*.175,z],surface});
  return [
    box([w,h*.08,d],[0,h*.46,0]),
    box([w*.5,h*.13,d*.52],[0,h*.355,0]),
    ...[-1,1].map(side=>box([w*.72,h*.5,d*.1],[0,h*.04,side*d*.34])),
    wheel(.9,d*.55,0,'rubber'),
    ...[-1,1].map(side=>wheel(.55,d*.025,side*d*.285,'hub')),
    {geometry:'wheel',size:[w*.14,h*.14,d*.82],position:[0,-h*.175,0],surface:'hub'},
  ];
}
export function riggingMembers(data) {
  if(isRiggingSegment(data)){
    const h=dimension(data.height,'Panjang rigging'),r=.025,half=RIGGING_DEPTH/2-r,members=[];
    const rod=(start,end,radius=r)=>members.push({geometry:'strut',start,end,radius,surface:'body'});
    for(const x of [-half,half])for(const z of [-half,half])rod([x,-h/2,z],[x,h/2,z]);
    const bays=Math.max(1,Math.min(80,Math.ceil(h/.5))),lo=-h/2+.01,span=h-.02;
    for(let i=0;i<=bays;i++){
      const y=lo+span*i/bays;
      for(const z of [-half,half])rod([-half,y,z],[half,y,z],.01);
      for(const x of [-half,half])rod([x,y,-half],[x,y,half],.01);
      if(i===bays)continue;
      const next=y+span/bays,a=i%2?half:-half;
      for(const z of [-half,half])rod([a,y,z],[-a,next,z],.01);
      for(const x of [-half,half])rod([x,y,a],[x,next,-a],.01);
    }
    return members;
  }
  const w=numeric(data.width,.6,50,'Lebar rigging lama'),h=numeric(data.height,.6,50,'Tinggi rigging lama'),s=RIGGING_DEPTH,r=.025,half=s/2-r,members=[];
  const rod=(a,b,radius=r)=>members.push({geometry:'strut',start:a,end:b,radius,surface:'body'});
  // Four box-truss sides form an open rectangular frame. The cross-section is square.
  const side=(length,origin,vertical)=>{
    const p=(t,c,z)=>vertical?[origin[0]+c,origin[1]+t,z]:[origin[0]+t,origin[1]+c,z];
    for(const c of [-half,half])for(const z of [-half,half])rod(p(-length/2,c,z),p(length/2,c,z));
    const bays=Math.max(1,Math.min(24,Math.ceil(length/.6)));
    for(let i=0;i<=bays;i++){
      const t=-length/2+length*i/bays;
      for(const z of [-half,half])rod(p(t,-half,z),p(t,half,z),.01);
      for(const c of [-half,half])rod(p(t,c,-half),p(t,c,half),.01);
      if(i===bays)continue;
      const next=t+length/bays,a=i%2?half:-half;
      for(const z of [-half,half])rod(p(t,a,z),p(next,-a,z),.01);
      for(const c of [-half,half])rod(p(t,c,a),p(next,c,-a),.01);
    }
  };
  side(w-2*r,[0,(h-s)/2],false);side(w-2*r,[0,-(h-s)/2],false);
  side(h-2*s,[ (w-s)/2,0],true);side(h-2*s,[-(w-s)/2,0],true);
  return members;
}
export function ballastMembers(data) {
  const {kind,width:w,height:h,depth:d}=validateBallastTemplate({...data,kind:data.ballastKind});
  const box=(size,position,surface='body')=>({geometry:'rounded',size,position,surface});
  if(kind==='concrete-block')return [box([w,h,d],[0,0,0])];
  const r=Math.min(w,h,d)*.018;
  const rope=(points,closed=false)=>({geometry:'rope',surface:'rope',radius:r,closed,points:points.map(([x,y,z])=>[x*w,y*h,z*d])});
  return [
    box([w*.9,h*.74,d*.88],[0,-h*.13,0]),
    box([w*.76,h*.1,d*.78],[0,h*.27,0]),
    // An open handle and a separate screw cap distinguish the water container.
    box([w*.075,h*.12,d*.2],[-w*.09,h*.37,0]),
    box([w*.075,h*.12,d*.2],[w*.25,h*.37,0]),
    box([w*.415,h*.07,d*.2],[w*.08,h*.445,0]),
    {geometry:'cylinder',surface:'cap',size:[w*.23,h*.09,Math.min(w*.23,d*.55)],position:[-w*.27,h*.365,0]},
    // A belt and two continuous slings wrap around the full container.
    rope([[-.48,-.04,-.46],[.48,-.04,-.46],[.48,-.04,.46],[-.48,-.04,.46]],true),
    ...[-.24,.24].map(x=>rope([[x,.32,-.31],[x,.2,-.47],[x,-.45,-.47],[x,-.49,-.35],[x,-.49,.35],[x,-.45,.47],[x,.2,.47],[x,.32,.31]],true)),
    rope([[.24,.31,.31],[.14,.36,.2],[.08,.4,.03],[.04,.48,0],[-.07,.49,0],[-.11,.44,.03],[-.04,.39,.04],[.08,.4,.03],[.16,.32,.34]]),
    box([r*3,r*3,r*3],[w*.08,h*.4,d*.03],'rope'),
    // Raised ribs are moulded into the front and rear faces.
    ...[-1,1].flatMap(side=>[-.23,0,.23].map(x=>box([w*.055,h*.44,d*.04],[x*w,-h*.13,side*d*.44],'rib'))),
  ];
}
export function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
export function snapValue(value, step) { return Math.round(value / step) * step; }
export function validateFrame(frame, index=0) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error(`Data frame ${index+1} tidak valid.`);
  const triplet = (value, bound, label) => {
    if (!Array.isArray(value) || value.length !== 3) throw new Error(`${label} frame ${index+1} harus berisi X, Y, Z.`);
    return value.map(n => numeric(n, -bound, bound, label));
  };
  const name = typeof frame.name === 'string' ? frame.name.trim().slice(0,60) : '';
  const type=frame.type??'frame';
  if(!['frame','hollow','led','ballast','wheel','rigging','cloth'].includes(type))throw new Error('Jenis objek tidak didukung.');
  const ballast=type==='ballast'?validateBallastTemplate({...frame,kind:frame.ballastKind}):null;
  if(frame.locked!==undefined&&typeof frame.locked!=='boolean')throw new Error('Status kunci objek harus benar atau salah.');
  if(frame.groupId!=null&&(typeof frame.groupId!=='string'||!frame.groupId.length||frame.groupId.length>=100))throw new Error('ID grup tidak valid.');
  if(frame.tie!=null&&!isJerrycan(frame))throw new Error('Tali pengikat hanya tersedia untuk jerigen air.');
  if(frame.mount!=null&&!isWheel(frame))throw new Error('Dudukan hollow hanya tersedia untuk roda.');
  if(type==='wheel')validateWheelTemplate(frame);
  if(type==='rigging'){
    if(frame.riggingKind!==undefined&&!['segment','legacy-frame'].includes(frame.riggingKind))throw new Error('Bentuk rigging tidak didukung.');
    if(isRiggingSegment(frame)){if(frame.width!==RIGGING_DEPTH)throw new Error('Penampang rigging batang harus 290 × 290 mm.');dimension(frame.height,'Panjang rigging');}
    else {numeric(frame.width,.6,50,'Lebar rigging lama');numeric(frame.height,.6,50,'Tinggi rigging lama');}
  }
  if(type!=='cloth'&&['clothPins','clothCorners','clothSag','clothColor'].some(key=>frame[key]!==undefined))throw new Error('Pengaturan kain hanya tersedia untuk objek kain.');
  const shape=frame.shape??(frame.width===frame.height?'square':'rectangle');
  if(type==='frame'&&!['square','rectangle'].includes(shape))throw new Error('Bentuk frame tidak didukung.');
  if(type==='frame'&&shape==='square'&&frame.width!==frame.height)throw new Error('Frame kotak harus memiliki lebar dan tinggi sama.');
  if(type==='hollow'&&frame.width!==HOLLOW)throw new Error('Lebar hollow lurus harus 40 mm.');
  if(type!=='frame'&&frame.braceSpacingMm!==undefined&&frame.braceSpacingMm!==0)throw new Error('Hollow tengah hanya tersedia untuk frame.');
  const spacingMm=type==='frame'?braceSpacing(frame.braceSpacingMm??0):0;
  braceOffsetsMm(frame.height,spacingMm);
  return {
    id: typeof frame.id === 'string' && frame.id.length > 0 && frame.id.length < 100 ? frame.id : uid(),
    name: name || `${objectLabel(frame)} ${String(index+1).padStart(2,'0')}`,
    type,locked:frame.locked??false,...(type==='frame'?{shape}:{}),
    ...(frame.groupId!=null?{groupId:frame.groupId}:{}),
    ...(frame.tie!=null?{tie:validateTie(frame.tie)}:{}),
    ...(frame.mount!=null?{mount:validateTie(frame.mount)}:{}),
    ...(type==='wheel'?{depth:frame.depth}:{}),
    ...(type==='rigging'?{riggingKind:isRiggingSegment(frame)?'segment':'legacy-frame'}:{}),
    ...(type==='cloth'?validateCloth(frame):{}),
    ...(ballast?{ballastKind:ballast.kind,depth:ballast.depth}:{}),
    width:type==='hollow'?HOLLOW:dimension(frame.width, 'Lebar'), height:dimension(frame.height, 'Tinggi'),
    braceSpacingMm:spacingMm,
    position:triplet(frame.position, LIMIT_POSITION, 'Posisi'),
    rotation:triplet(frame.rotation, 36000, 'Rotasi').map(normalizeDegrees),
  };
}
export function validateFrameTemplate(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Pengaturan Buat frame tidak valid.');
  const template={width:dimension(value.width,'Lebar Buat frame'),height:dimension(value.height,'Tinggi Buat frame'),braceSpacingMm:braceSpacing(value.braceSpacingMm??0)};
  braceOffsetsMm(template.height,template.braceSpacingMm);return template;
}
export function frameSummary(frames) {
  frames=frames.filter(f=>!f.type||f.type==='frame');
  const groups=new Map();
  for(const f of frames){
    // Rotating a rectangular frame does not create a different physical size.
    const sides=[dimension(f.width),dimension(f.height)].sort((a,b)=>b-a).map(n=>Number(n.toFixed(6)));
    const key=sides.join('x');
    if(!groups.has(key))groups.set(key,{width:sides[0],height:sides[1],quantity:0});
    groups.get(key).quantity++;
  }
  return {total:frames.length,bySize:[...groups.values()].sort((a,b)=>b.width-a.width||b.height-a.height)};
}
export function objectSummary(objects) {
  const groups=new Map();
  for(const f of objects){
    const type=f.type??'frame',sides=hasDepth(f)?[f.width,f.height,f.depth]:type==='hollow'?[HOLLOW,f.height]:isRiggingSegment(f)?[RIGGING_DEPTH,f.height]:[f.width,f.height].sort((a,b)=>b-a);
    const key=[type,...(isBallast(f)?[f.ballastKind]:[]),...(isCloth(f)?[f.clothColor]:[]),...sides.map(n=>Number(n.toFixed(6)))].join(':');
    if(!groups.has(key))groups.set(key,{type,width:sides[0],height:sides[1],...(hasDepth(f)?{depth:f.depth}:{}),...(isBallast(f)?{ballastKind:f.ballastKind}:{}),...(type==='rigging'?{riggingKind:isRiggingSegment(f)?'segment':'legacy-frame'}:{}),...(isCloth(f)?{clothColor:f.clothColor}:{}),quantity:0});
    groups.get(key).quantity++;
  }
  return {total:objects.length,bySize:[...groups.values()]};
}
export function validateLedTemplate(value={width:1,height:.5}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ukuran LED Screen tidak valid.');
  return {width:dimension(value.width,'Lebar LED'),height:dimension(value.height,'Tinggi LED')};
}
export function validateProject(data) {
  if (!data || typeof data !== 'object' || data.app !== 'led-rental-frame-builder' || data.version !== 1 || data.units !== 'meters') throw new Error('Format proyek tidak didukung. Pilih JSON dari Contruction Builder (LED Rental) versi 1.');
  if (data.hollow?.width !== HOLLOW || data.hollow?.height !== HOLLOW) throw new Error('Proyek harus memakai profil hollow tetap 40 × 40 mm.');
  if (!Array.isArray(data.frames) || data.frames.length > MAX_FRAMES) throw new Error(`Proyek maksimal ${MAX_FRAMES} objek.`);
  const frames = validateConnections(data.frames.map(validateFrame));
  if(frames.reduce((sum,f)=>sum+braceOffsetsMm(f.height,f.braceSpacingMm).length,0)>MAX_PROJECT_BRACES)throw new Error(`Maksimal ${MAX_PROJECT_BRACES} hollow tengah dalam satu proyek.`);
  if (new Set(frames.map(f => f.id)).size !== frames.length) throw new Error('ID frame di proyek tidak boleh duplikat.');
  const s = data.settings || {};
  const settings = {
    snap:typeof s.snap === 'boolean' ? s.snap : false,
    positionStep:POSITION_STEPS.includes(s.positionStep) ? s.positionStep : 0.1,
    rotationStep:ROTATION_STEPS.includes(s.rotationStep) ? s.rotationStep : 15,
    grid:typeof s.grid === 'boolean' ? s.grid : true,
    dimensions:typeof s.dimensions === 'boolean' ? s.dimensions : true,
    space:s.space === 'local' ? 'local' : 'world',
  };
  let camera = null;
  const c = data.camera;
  if (c && ['iso','front','back','left','right','top','custom'].includes(c.view) && ['perspective','orthographic'].includes(c.type)) {
    const vector = v => Array.isArray(v) && v.length===3 && v.every(n => typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=10000);
    if (vector(c.position) && vector(c.target) && vector(c.up) && Math.hypot(...c.up)>0.5 && Math.hypot(...c.up)<1.5 && Math.hypot(...c.position.map((v,i)=>v-c.target[i]))>0.01 && typeof c.span==='number' && c.span>=0.1 && c.span<=5000) camera = {view:c.view, type:c.type, position:[...c.position], target:[...c.target], up:[...c.up], span:c.span};
  }
  const frameTemplate=validateFrameTemplate(data.frameTemplate??frames.find(f=>f.type==='frame')??{width:1,height:2,braceSpacingMm:0});
  const ledTemplate=validateLedTemplate(data.ledTemplate);
  const ballastTemplate=validateBallastTemplate(data.ballastTemplate);
  const wheelTemplate=validateWheelTemplate(data.wheelTemplate),riggingTemplate=validateRiggingTemplate(data.riggingTemplate);
  const clothTemplate=validateClothTemplate(data.clothTemplate);
  const palette={type:['frame','led','ballast'].includes(data.palette?.type)?data.palette.type:'frame',shape:['square','rectangle','hollow'].includes(data.palette?.shape)?data.palette.shape:'rectangle'};
  if(['ballast','wheel','rigging','cloth'].includes(data.palette?.accessory))palette.accessory=data.palette.accessory;
  if(palette.shape==='square'&&frameTemplate.width!==frameTemplate.height)palette.shape='rectangle';
  return {frames, settings, camera, frameTemplate, ledTemplate, ballastTemplate, wheelTemplate, riggingTemplate, clothTemplate, palette};
}
export function makeProject(frames, settings, camera, template=frames.find(f=>!f.type||f.type==='frame')??{width:1,height:2,braceSpacingMm:0}, ledTemplate, palette={type:'frame',shape:'rectangle'}, ballastTemplate, wheelTemplate, riggingTemplate, clothTemplate) {
  const savedFrames=validateConnections(frames.map(validateFrame));
  return {app:'led-rental-frame-builder', appVersion:APP_VERSION, version:1, units:'meters', hollow:{width:HOLLOW,height:HOLLOW}, frames:savedFrames, frameTemplate:validateFrameTemplate(template), ledTemplate:validateLedTemplate(ledTemplate),ballastTemplate:validateBallastTemplate(ballastTemplate),wheelTemplate:validateWheelTemplate(wheelTemplate),riggingTemplate:validateRiggingTemplate(riggingTemplate),clothTemplate:validateClothTemplate(clothTemplate),palette:{...palette}, summary:frameSummary(savedFrames), objectsSummary:objectSummary(savedFrames), settings:{...settings}, camera};
}

export function cloneObjects(source,existing,offset=[0,0,.15]) {
  if(!Array.isArray(source)||!source.length)throw new Error('Pilih objek untuk disalin terlebih dahulu.');
  if(source.length+existing.length>MAX_FRAMES)throw new Error(`Proyek maksimal ${MAX_FRAMES} objek.`);
  const ids=new Map(source.map(f=>[f.id,uid()])),groupCounts=new Map(),groups=new Map(),available=new Set(existing.map(f=>f.id));
  for(const f of source)if(f.groupId)groupCounts.set(f.groupId,(groupCounts.get(f.groupId)??0)+1);
  for(const [id,count] of groupCounts)if(count>1)groups.set(id,uid());
  const copies=source.map(f=>{
    const copy=validateFrame({...f,id:ids.get(f.id),name:`${f.name.slice(0,50)} salinan`,locked:false,groupId:groups.get(f.groupId),position:f.position.map((n,i)=>n+numeric(offset[i],-1000,1000,'Offset salinan'))});
    for(const key of ['tie','mount'])if(copy[key]){
      if(ids.has(copy[key].targetId))copy[key]={...copy[key],targetId:ids.get(copy[key].targetId)};
      else if(!available.has(copy[key].targetId))delete copy[key];
    }
    if(isCloth(copy))copy.clothPins=copy.clothPins.map(pin=>!pin?null:ids.has(pin.targetId)?{...pin,targetId:ids.get(pin.targetId)}:available.has(pin.targetId)?pin:null);
    return copy;
  });
  const all=[...existing,...copies];validateConnections(all);
  if(all.reduce((sum,f)=>sum+braceOffsetsMm(f.height,f.braceSpacingMm??0).length,0)>MAX_PROJECT_BRACES)throw new Error(`Maksimal ${MAX_PROJECT_BRACES} hollow tengah dalam satu proyek.`);
  return copies;
}
