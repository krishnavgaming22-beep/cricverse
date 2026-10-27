"""Original CricVerse stadium/equipment pipeline. Blender metres, Z-up → glTF Y-up.
Characters are rebuilt separately from the credited CC0 human base.
Run from the repository: blender -b --python scripts/build_assets.py
"""
import bpy, math, random, os, json
from mathutils import Vector
import numpy as np
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets'); PROD=os.path.join(ROOT,'production')
os.makedirs(OUT,exist_ok=True); os.makedirs(PROD,exist_ok=True)
random.seed(148)

def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for d in list(bpy.data.materials): bpy.data.materials.remove(d)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)

def mat(name,color,rough=.7,metal=0,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m

def texture(m,name,kind,size=512):
    rng=np.random.default_rng(176); yy,xx=np.mgrid[0:size,0:size]; noise=rng.random((size,size))
    if kind=='grass':
        stripe=(np.sin(xx/size*math.pi*24)>0)*.028
        n=noise*.075+stripe; rgb=np.stack([.13+n*.44,.235+n*.73,.075+n*.3],axis=-1)
        streak=(rng.random((size,size))>.996); rgb[streak]*=.7
    elif kind=='pitch':
        n=noise*.055+.023*np.sin(xx*.018)*np.sin(yy*.029); wear=np.exp(-((yy/size-.09)/.08)**2)+np.exp(-((yy/size-.91)/.08)**2)
        rgb=np.stack([.49+n+wear*.055,.43+n+wear*.032,.29+n*.65+wear*.02],axis=-1)
        scuffs=(noise>.992)&(wear>.35); rgb[scuffs]*=.78
    elif kind=='wood':
        n=(np.sin(xx*.17+np.sin(yy*.012)*2)*.03+noise*.045);rgb=np.stack([.80+n,.64+n,.39+n],axis=-1)
    else:
        n=(noise-.5)*.04+(np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2))*.015
        c=m.diffuse_color; rgb=np.stack([np.clip(c[i]+n,0,1) for i in range(3)],axis=-1)
    pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=rgb
    im=bpy.data.images.new(name,width=size,height=size);im.pixels.foreach_set(pixels.ravel());im.filepath_raw=os.path.join(OUT,name+'.png');im.file_format='PNG';im.save();im.pack()
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
    p=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    # Baked micro-normal from the same authored height field.
    normal=np.ones((size,size,4),dtype=np.float32);normal[:,:,0]=.5+(np.roll(noise,1,0)-noise)*.12;normal[:,:,1]=.5+(np.roll(noise,1,1)-noise)*.12;normal[:,:,2]=.99
    nm=bpy.data.images.new(name+'_normal',width=size,height=size);nm.pixels.foreach_set(normal.ravel());nm.filepath_raw=os.path.join(OUT,name+'_normal.png');nm.file_format='PNG';nm.save();nm.colorspace_settings.name='Non-Color';nm.pack()
    nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=nm;nn=m.node_tree.nodes.new('ShaderNodeNormalMap');nn.inputs['Strength'].default_value=.22;m.node_tree.links.new(nt.outputs['Color'],nn.inputs['Color']);m.node_tree.links.new(nn.outputs['Normal'],p.inputs['Normal'])
    return m

def mesh(name,vs,fs,m,smooth=False):
    d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(m)
    uv=d.uv_layers.new(name='UVMap')
    for p in d.polygons:
        p.use_smooth=smooth
        for li in p.loop_indices:
            v=d.vertices[d.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.12+.5,v.y*.12+.5)
    return o

