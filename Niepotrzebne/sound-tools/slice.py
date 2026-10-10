import subprocess, numpy as np, json, os
from scipy.io import wavfile
RAW='sound-raw'; OUT='../sounds'; os.makedirs(OUT,exist_ok=True)
def load(key):
    wav=f'/tmp/gt_{key}.wav'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'{RAW}/{key}.mp3','-ac','1','-ar','44100',wav],check=True)
    sr,x=wavfile.read(wav); return sr,x.astype(np.float32)/32768
def save(seg,sr,name,fi=0.003,fo=0.08,norm=0.9):
    seg=seg.copy(); a=int(fi*sr); b=int(fo*sr)
    if a: seg[:a]*=np.linspace(0,1,a)
    if b: seg[-b:]*=np.linspace(1,0,b)**2
    seg/=max(1e-6,np.max(np.abs(seg)))/norm
    tmp=f'/tmp/{name}.wav'; wavfile.write(tmp,sr,(seg*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',tmp,'-b:a','128k',f'{OUT}/{name}.mp3'],check=True)
def onsets(x,sr,n,gap):
    hop=256; m=len(x)//hop
    env=np.sqrt(np.array([np.mean(x[i*hop:(i+1)*hop]**2) for i in range(m)])+1e-12)
    flux=np.maximum(0,np.diff(env,prepend=env[0])); thr=np.percentile(flux,98.5)
    c=[i for i in range(1,m-1) if flux[i]>thr and flux[i]>=flux[i-1] and flux[i]>=flux[i+1]]
    picks=[]
    for i in sorted(c,key=lambda i:-flux[i]):
        if all(abs(i-j)*hop/sr>gap for j in picks): picks.append(i)
    return [i*hop for i in sorted(picks[:n])]
man={}
def shots(key,cat,n,length,gap=0.4):
    sr,x=load(key); out=[]
    for k,s in enumerate(onsets(x,sr,n,gap)):
        s=max(0,s-int(0.01*sr)); seg=x[s:s+int(length*sr)]
        if len(seg)<int(0.1*sr): continue
        name=f'{cat}_{key[3:]}_{k}'; save(seg,sr,name); out.append(name+'.mp3')
    man.setdefault(cat,[]).extend(out)
def clip(key,cat,start,length):
    sr,x=load(key); seg=x[int(start*sr):int((start+length)*sr)]
    name=f'{cat}_{key[3:]}'; save(seg,sr,name,fi=0.05,fo=0.9,norm=0.8); man.setdefault(cat,[]).append(name+'.mp3')
shots('fs_338122','hit',6,0.35); shots('fs_457039','hit',1,0.2); shots('fs_710041','hit',1,0.5)
shots('fs_662266','serve',4,0.4); shots('fs_439340','serve',6,0.4,1.0)
shots('fs_533410','bounce',5,0.25,0.25); shots('fs_394355','bounce',4,0.25,0.25)
shots('fs_788265','net',1,0.8)
clip('fs_277021','applause',0.3,3.8); clip('fs_277020','applause',0.3,3.8); clip('fs_333404','applause',0,3.6)
clip('fs_397434','cheer',1.0,4.5)
shots('fs_264499','ooh',4,2.2,2.0)
json.dump(man,open(f'{OUT}/manifest.json','w'),indent=1)
print({k:len(v) for k,v in man.items()})
meta=[json.load(open(f'{RAW}/meta/'+f)) | {'key':f[3:-5]} for f in sorted(os.listdir(f'{RAW}/meta'))]
open(f'{OUT}/CREDITS.md','w').write('# Sound credits\n\nCC0 recordings from Freesound, sliced into one-shots for Gzowo Tennis.\n\n'+'\n'.join(f"- `{m['key']}`: \"{m['title']}\" by {m['author']} ({m['license']}), {m['source']}" for m in meta)+'\n')
