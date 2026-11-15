"""Run a narrow, authenticated gateway to the local Ollama chat API.

Expose this port through Tailscale Funnel during a demo. Never expose Ollama's
own port: its API has no application authentication.
"""
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TOKEN = os.environ.get('OLLAMA_BRIDGE_TOKEN', '')
MODEL = os.environ.get('OLLAMA_MODEL', 'deepseek-r1:1.5b')
UPSTREAM = os.environ.get('LOCAL_OLLAMA_HOST', 'http://127.0.0.1:11434').rstrip('/')
MAX_REQUEST = 1024 * 1024
MAX_RESPONSE = 8 * 1024 * 1024


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Avoid logging prompts or the bearer token.
        pass

    def respond(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/chat':
            return self.respond(404, {'error': 'Not found.'})
        supplied = self.headers.get('Authorization', '')
        if not hmac.compare_digest(supplied, f'Bearer {TOKEN}'):
            return self.respond(401, {'error': 'Unauthorized.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.respond(400, {'error': 'Invalid request length.'})
        if length < 1 or length > MAX_REQUEST:
            return self.respond(413, {'error': 'Request too large.'})
        body = self.rfile.read(length)
        try:
            request = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            return self.respond(400, {'error': 'Invalid JSON.'})
        if not isinstance(request, dict) or request.get('model') != MODEL:
            return self.respond(400, {'error': 'Model not allowed.'})
        request['stream'] = False
        forwarded = json.dumps(request).encode('utf-8')
        try:
            upstream_request = Request(
                f'{UPSTREAM}/api/chat', data=forwarded,
                headers={'Content-Type': 'application/json'}, method='POST',
            )
            with urlopen(upstream_request, timeout=240) as response:
                result = response.read(MAX_RESPONSE + 1)
                if len(result) > MAX_RESPONSE:
                    return self.respond(502, {'error': 'Ollama response too large.'})
                self.send_response(response.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(result)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(result)
        except HTTPError as exc:
            self.respond(502, {'error': f'Ollama returned HTTP {exc.code}.'})
        except (OSError, URLError):
            self.respond(502, {'error': 'Local Ollama is unavailable.'})


if __name__ == '__main__':
    if len(TOKEN) < 32:
        raise SystemExit('Set OLLAMA_BRIDGE_TOKEN to a random value of at least 32 characters.')
    port = int(os.environ.get('OLLAMA_BRIDGE_PORT', '11435'))
    server = ThreadingHTTPServer(('127.0.0.1', port), BridgeHandler)
    print(f'Ollama bridge listening on http://127.0.0.1:{port}', flush=True)
    server.serve_forever()
