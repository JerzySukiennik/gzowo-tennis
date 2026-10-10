#!/usr/bin/env python3
"""Freesound HTML search. usage: fs.py "query" [cc0|by|any] [sort] [page]"""
import sys, re, urllib.request, urllib.parse, html, json
q=sys.argv[1]; lic=sys.argv[2] if len(sys.argv)>2 else 'cc0'
sort=sys.argv[3] if len(sys.argv)>3 else ''
page=sys.argv[4] if len(sys.argv)>4 else '1'
params={'q':q,'page':page}
if lic=='cc0': params['f']='license:"Creative Commons 0"'
elif lic=='by': params['f']='license:"Attribution"'
if sort=='dl': params['s']='Downloads (most first)'
elif sort=='rate': params['s']='Rating (highest first)'
params['g']='0'  # no pack grouping
url='https://freesound.org/search/?'+urllib.parse.urlencode(params)
req=urllib.request.Request(url,headers={'User-Agent':'WiiDuo/1.0 (jurek)'})
h=urllib.request.urlopen(req,timeout=30).read().decode()
blocks=h.split('class="bw-search__result"')[1:]
for b in blocks:
    def g(p):
        m=re.search(p,b,re.S); return html.unescape(m.group(1)).strip() if m else ''
    sid=g(r'data-sound-id="(\d+)"'); user=g(r'data-username="([^"]*)"')
    title=g(r'data-title="([^"]*)"'); dur=g(r'data-duration="([^"]*)"')
    dl=g(r'data-num-downloads="(\d+)"'); lic_=g(r'title="License: ([^"]*)"')
    rat=g(r'aria-label="Average rating of ([\d.]+)"')
    desc=g(r'<div class="max-h-60px-md-50px text-black overflow-hidden v-spacing-1" >(.*?)</div>')
    desc=re.sub(r'<[^>]+>','',desc); desc=re.sub(r'\s+',' ',desc)[:110]
    try: d=float(dur)
    except: d=0
    print(f"{sid:>7} {d:6.1f}s dl={dl:>6} r={rat or '-':>3} [{lic_[:18]}] {user}: {title[:50]} | {desc}")
