import sys,os
sys.path.insert(0,os.path.dirname(__file__))
from build_assets import *
clear();cloth=mat('Crowd tint',(1,1,1));skin=mat('Crowd skin',(.6,.42,.28))
loft('Seated_torso',(0,0,.46),(0,0,1.04),[(0,.16,.12),(.6,.20,.13),(1,.15,.09)],cloth,8)
loft('Head',(0,0,1.05),(0,0,1.34),[(0,.06,.06),(.3,.095,.075),(.75,.09,.08),(1,.025,.025)],cloth,8)
for s in (-1,1):
    loft('Upper_arm',(s*.19,0,.99),(s*.24,-.05,.7),[(0,.06,.06),(1,.045,.045)],cloth,6)
    loft('Forearm',(s*.24,-.05,.7),(s*.18,-.26,.64),[(0,.05,.045),(1,.03,.03)],cloth,6)
    loft('Thigh',(s*.1,0,.48),(s*.13,-.30,.48),[(0,.09,.09),(1,.065,.065)],cloth,6)
    loft('Shin',(s*.13,-.30,.48),(s*.13,-.31,.05),[(0,.06,.06),(1,.035,.035)],cloth,6)
join_static();export('crowd')
