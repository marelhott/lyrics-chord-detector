"""Conservative album matching; metadata cache is separate from audio jobs."""
import asyncio
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import time
import unicodedata
import httpx

_lock = asyncio.Lock()
_pending = set()

def normalized(value):
    value = unicodedata.normalize('NFKD', value.casefold())
    return ''.join(c for c in value if c.isalnum())

def identity(title, artist=''):
    title = re.sub(r'\.(mp3|wav|m4a|flac|ogg)$', '', title, flags=re.I)
    title = re.sub(r'\s*[\[(](?:official[^\])]*|lyrics?[^\])]*|audio|video|nová separace|rychlejší separace)[\])]','',title,flags=re.I).strip()
    if ' - ' in title:
        artist, title = title.split(' - ', 1)
    return title.strip(), re.sub(r'\s*-\s*Topic$', '', artist).strip()

def read(folder):
    try: return json.loads((folder / 'artwork.json').read_text()).get('artwork')
    except (OSError, ValueError): return None

async def resolve(title, artist='', duration=None):
    title, artist = identity(title, artist)
    if not artist or not title: return None
    # Escape Lucene syntax; do not let filenames alter the query structure.
    quote = lambda s: re.sub(r'[^\w\s-]', ' ', s)
    query = f'recording:"{quote(title)}" AND artist:"{quote(artist)}"'
    async with _lock:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={'User-Agent':'StemStudio/1.1 (https://github.com/marelhott/lyrics-chord-detector)'}) as client:
            r = await client.get('https://musicbrainz.org/ws/2/recording/', params={'query':query,'fmt':'json','limit':10})
            await asyncio.sleep(1.05)
            r.raise_for_status()
            candidates = []
            for recording in r.json().get('recordings', []):
                name = ''.join(c.get('name',c.get('artist',{}).get('name','')) for c in recording.get('artist-credit',[]) if isinstance(c,dict))
                if normalized(recording['title']) != normalized(title): continue
                if SequenceMatcher(None, normalized(name), normalized(artist)).ratio() < .9: continue
                if int(recording.get('score', 0)) < 95: continue
                if any(x in recording.get('disambiguation','').casefold() for x in ['live', 'mix', 'remix']): continue
                for release in recording.get('releases',[]):
                    group=release.get('release-group',{})
                    if group.get('primary-type') != 'Album' or group.get('secondary-types'): continue
                    if release.get('status') not in (None,'Official'): continue
                    candidates.append((release.get('date','9999'),release,name))
            for _, release, name in sorted(candidates,key=lambda x:x[0])[:4]:
                r = await client.get('https://coverartarchive.org/release/'+release['id'])
                if r.status_code != 200: continue
                front=next((i for i in r.json().get('images',[]) if i.get('front')),None)
                if front:
                    return {'url':front.get('thumbnails',{}).get('large',front['image']).replace('http://','https://'), 'album':release['title'],'artist':name,'source':'MusicBrainz · Cover Art Archive','sourceURL':'https://musicbrainz.org/release/'+release['id']}
    return None

async def ensure(folder, title):
    if folder.name in _pending: return
    cache=folder/'artwork.json'
    if cache.exists() and time.time()-cache.stat().st_mtime<86400: return
    _pending.add(folder.name)
    try:
        try: inputs=json.loads((folder/'input.json').read_text())
        except (OSError,ValueError): inputs={}
        artwork=await resolve(inputs.get('title') or title,inputs.get('artist',''),inputs.get('duration'))
        if folder.exists() and (artwork or not inputs.get("url") or inputs.get("source")):
            tmp=folder/'artwork.tmp';tmp.write_text(json.dumps({'artwork':artwork}));tmp.replace(cache)
    except (httpx.HTTPError,ValueError,KeyError,TypeError):
        pass # A catalog outage must never fail a song or block playback.
    finally: _pending.discard(folder.name)