def box(name,loc,scale,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Crafted edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def rod(name,a,b,r,m,verts=8):
    d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def loft(name,a,b,profile,m,segments=16,cloth=False):
    a=Vector(a);d=Vector(b)-a;axis=d.normalized();u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u).normalized();vs=[]
    for j,(t,rx,ry) in enumerate(profile):
        for i in range(segments):
            th=2*math.pi*i/segments;wr=1+(math.sin(i*3+j*2)*.024 if cloth else 0)
            vs.append(a+d*t+u*math.cos(th)*rx*wr+v*math.sin(th)*ry*wr)
    fs=[]
    for j in range(len(profile)-1):
        for i in range(segments):fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    fs.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
    return mesh(name,vs,fs,m,True)

def oval(name,loc,scale,m,seg=24,rings=12):
    vs=[];fs=[]
    for j in range(rings+1):
        ph=math.pi*j/rings
        for i in range(seg):
            th=2*math.pi*i/seg;vs.append((loc[0]+scale[0]*math.sin(ph)*math.cos(th),loc[1]+scale[1]*math.sin(ph)*math.sin(th),loc[2]+scale[2]*math.cos(ph)))
    for j in range(rings):
        for i in range(seg):fs.append((j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i))
    return mesh(name,vs,fs,m,True)

def arc(name,r0,r1,z0,z1,a0,a1,m,n=16):
    vs=[]
    for z in (z0,z1):
        for r in (r0,r1):
            for i in range(n+1):
                a=a0+(a1-a0)*i/n;vs.append((math.cos(a)*r,math.sin(a)*r*.91,z))
    k=n+1;fs=[]
    for i in range(n):
        fs += [(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),(i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)]
    fs += [(0,k,3*k,2*k),(n,2*k+n,3*k+n,k+n)]
    return mesh(name,vs,fs,m)

def join_static():
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and not o.name.startswith('LIVE_'):groups.setdefault(o.data.materials[0].name,[]).append(o)
    for key,obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=key+'_geometry'

