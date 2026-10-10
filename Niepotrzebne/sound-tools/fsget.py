#!/usr/bin/env python3
"""Download Freesound HQ preview + verify license. usage: fsget.py id [id...]"""
import sys, re, urllib.request, urllib.parse, html, json, os
RAW='/Users/jurek/Downloads/Claude/Projects/Gzowo Tennis/Niepotrzebne/sound-raw'
MD=os.path.join(RAW,'meta'); os.makedirs(MD,exist_ok=True)
UA={'User-Agent':'WiiDuo/1.0 (jurek)'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
for sid in sys.argv[1:]:
    key=f'fs_{sid}'
    if os.path.exists(os.path.join(MD,key+'.json')) and os.path.exists(os.path.join(RAW,key+'.mp3')):
        print('have',key); continue
    # resolve page via redirect
    u=f'https://freesound.org/s/{sid}/'
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60)
    page_url=r.geturl(); h=r.read().decode()
    lic_m=re.search(r'href="(https?://creativecommons.org/[^"]+)"',h)
    lic_url=lic_m.group(1) if lic_m else ''
    if 'publicdomain/zero' in lic_url: lic='CC0'
    elif '/licenses/by/' in lic_url:
        v=re.search(r'/by/([\d.]+)',lic_url); lic='CC-BY '+(v.group(1) if v else '')
    elif '/licenses/by-sa/' in lic_url: lic='CC-BY-SA'
    else: lic='OTHER:'+lic_url
    user=urllib.parse.unquote(re.search(r'/people/([^/]+)/sounds/',page_url).group(1))
    tm=re.search(r'<title>Freesound - (.*) by ([^<]*)</title>',h)
    title=html.unescape(tm.group(1)) if tm else html.unescape(re.search(r'data-title="([^"]*)"',h).group(1))
    if tm: user=html.unescape(tm.group(2)).strip()
    mp3=re.search(r'data-mp3="([^"]*)"',h).group(1).replace('-lq.mp3','-hq.mp3')
    if lic.startswith('OTHER') or 'nc' in lic_url:
        print('SKIP license',sid,lic_url); continue
    data=get(mp3)
    open(os.path.join(RAW,key+'.mp3'),'wb').write(data)
    m={'title':title,'author':user,'license':lic.strip(),'license_url':lic_url,'source':page_url.split('?')[0],'site':'Freesound'}
    json.dump(m,open(os.path.join(MD,key+'.json'),'w'),indent=1)
    print('got',key,lic,user,title,len(data))
