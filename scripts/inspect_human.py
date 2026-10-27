import bpy,json,os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'production/source-assets/makehuman-male-cc0.glb'))
summary=[]
for o in bpy.context.scene.objects:
    if o.type=='ARMATURE':
        summary.append({'name':o.name,'type':o.type,'loc':list(o.location),'scale':list(o.scale),'bones':[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None} for b in o.data.bones]})
    elif o.type=='MESH':summary.append({'name':o.name,'type':o.type,'verts':len(o.data.vertices),'dimensions':list(o.dimensions),'loc':list(o.location),'materials':[m.name for m in o.data.materials]})
with open(os.path.join(root,'production/source-assets/human-inspection.json'),'w') as f:json.dump(summary,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'production/source-assets/human-import.blend'))
print('HUMAN INSPECTED')