def export(name,anim=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type in ('MESH','ARMATURE','EMPTY'):o.select_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROD,name+'.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_animations=anim,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_yup=True)
    print('EXPORTED',name,flush=True)

def studio(camera,target,res=(1100,700)):
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=20
    sc.world.color=(.35,.40,.48)
    bpy.ops.object.light_add(type='SUN',location=(0,0,30));bpy.context.object.rotation_euler=(.6,-.4,-.5);bpy.context.object.data.energy=3
    bpy.ops.object.light_add(type='AREA',location=(0,-8,8));bpy.context.object.data.energy=1200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=10
    bpy.ops.object.camera_add(location=camera);cam=bpy.context.object;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=35;sc.camera=cam
    sc.render.resolution_x=res[0];sc.render.resolution_y=res[1];sc.render.resolution_percentage=100
    sc.view_settings.view_transform='AgX'

def stadium():
    clear();grass=texture(mat('Living turf',(.2,.38,.12)), 'turf','grass',1024);pitch=texture(mat('Rolled clay',(.65,.52,.34)), 'pitch','pitch')
    concrete=mat('Warm architectural concrete',(.41,.44,.43));dark=mat('Charcoal steel',(.045,.075,.085),.47,.55);roof=mat('Ivory tension canopy',(.68,.72,.68),.62);teal=mat('Deep teal seats',(.06,.24,.23));pale=mat('Sea glass seats',(.30,.48,.43));white=mat('Crease chalk',(.9,.91,.82));rail=mat('Brushed rail',(.43,.49,.48),.35,.7);ad=mat('Boundary graphite',(.025,.055,.061));gold=mat('Champagne accents',(.63,.54,.31),.5,.35);light=mat('Floodlight glass',(.95,.94,.78),.25,.1,3)
    # Original oval bowl. Ground and pitch are separate UV-mapped authored surfaces.
    vs=[(0,0,0)]+[(72*math.cos(i*math.tau/160),66*math.sin(i*math.tau/160),0) for i in range(160)]
    ground=mesh('Outfield_144m',vs,[(0,i+1,(i+1)%160+1) for i in range(160)],grass)
    for p in ground.data.polygons:
        for li in p.loop_indices:
            v=ground.data.vertices[ground.data.loops[li].vertex_index].co;ground.data.uv_layers[0].data[li].uv=(v.x/144+.5,v.y/132+.5)
    box('Square', (0,0,.005),(10,27,.012),grass)
    box('Match_strip',(0,0,.018),(3.05,22.4,.02),pitch)
    for y in (-10.06,10.06):
        s=1 if y>0 else -1
        box('Bowling_crease',(0,y,.042),(2.64,.04,.012),white)
        box('Popping_crease',(0,y-s*1.22,.044),(3.66,.05,.013),white)
        for x in (-1.32,1.32):box('Return_crease',(x,y+s*.35,.043),(.04,2.7,.012),white)
    arc('Boundary_rope',64.8,64.86,.04,.085,0,math.tau,white,320)
    # Two tiers, vomitories and rhythmic canopy structural bays.
    for sector in range(36):
        a0=sector*math.tau/36+.009;a1=(sector+1)*math.tau/36-.009;mid=(a0+a1)/2
        arc('Bowl_plinth',73,95,.0,2,a0,a1,concrete,4)
        for row in range(12):
            r=74+row*.7;z=2+row*.44
            arc('Lower_terrace',r,r+.72,z-.26,z,a0,a1,concrete,4)
            arc('Seat_row',r+.14,r+.44,z+.08,z+.44,a0+.008,a1-.008,teal if (row+sector)%3 else pale,5)
        arc('Hospitality_fascia',83,84,7.5,9,a0,a1,dark,4)
        for row in range(0 if sector in range(7,12) else 5 if sector in range(24,28) else 10):
            r=84+row*.68;z=9.1+row*.46
            arc('Upper_terrace',r,r+.7,z-.28,z,a0,a1,concrete,4)
            arc('Upper_seats',r+.14,r+.42,z+.06,z+.4,a0+.01,a1-.01,teal if row%4 else pale,5)
        if sector not in list(range(7,12))+list(range(24,28)):
            # Airy sawtooth cantilevered roof, timber/gold leading edge.
            v=[]
            for r,z in [(80,18.1),(95,20.5)]:
                for a in (a0,a1):v.append((r*math.cos(a),r*.91*math.sin(a),z))
            mesh('Canopy_panel',v,[(0,1,3,2)],roof)
            for a in (a0,a1):
                rod('Roof_truss',(79*math.cos(a),79*.91*math.sin(a),17.9),(96*math.cos(a),96*.91*math.sin(a),20.1),.11,dark)
                rod('Exterior_column',(94*math.cos(a),94*.91*math.sin(a),0),(94*math.cos(a),94*.91*math.sin(a),20.4),.20,concrete)
                rod('Canopy_stay',(86*math.cos(a),86*.91*math.sin(a),18.7),(94*math.cos(a),94*.91*math.sin(a),15.5),.055,rail)
            arc('Roof_lip',79.7,80,17.9,18.15,a0,a1,gold,4)
        for rr,zz in [(73.6,2),(82.5,7.7),(91,14)]:arc('Balustrade',rr,rr+.035,zz,zz+.72,a0,a1,rail,4)
        if sector%6==0:
            o=box('Player_tunnel',(72.2*math.cos(mid),72.2*.91*math.sin(mid),1.3),(4,2.4,2.6),dark);o.rotation_euler.z=mid
    # Asymmetric members' pavilion: terraces, shaded galleries, clerestory and metal roof.
    glass=mat('Pavilion smoked glazing',(.075,.13,.135),.24,.25)
    timber=mat('Pavilion warm timber',(.28,.19,.12),.8)
    for level in range(3):
        z=7.3+level*3.6
        box('Pavilion_floor',(0,83,z),(39,12,.32),concrete,.07)
        box('Gallery_glass',(0,77.1,z+1.65),(37,.12,2.8),glass)
        box('Balcony_front',(0,75.6,z+.85),(39,.14,1.25),rail)
        box('Sunshade',(0,76.4,z+3.1),(40,2.8,.18),dark)
        for x in range(-18,19,3):box('Gallery_mullion',(x,77,z+1.5),(.10,.23,3),timber)
    for x in (-19,19):box('Pavilion_core',(x,83,11.8),(2.2,12,12),concrete,.08)
    box('Pavilion_roof',(0,82.5,18.7),(43,14,.55),dark,.12)
    for x in range(-20,21,2):rod('Roof_fin',(x,75.7,19),(x,89.4,19.6),.045,gold)
    # Low open stand and landscaped concourse opposite the members' building.
    for x in (-24,-16,16,24):
        box('Concourse_planter',(x,-83,3.4),(5,3,1.2),concrete,.12)
        oval('Clipped_shrub',(x,-83,4.3),(2.8,1.8,1.2),grass,16,8)
    box('Media_box',(44,67,13),(11,9,6),dark,.2)
    box('Media_glass',(41,62.4,13),(7,.14,3.9),glass)
    # Architectural entrances/black sight screens beyond the wickets.
    for y in (-69,69):box('Sight_screen',(0,y,3.2),(15,.4,6.4),dark,.12)
    for i in range(64):
        a=i*math.tau/64;o=box('Hoarding',(67*math.cos(a),67*.91*math.sin(a),.65),(6.1,.16,1.05),ad if i%4 else teal,.03);o.rotation_euler.z=a+math.pi/2
    for a in (0.65,2.49,3.8,5.6):
        x,y=97*math.cos(a),88*math.sin(a)
        for dx,dy in [(-.6,-.6),(.6,-.6),(-.6,.6),(.6,.6)]:rod('Tower_chord',(x+dx,y+dy,0),(x+dx*.4,y+dy*.4,33),.16,dark)
        for h in range(0,30,3):
            rod('Tower_diagonal',(x-.6,y-.6,h),(x+.6,y+.6,h+3),.065,rail)
        o=box('Lighting_array',(x,y,33),(7.2,1,3.6),dark,.2);o.rotation_euler.z=a-math.pi/2
        for ix in range(7):
            for iz in range(3):
                xx=x+(ix-3)*.9*math.cos(a-math.pi/2);yy=y+(ix-3)*.9*math.sin(a-math.pi/2)
                oval('Flood_lens',(xx-math.cos(a)*.55,yy-math.sin(a)*.55,32+iz),(.30,.30,.30),light,10,6)
    box('Electronic_scoreboard_frame',(0,-83,15),(22,1,8),dark,.25)
    box('LIVE_Scoreboard_display',(0,-82.4,15),(20,.04,6.6),ad)
    join_static();export('stadium')
    studio((33,44,25),(0,-8,4));bpy.context.scene.render.filepath=os.path.join(PROD,'stadium-preview.png');bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROD,'stadium.blend'))

