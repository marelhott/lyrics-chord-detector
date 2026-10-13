import asyncio
import importlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        os.environ.update(DATA_DIR=self.temp.name, STUDIO_PASSWORD='unit-test-password', COOKIE_SECURE='0')
        from backend import studio
        self.app = importlib.reload(studio)
        async def idle():
            await asyncio.sleep(10000)
        self.patch = patch.object(self.app, 'worker', idle)
        self.patch.start()
        self.client = TestClient(self.app.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.patch.stop()
        self.temp.cleanup()

    def login(self):
        self.assertEqual(self.client.post('/api/session', json={'password':'unit-test-password'}).status_code, 200)

    def test_auth_and_cross_site_guard(self):
        self.assertEqual(self.client.get('/api/songs').status_code, 401)
        self.assertEqual(self.client.get('/api/app/ios').status_code, 401)
        self.assertEqual(self.client.post('/api/session', json={'password':'wrong'}).status_code, 401)
        self.login()
        self.assertEqual(self.client.get('/api/songs').status_code, 200)
        self.assertEqual(self.client.post('/api/songs', headers={'Sec-Fetch-Site':'cross-site'}).status_code, 403)

    def test_url_allowlist_queue_and_persistence(self):
        self.login()
        for url in ('http://127.0.0.1/audio', 'https://youtube.com.evil.example/x', 'https://open.spotify.com/track/abc'):
            self.assertEqual(self.client.post('/api/songs', data={'url':url}).status_code, 400)
        result = self.client.post('/api/songs', data={'url':'https://youtu.be/example'})
        self.assertEqual(result.status_code, 202)
        job = result.json()['id']
        self.assertEqual(self.client.get('/api/songs/'+job).json()['status'], 'queued')
        self.assertEqual(self.client.delete('/api/songs/'+job).status_code, 409)
        with self.app.db() as conn:
            self.assertEqual(conn.execute('SELECT id FROM songs').fetchone()['id'], job)
        for _ in range(2):
            self.assertEqual(self.client.post('/api/songs', data={'url':'https://youtu.be/example'}).status_code, 202)
        self.assertEqual(self.client.post('/api/songs', data={'url':'https://youtu.be/example'}).status_code, 429)

    def test_failed_retry_and_safe_media(self):
        self.login()
        job = self.client.post('/api/songs', data={'url':'https://youtu.be/example'}).json()['id']
        self.app.update(job, status='failed', step='failed', error='test')
        self.assertEqual(self.client.get(f'/api/songs/{job}/audio/library.sqlite').status_code, 404)
        self.assertEqual(self.client.post(f'/api/songs/{job}/retry').status_code, 200)
        self.assertEqual(self.client.post(f'/api/songs/{job}/retry').status_code, 409)
        self.app.update(job, status='failed', step='failed')
        self.assertEqual(self.client.delete('/api/songs/'+job).status_code, 200)
        self.assertFalse((Path(self.temp.name)/job).exists())
        self.assertEqual(self.client.get('/api/songs/'+job).status_code, 404)

    def test_stems_remain_available_during_analysis_and_after_failure(self):
        self.login()
        job = self.client.post('/api/songs', data={'url':'https://youtu.be/example'}).json()['id']
        folder = Path(self.temp.name) / job
        (folder / 'audio').mkdir()
        (folder / 'audio' / 'vocals.mp3').write_bytes(b'ID3fixture')
        partial = {'duration':20, 'stems':['vocals'], 'analysis':{'lyrics':'pending'}, 'words':[]}
        (folder / 'partial.json').write_text(json.dumps(partial))
        (folder / 'step.json').write_text(json.dumps({'step':'lyrics'}))
        self.app.update(job, status='running')
        detail = self.client.get('/api/songs/'+job).json()
        self.assertEqual(detail['step'], 'lyrics')
        self.assertEqual(detail['result'], partial)
        self.assertEqual(self.client.get(f'/api/songs/{job}/audio/vocals').status_code, 200)
        self.app.update(job, status='failed', error='analysis crashed')
        self.assertEqual(self.client.get('/api/songs/'+job).json()['result'], partial)
        self.assertEqual(self.client.get(f'/api/songs/{job}/audio/vocals').content, b'ID3fixture')

    def test_rejects_empty_and_invalid_upload(self):
        self.login()
        self.assertEqual(self.client.post('/api/songs',files={'file':('empty.mp3',b'', 'audio/mpeg')}).status_code,400)
        self.assertEqual(self.client.post('/api/songs',files={'file':('text.mp3',b'not audio','audio/mpeg')}).status_code,400)
        self.assertEqual(self.client.get('/api/songs').json(),[])

if __name__ == '__main__': unittest.main()

    def test_actual_progress_and_cached_album(self):
        self.login()
        created = self.client.post('/api/songs', data={'url':'https://youtu.be/example'}).json()['id']
        folder = self.app.DATA / created
        self.app.update(created, status='running')
        (folder/'step.json').write_text(json.dumps({'step':'separating','progress':0.42}))
        artwork = {'url':'https://coverartarchive.org/example.jpg','album':'Album','artist':'Artist'}
        (folder/'artwork.json').write_text(json.dumps({'artwork':artwork}))
        detail = self.client.get('/api/songs/'+created).json()
        self.assertEqual(detail['progress'],0.42)
        self.assertEqual(detail['artwork'],artwork)
        self.assertEqual(self.client.get('/api/songs').json()[0]['artwork'],artwork)
