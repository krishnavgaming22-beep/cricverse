"""CC0 MakeHuman continuous skin, retargeted cricket rig and fitted garments."""
import bpy, bmesh, math, os, json, struct, sys
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
import build_assets as a
ROOT=a.ROOT

def build(role):
 a.clear(); bpy.ops.import_scene.gltf(filepath=ROOT+'/production/source-assets/makehuman-male-cc0.glb')
 old=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 body=bpy.data.objects['base_male_body']; eye=bpy.data.objects.get('base_male_body.high-poly')
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and o not in (body,eye):bpy.data.objects.remove(o,do_unlink=True)
 # Merge twist segments while preserving the original blended skin weights.
 defs=[('root',(0,0,0),(0,0,.15),None),('pelvis',old.data.bones['spine05'].head_local,old.data.bones['spine04'].head_local,'root'),('spine',old.data.bones['spine04'].head_local,old.data.bones['spine01'].head_local,'pelvis'),('chest',old.data.bones['spine01'].head_local,(0,0,1.5),'spine'),('neck',old.data.bones['neck01'].head_local,old.data.bones['head'].head_local,'chest'),('head',old.data.bones['head'].head_local,(0,-.045,1.78),'neck')]
 for side in ('L','R'):
  def h(n):return old.data.bones[n+'.'+side].head_local.copy()
  defs += [('upperarm.'+side,h('upperarm01'),h('lowerarm01'),'chest'),('forearm.'+side,h('lowerarm01'),h('wrist'),'upperarm.'+side),('hand.'+side,h('wrist'),h('wrist')+Vector((0,-.085,-.05)),'forearm.'+side),('thigh.'+side,h('upperleg01'),h('lowerleg01'),'pelvis'),('shin.'+side,h('lowerleg01'),h('foot'),'thigh.'+side),('foot.'+side,h('foot'),old.data.bones['foot.'+side].tail_local.copy(),'shin.'+side)]
 arm=bpy.data.armatures.new('Cricket_anatomy');rig=bpy.data.objects.new('Cricketer_Rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for n,h,t,p in defs:
  b=arm.edit_bones.new(n);b.head=h;b.tail=t
  if p:b.parent=arm.edit_bones[p]
 bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
 def mapping(n):
  side=n[-2:] if n.endswith(('.L','.R')) else ''
  if n.startswith('upperarm'):return 'upperarm'+side
  if n.startswith('lowerarm'):return 'forearm'+side
  if n.startswith(('wrist','finger','metacarpal')):return 'hand'+side
  if n.startswith('upperleg'):return 'thigh'+side
  if n.startswith('lowerleg'):return 'shin'+side
  if n.startswith(('foot','toe')):return 'foot'+side
  if n.startswith('spine05') or n.startswith('pelvis') or n=='root':return 'pelvis'
  if n.startswith(('spine04','spine03','spine02')):return 'spine'
  if n.startswith(('spine01','shoulder','clavicle')):return 'chest'
  if n.startswith('neck'):return 'neck'
  return 'head'
 for o in (body,eye):
  if not o:continue
  groups={g.index:mapping(g.name) for g in o.vertex_groups}; weights=[]
  for vert in o.data.vertices:
   d={}
   for g in vert.groups:d[groups[g.group]]=d.get(groups[g.group],0)+g.weight
   weights.append(d)
  o.vertex_groups.clear()
  for n,_,_,_ in defs:o.vertex_groups.new(name=n)
  for i,d in enumerate(weights):
   for n,w in d.items():o.vertex_groups[n].add([i],w,'REPLACE')
  o.parent=rig
  for m in o.modifiers:
   if m.type=='ARMATURE':m.object=rig
 bpy.data.objects.remove(old,do_unlink=True)
 skin=a.mat('Skin / warm neutral',(.39,.205,.12),.62);isbat=role=='batsman';protected=role!='bowler'
 kit=a.texture(a.mat('Woven cricket jersey',(.035,.105,.19) if isbat else (.62,.18,.065)),role+'_fabric','cloth',256)
 pants=a.mat('Tailored trouser twill',(.045,.09,.14) if isbat else (.075,.11,.13),.94)
 white=a.mat('Off-white protective foam',(.8,.82,.76),.8);trim=a.mat('Team mint' if isbat else 'Team amber',(.43,.76,.65) if isbat else (.94,.65,.29),.7);sole=a.mat('Outsole',(.035,.045,.05));metal=a.mat('Titanium grille',(.4,.44,.44),.3,.8);hair=a.mat('Short cropped hair',(.028,.018,.012),.95)
 body.data.materials.clear()
 for m in (skin,kit,pants,white,sole,hair):body.data.materials.append(m)
 # Fitted continuous clothing follows the original smooth skinning. Inflate only covered regions.
 # Weld split glTF seam vertices before fitting; retain UV seams in loop data.
 bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00005);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
 norms=[vert.normal.copy() for vert in body.data.vertices]
 groups={g.index:g.name for g in body.vertex_groups}
 dominant=[]
 for vert in body.data.vertices:dominant.append(groups[max(vert.groups,key=lambda g:g.weight).group] if vert.groups else 'head')
 for p in body.data.polygons:
  c=p.center;names=[dominant[i] for i in p.vertices];hand=any(n.startswith('hand') for n in names);leg=any(n.startswith(('thigh','shin','foot','pelvis')) for n in names)
  p.material_index=3 if hand and protected else 0 if hand else 2 if leg and c.z>.11 else 3 if c.z<.11 else 1 if c.z<1.515 and (abs(c.x)<.25 or c.z>1.31) else 0
  if c.z>1.731 or (c.z>1.68 and c.y>.01):p.material_index=5
  p.use_smooth=True
 for i,vert in enumerate(body.data.vertices):
  x,y,z=vert.co;n=dominant[i]
  if n.startswith(('thigh','shin','pelvis')) and .12<z<1.05:vert.co+=norms[i]*.012
  elif n in ('spine','chest','upperarm.L','upperarm.R') and z<1.515 and (abs(x)<.25 or z>1.31):vert.co+=norms[i]*.010
  if n.startswith('hand') and z<1.10:
   wrist=Vector((.511713 if x>0 else -.511713,-.21447,1.099625));d=vert.co-wrist
   if d.z<-.055:vert.co.z=wrist.z-.055+(d.z+.055)*.25;vert.co.y=wrist.y-.075+(d.y+.075)*.35
 body.data.update()
 if protected:
  # Replace only the gloved hand surface with a closed, padded grasp around the socket.
  bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();remove=[bm.verts[i] for i,n in enumerate(dominant) if n.startswith('hand')];bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
 bpy.context.view_layer.objects.active=body;body.select_set(True)
 dec=body.modifiers.new('Game topology / continuous weighted skin','DECIMATE');dec.ratio=.24;bpy.ops.object.modifier_apply(modifier=dec.name);body.select_set(False)
 if eye:
  eye.data.materials.clear();eye.data.materials.append(a.mat('Eyes',(.16,.11,.065),.35))
 def bind(o,bone):
  o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE');o.parent=rig;o.modifiers.new('Cricket equipment skin','ARMATURE').object=rig;return o
 # Equipment placed on anatomical knees, ankles and head; the underlying human is continuous.
 for side,s in [('L',1),('R',-1)]:
  ankle=arm.bones['foot.'+side].head_local;knee=arm.bones['shin.'+side].head_local
  bind(a.oval('Boot_'+side,(ankle.x,-.080,.07),(.068,.151,.062),white,20,10),'foot.'+side)
  bind(a.oval('Sole_'+side,(ankle.x,-.080,.025),(.069,.154,.018),sole,20,8),'foot.'+side)
  for j in range(4):bind(a.rod('Lace',(ankle.x-.025,-.13+j*.022,.12),(ankle.x+.025,-.13+j*.022,.12),.003,sole,6),'foot.'+side)
  if protected:
   bottom=Vector((ankle.x,-.082,.14));top=Vector((knee.x,-.105,.59))
   bind(a.loft('Contoured_pad_'+side,bottom,top,[(0,.05,.025),(.13,.072,.034),(.7,.075,.037),(.95,.065,.038),(1,.046,.027)],white,20),'shin.'+side)
   for j in range(6):
    offset=(j-2.5)*.021;bind(a.rod('Pad_cane',bottom+Vector((offset,-.03,.04)),top+Vector((offset,-.025,-.08)),.009,white,8),'shin.'+side)
   bind(a.oval('Knee_roll',(knee.x,-.135,.535),(.078,.029,.039),white,20,8),'shin.'+side)
   wrist=arm.bones['hand.'+side].head_local
   # A closed glove in hand-bone space. Four curved fingers wrap around the handle axis.
   bone=arm.bones['hand.'+side];basis=bone.matrix_local;localSocket=basis.inverted()@(wrist+Vector((0,-.058,-.035)))
   glove=a.loft('Leather_palm_'+side,(0,0,0),(0,.048,0),[(0,.029,.027),(.3,.034,.034),(.8,.039,.035),(1,.035,.032)],white,20)
   for vv in glove.data.vertices:vv.co=basis@vv.co
   bind(glove,'hand.'+side)
   for finger in range(4):
    vs=[];fs=[];segments=18;rad=.024;thick=.009
    for j in range(segments+1):
     angle=-math.pi*.78+j/segments*math.pi*1.60
     center=localSocket+Vector((math.cos(angle)*rad,math.sin(angle)*rad,(finger-1.5)*.019))
     for k in range(8):
      ring=k*math.tau/8;vs.append(basis@(center+Vector((math.cos(angle)*math.cos(ring)*thick,math.sin(angle)*math.cos(ring)*thick,math.sin(ring)*thick))))
    for j in range(segments):
     for k in range(8):fs.append((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k))
    fs.extend([tuple(reversed(range(8))),tuple(segments*8+k for k in range(8))]);bind(a.mesh('Curled_padded_finger',vs,fs,white,True),'hand.'+side)
   thumb=a.loft('Thumb_lock',(localSocket.x-.026,.025,.025),(localSocket.x+.02,.067,.039),[(0,.016,.016),(.5,.017,.016),(1,.011,.011)],white,12)
   for vv in thumb.data.vertices:vv.co=basis@vv.co
   bind(thumb,'hand.'+side)
  bind(a.box('Sleeve_flash',(s*.227,-.060,1.355),(.025,.006,.09),trim,.003),'upperarm.'+side)
 bind(a.box('Chest_crest',(.075,-.130,1.38),(.035,.008,.047),trim,.005),'chest')
 bind(a.loft('Collar',(0,-.008,1.465),(0,-.008,1.508),[(0,.079,.070),(1,.061,.054)],trim,24),'chest')
 if protected:
  vs=[];fs=[];seg=40
  for j in range(10):
   ph=.035+math.pi*.54*j/9
   for i in range(seg):
    ang=i*math.tau/seg;vs.append((.103*math.sin(ph)*math.cos(ang),-.004+.10*math.sin(ph)*math.sin(ang),1.725+.09*math.cos(ph)))
  for j in range(9):
   for i in range(seg):fs.append((j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i))
  bind(a.mesh('Helmet_shell',vs,fs,pants,True),'head');bind(a.box('Helmet_peak',(0,-.101,1.735),(.195,.12,.012),pants,.01),'head')
  for z in (1.565,1.61,1.655):
   for i in range(14):
    ang=-math.pi+math.pi*i/14;ang2=-math.pi+math.pi*(i+1)/14
    bind(a.rod('Faceguard',(.108*math.cos(ang),.128*math.sin(ang)-.02,z),(.108*math.cos(ang2),.128*math.sin(ang2)-.02,z),.0025,metal,6),'head')
  for x in (-.07,0,.07):bind(a.rod('Grille_upright',(x,-.126,1.565),(x,-.126,1.71),.0025,metal,6),'head')
 # Named bone-space sockets, exported and used by the same controller in game and tests.
 for side in ('L','R'):
  socket=bpy.data.objects.new('Palm_'+side,None);bpy.context.collection.objects.link(socket);socket.parent=rig;socket.parent_type='BONE';socket.parent_bone='hand.'+side
  socket.matrix_world.translation=arm.bones['hand.'+side].head_local+Vector((0,-.065,-.035))
 # Keep exported clips as inspectable baselines; runtime layered IK owns sports motion.
 rig.animation_data_create()
 for name in ('Idle','Run','Bowl','Defend','Drive','Loft','Pull','Catch'):
  action=bpy.data.actions.new(name);rig.animation_data.action=action
  for frame in (0,30):
   for bone in rig.pose.bones:bone.rotation_mode='QUATERNION';bone.rotation_quaternion=(1,0,0,0);bone.keyframe_insert(data_path='rotation_quaternion',frame=frame)
  rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
 # Join equipment by material with skin groups preserved.
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=body;bpy.ops.object.join();body.name=role+'_continuous_skin'
 a.export(role,True)
 if role=='batsman':
  a.studio((2,-3,1.8),(0,0,1.0),(700,900));bpy.context.scene.render.filepath=ROOT+'/production/batsman-rescue-preview.png';bpy.ops.render.render(write_still=True)
for role in ('batsman','bowler','keeper'):build(role)
# Export glTF rest graph as tiny simulation rig. It includes every actual joint transform.
b=open(ROOT+'/public/assets/batsman.glb','rb').read();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);nodes=g['nodes'];jointset=set(g['skins'][0]['joints']);keep=set(jointset)
for i,node in enumerate(nodes):
 if node.get('name') in ('Cricketer_Rig','Palm_L','Palm_R'):keep.add(i)
# Keep all ancestors of joints, but never meshes.
changed=True
while changed:
 changed=False
 for i,node in enumerate(nodes):
  if any(c in keep for c in node.get('children',[])) and i not in keep:keep.add(i);changed=True
meta={'nodes':[{k:v for k,v in node.items() if k in ('name','translation','rotation','scale','children')} if i in keep else {} for i,node in enumerate(nodes)],'roots':g['scenes'][g.get('scene',0)]['nodes']}
os.makedirs(ROOT+'/src/assets',exist_ok=True);json.dump(meta,open(ROOT+'/src/assets/rig.json','w'),indent=2)
print('CONTINUOUS CHARACTERS EXPORTED')