def equipment():
    clear();wood=texture(mat('Selected willow',(.85,.70,.45)), 'willow','wood');rubber=mat('Dark ribbed rubber',(.035,.075,.07));label=mat('Bat graphic',(.035,.20,.18));gold=mat('Bat foil',(.8,.85,.44),.45)
    # Local origin at handle centre; blade descends along Z. Custom curved face/profile.
    rings=[(.16,.015,.015),(.05,.017,.017),(-.05,.021,.018),(-.13,.045,.021),(-.22,.055,.030),(-.51,.055,.040),(-.63,.049,.027),(-.665,.040,.012)]
    vs=[]
    for z,w,d in rings:vs += [(-w,-d*.48,z),(w,-d*.48,z),(w,d,z),(-w,d,z)]
    fs=[]
    for j in range(len(rings)-1):
        for i in range(4):fs.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
    fs += [(0,3,2,1),tuple(range(28,32))];mesh('Willow_blade',vs,fs,wood,True)
    rod('Handle',(0,0,.04),(0,0,.30),.017,rubber,16)
    for i in range(21):
        bpy.ops.mesh.primitive_torus_add(major_radius=.017,minor_radius=.0014,major_segments=16,minor_segments=4,location=(0,0,.06+i*.011));bpy.context.object.data.materials.append(gold if i in (1,2) else rubber)
    box('Blade_decal',(0,-.020,-.29),(.085,.003,.13),label,.005);box('Blade_flash',(0,-.023,-.30),(.015,.003,.08),gold,.002)
    join_static()
    for name,height in [('Grip_Left',.16),('Grip_Right',.065)]:
        marker=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(marker);marker.location=(0,0,height)
    export('bat')
    clear();red=texture(mat('Oxblood leather',(.37,.018,.028),.4),'ball_leather','cloth',256);stitch=mat('Waxed seam thread',(.77,.65,.47),.8)
    oval('Leather_ball',(0,0,0),(.036,.036,.036),red,32,20)
    for side in (-1,1):
        for i in range(70):
            a=i*math.tau/70;rod('Raised_seam',(side*.003,.0358*math.cos(a),.0358*math.sin(a)),(side*.005,.0356*math.cos(a+.032),.0356*math.sin(a+.032)),.00065,stitch,5)
    join_static();export('ball')
    clear();wood=mat('Wicket ivory',(.88,.85,.69),.55);green=mat('Wicket marking',(.04,.27,.20))
    for i in (-1,0,1):
        rod('Stump_'+str(i),(i*.114,0,0),(i*.114,0,.711),.019,wood,12)
        for h in (.37,.4,.58):rod('Stump_brand',(i*.114,0,h),(i*.114,0,h+.015),.0195,green,12)
    for i,x in enumerate((-.057,.057)):
        rod('LIVE_Bail_'+str(i),(x-.055,0,.724),(x+.055,0,.724),.011,wood,10)
    export('wicket')

