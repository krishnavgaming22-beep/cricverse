import bpy,os,json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
report=[]
for name in ['stadium','batsman','bowler','keeper','bat','ball','wicket','crowd']:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'production',name+'.blend'))
    points=[]
    for o in bpy.context.scene.objects:
        if o.type=='MESH':points += [o.matrix_world@vertex.co for vertex in o.data.vertices]
    lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
    missing=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file and not os.path.exists(bpy.path.abspath(im.filepath))]
    report.append({'asset':name,'boundsMetres':[round(hi[i]-lo[i],5) for i in range(3)],'missingExternalFiles':missing,'rigs':sum(o.type=='ARMATURE' for o in bpy.context.scene.objects),'actions':len(bpy.data.actions)})
    if missing:raise RuntimeError(name+' has missing dependencies')
bat=next(x for x in report if x['asset']=='bat');assert abs(bat['boundsMetres'][2]-.965)<.005,bat
ball=next(x for x in report if x['asset']=='ball');assert .071<=ball['boundsMetres'][0]<=.074,ball
with open(os.path.join(ROOT,'qa','blender-audit.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