def character(role):
    clear();isbat=role=='batsman';keeper=role=='keeper'
    skin=mat('Warm skin',(.45,.255,.15),.74);kit=texture(mat('Indigo knit' if isbat else 'Burnt orange knit',(.055,.135,.23) if isbat else (.62,.21,.10)),role+'_fabric','cloth',256)
    pants=mat('Cricket trousers',(.075,.16,.25) if isbat else (.12,.17,.19));trim=mat('Team trim',(.67,.83,.74) if isbat else (.95,.66,.32));pad=mat('Ivory protective foam',(.82,.84,.77));shoe=mat('Shoe upper',(.74,.76,.70));sole=mat('Rubber sole',(.07,.09,.09));hair=mat('Hair and brows',(.025,.018,.014));iris=mat('Eyes',(.045,.025,.015));eye=mat('Eyes sclera',(.72,.70,.62));steel=mat('Titanium face grille',(.36,.40,.39),.35,.8)
    arm=bpy.data.armatures.new(role+'_skeleton');rig=bpy.data.objects.new('Cricketer_Rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    defs=[('root',(0,0,0),(0,0,.15),None),('pelvis',(0,0,.88),(0,0,1.05),'root'),('spine',(0,0,1.05),(0,0,1.28),'pelvis'),('chest',(0,0,1.28),(0,0,1.49),'spine'),('neck',(0,0,1.49),(0,0,1.58),'chest'),('head',(0,0,1.58),(0,0,1.82),'neck')]
    for side,s in [('L',-1),('R',1)]:defs += [(f'upperarm.{side}',(s*.21,0,1.46),(s*.29,-.018,1.16),'chest'),(f'forearm.{side}',(s*.29,-.018,1.16),(s*.31,-.04,.90),f'upperarm.{side}'),(f'hand.{side}',(s*.31,-.04,.90),(s*.31,-.045,.79),f'forearm.{side}'),(f'thigh.{side}',(s*.105,0,.94),(s*.13,-.015,.53),'pelvis'),(f'shin.{side}',(s*.13,-.015,.53),(s*.13,0,.11),f'thigh.{side}'),(f'foot.{side}',(s*.13,0,.11),(s*.13,-.18,.07),f'shin.{side}')]
    for name,a,b,parent in defs:
        bn=arm.edit_bones.new(name);bn.head=a;bn.tail=b
        if parent:bn.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    def bind(o,bone):
        group=o.vertex_groups.new(name=bone);group.add(list(range(len(o.data.vertices))),1,'REPLACE');o.parent=rig;mod=o.modifiers.new('Anatomical rig','ARMATURE');mod.object=rig;return o
    bind(loft('Tailored_jersey',(0,0,.98),(0,0,1.50),[(0,.15,.105),(.12,.162,.11),(.45,.174,.112),(.8,.213,.123),(.94,.21,.11),(1,.15,.08)],kit,24,True),'chest')
    bind(loft('Trouser_seat',(0,0,.85),(0,0,1.05),[(0,.14,.10),(.5,.17,.12),(1,.15,.10)],pants,20,True),'pelvis')
    bind(loft('Collar',(0,0,1.45),(0,0,1.52),[(0,.08,.074),(1,.064,.06)],trim),'chest')
    bind(loft('Neck',(0,0,1.45),(0,0,1.63),[(0,.067,.06),(1,.059,.058)],skin),'neck')
    bind(loft('Sculpted_face',(0,-.005,1.55),(0,-.004,1.85),[(0,.045,.048),(.14,.068,.067),(.32,.082,.077),(.52,.088,.080),(.76,.083,.076),(.95,.061,.056),(1,.01,.01)],skin,24),'head')
    # Eye sockets, nose, ears, lower lip and eyebrows readable in close-ups.
    for s in (-1,1):
        bind(oval('Ear',(s*.086,0,1.708),(.015,.022,.030),skin,12,8),'head')
        bind(oval('Eye',(s*.032,-.076,1.73),(.018,.009,.010),eye,12,8),'head');bind(oval('Iris',(s*.031,-.084,1.73),(.007,.003,.007),iris,10,6),'head')
        bind(loft('Brow',(s*.016,-.08,1.752),(s*.05,-.077,1.754),[(0,.004,.005),(1,.003,.004)],hair,8),'head')
    bind(loft('Nose',(0,-.075,1.74),(0,-.100,1.684),[(0,.011,.012),(.75,.016,.016),(1,.012,.01)],skin,12),'head');bind(oval('Lips',(0,-.075,1.65),(.026,.008,.005),skin,12,6),'head')
    bind(oval('Cropped_hair',(0,.009,1.796),(.086,.075,.061),hair,24,10),'head')
    for side,s in [('L',-1),('R',1)]:
        for n,a,b,parent in defs:
            if n==f'upperarm.{side}':
                bind(loft('Sleeve_'+side,a,Vector(a).lerp(Vector(b),.55),[(0,.055,.05),(.15,.083,.075),(.55,.082,.074),(1,.070,.063)],kit,16,True),n)
                bind(loft('Upper_arm_'+side,a,b,[(0,.068,.060),(.4,.069,.063),(1,.049,.045)],skin),n)
            if n==f'forearm.{side}':bind(loft('Forearm_'+side,a,b,[(0,.052,.046),(.3,.055,.047),(.75,.035,.033),(1,.031,.029)],skin),n)
            if n==f'thigh.{side}':bind(loft('Trouser_thigh_'+side,a,b,[(0,.09,.1),(.25,.095,.095),(.65,.073,.075),(1,.060,.058)],pants,20,True),n)
            if n==f'shin.{side}':bind(loft('Trouser_calf_'+side,a,b,[(0,.062,.061),(.4,.061,.058),(.8,.041,.043),(1,.043,.045)],pants,16,True),n)
        bn=f'hand.{side}';handmat=pad if isbat or keeper else skin
        bind(loft('Palm_'+side,(s*.31,-.045,.91),(s*.31,-.048,.80),[(0,.033,.027),(.4,.045,.027),(1,.038,.021)],handmat),bn)
        for f in range(4):
            x=s*.31+(f-1.5)*.018;bind(loft('Finger_'+side+str(f),(x,-.05,.82),(x,-.055,.77+(abs(f-1.5))*.009),[(0,.008,.012),(1,.006,.009)],handmat,8),bn)
        if isbat or keeper:
            for zz in range(4):bind(box('Glove_flex_'+side,(s*.31,-.075,.83+zz*.018),(.068,.014,.012),pad,.004),bn)
            bind(box('Glove_strap_'+side,(s*.31,-.065,.905),(.067,.017,.033),trim,.006),bn)
        for name,zz,rx,ry in [('Outsole',.037,.066,.14),('Shoe_upper',.079,.06,.131)]:bind(oval(name+side,(s*.13,-.065,zz),(rx,ry,.034 if name=='Outsole' else .06),sole if name=='Outsole' else shoe,20,10),f'foot.{side}')
        for j in range(4):bind(rod('Laces',(s*.13-.025,-.08+j*.02,.125),(s*.13+.025,-.08+j*.02,.125),.003,sole,6),f'foot.{side}')
        if isbat or keeper:
            bind(loft('Sculpted_pad_'+side,(s*.13,-.071,.12),(s*.13,-.072,.63),[(0,.055,.027),(.12,.080,.035),(.72,.085,.042),(.92,.073,.044),(1,.045,.03)],pad,20),f'shin.{side}')
            for j in range(6):
                x=s*.13+(j-2.5)*.022;bind(loft('Pad_cane_'+side+str(j),(x,-.107,.18),(x,-.112,.51),[(0,.008,.007),(.5,.010,.010),(1,.008,.007)],pad,8),f'shin.{side}')
            bind(oval('Knee_roll_'+side,(s*.13,-.111,.57),(.080,.029,.045),pad,16,8),f'shin.{side}')
    # Chest badges and cloth panels.
    bind(box('Team_crest',(-.085,-.12,1.38),(.031,.006,.043),trim,.005),'chest')
    for s in (-1,1):bind(box('Shoulder_piping',(s*.16,-.10,1.445),(.068,.009,.013),trim,.003),'chest')
    if isbat or keeper:
        vs=[];fs=[];seg=32
        for j in range(9):
            ph=.06+(math.pi*.55)*j/8
            for i in range(seg):
                a=i*math.tau/seg;vs.append((.101*math.sin(ph)*math.cos(a),.005+.096*math.sin(ph)*math.sin(a),1.785+.095*math.cos(ph)))
        for j in range(8):
            for i in range(seg):fs.append((j*seg+i,j*seg+(i+1)%seg,(j+1)*seg+(i+1)%seg,(j+1)*seg+i))
        bind(mesh('Helmet_shell',vs,fs,pants,True),'head');bind(box('Helmet_peak',(0,-.091,1.792),(.19,.10,.012),pants,.01),'head')
        for z in (1.62,1.665,1.71):
            for i in range(12):
                a=-math.pi+math.pi*i/12;b=-math.pi+math.pi*(i+1)/12;bind(rod('Face_guard',(.107*math.cos(a),.125*math.sin(a)-.01,z),(.107*math.cos(b),.125*math.sin(b)-.01,z),.0028,steel,6),'head')
        for x in (-.07,0,.07):bind(rod('Grille_vertical',(x,-.105,1.62),(x,-.105,1.75),.0025,steel,6),'head')
    # Raised stitched squad number and seam detail, prepared as skinned geometry.
    bpy.ops.object.text_add(location=(.075,.126,1.28),rotation=(math.pi/2,0,math.pi))
    txt=bpy.context.object;txt.name='Squad_number';txt.data.body='07' if isbat else '18';txt.data.align_x='CENTER';txt.data.size=.16;txt.data.extrude=.0005;txt.data.materials.append(trim)
    bpy.ops.object.convert(target='MESH');bind(bpy.context.object,'chest')
    for side,s in [('L',-1),('R',1)]:
        bind(loft('Trouser_piping_'+side,(s*.18,.015,.92),(s*.19,.015,.62),[(0,.006,.006),(1,.005,.005)],trim,6),'thigh.'+side)
    # Join all skinned surfaces into one draw-efficient character, preserving groups.
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=role+'_skinned_mesh'
    # Author reusable action clips; runtime adds cricket-specific IK to these poses.
    rig.animation_data_create();sc=bpy.context.scene;sc.render.fps=30
    clips={'Idle':60,'Run':24,'Bowl':48,'Defend':24,'Drive':30,'Loft':34,'Pull':28,'Catch':30}
    for cname,length in clips.items():
        action=bpy.data.actions.new(cname);rig.animation_data.action=action
        for frame in range(0,length+1,2):
            t=frame/length;p=math.sin(t*math.pi);cycle=math.sin(t*math.tau)
            for bone in rig.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
            if cname=='Run':
                for side,s in [('L',1),('R',-1)]:
                    rig.pose.bones['thigh.'+side].rotation_euler.x=cycle*.65*s;rig.pose.bones['shin.'+side].rotation_euler.x=max(0,-cycle*s)*.85;rig.pose.bones['upperarm.'+side].rotation_euler.x=-cycle*.65*s;rig.pose.bones['forearm.'+side].rotation_euler.x=-.7
            elif cname=='Bowl':
                rig.pose.bones['upperarm.R'].rotation_euler.x=-t*math.tau;rig.pose.bones['upperarm.L'].rotation_euler.x=-p*1.8;rig.pose.bones['chest'].rotation_euler.x=p*.23
            elif cname in ('Drive','Defend','Loft','Pull'):
                power={'Drive':1.6,'Defend':.55,'Loft':2.3,'Pull':1.7}[cname]
                for side in ('L','R'):rig.pose.bones['upperarm.'+side].rotation_euler.x=-.45-p*power;rig.pose.bones['forearm.'+side].rotation_euler.x=-.35-p*.35
                rig.pose.bones['chest'].rotation_euler.z=p*(-.6 if cname=='Pull' else -.23)
            elif cname=='Catch':
                for side in ('L','R'):rig.pose.bones['upperarm.'+side].rotation_euler.x=-p*2.2
            else:rig.pose.bones['chest'].rotation_euler.x=cycle*.018
            for bone in rig.pose.bones:bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new();track.name=cname;strip=track.strips.new(cname,0,action);track.mute=True
    sc.frame_set(0);export(role,True)
    if isbat:
        studio((2,-3,1.9),(0,0,1.02),(600,850));sc.render.filepath=os.path.join(PROD,'batsman-preview.png');bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(PROD,role+'.blend'))

if __name__=='__main__':
    import sys
    section=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'all'
    if section in ('all','equipment'):equipment()
    if section in ('all','characters'):
        for role in ('batsman','bowler','keeper'):character(role)
    if section in ('all','stadium'):stadium()
    manifest={'author':'CricVerse production; CC0 MakeHuman-derived human base via Innerscene','humanProvenance':'production/source-assets/LICENSES.md','animation':'Named GLB rest-pose placeholders; layered gameplay skeletal animation in src/game/rig.ts','units':'metres','sourceAxes':'Z up','gameAxes':'Y up','pitchLength':20.12,'ballRadius':.036,'assets':['stadium','batsman','bowler','keeper','bat','ball','wicket','crowd'],'batLength':.965,'clips':['Idle','Run','Bowl','Defend','Drive','Loft','Pull','Catch']}
    with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
    print('ASSET PRODUCTION COMPLETE',flush=True)
