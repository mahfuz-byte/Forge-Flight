"""Checks that the public Funnel target is authenticated and narrowly scoped."""
import io
import json
import unittest
from email.message import Message
from unittest.mock import patch

import ollama_bridge


class FakeResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self, limit):
        return b'{"message":{"content":"ok"}}'


class BridgeTests(unittest.TestCase):
    def request(self, path, authorization, payload):
        handler = object.__new__(ollama_bridge.BridgeHandler)
        handler.path = path
        handler.headers = Message()
        handler.headers['Authorization'] = authorization
        handler.headers['Content-Length'] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
        handler.wfile = io.BytesIO()
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        handler.do_POST()
        return handler

    @patch.object(ollama_bridge, 'TOKEN', 'a' * 40)
    @patch.object(ollama_bridge, 'urlopen')
    def test_authentication_route_and_model(self, upstream):
        payload = json.dumps({'model': 'deepseek-r1:1.5b', 'messages': []}).encode()
        self.assertEqual(self.request('/api/chat', '', payload).status, 401)
        self.assertEqual(self.request('/other', 'Bearer ' + 'a' * 40, payload).status, 404)
        wrong_model = json.dumps({'model': 'other', 'messages': []}).encode()
        self.assertEqual(self.request('/api/chat', 'Bearer ' + 'a' * 40, wrong_model).status, 400)
        upstream.assert_not_called()

    @patch.object(ollama_bridge, 'TOKEN', 'a' * 40)
    @patch.object(ollama_bridge, 'urlopen', return_value=FakeResponse())
    def test_authorized_chat_forces_non_streaming(self, upstream):
        payload = json.dumps({'model': 'deepseek-r1:1.5b', 'messages': [], 'stream': True}).encode()
        result = self.request('/api/chat', 'Bearer ' + 'a' * 40, payload)
        self.assertEqual(result.status, 200)
        self.assertIn(b'"content":"ok"', result.wfile.getvalue())
        forwarded = upstream.call_args.args[0]
        self.assertEqual(forwarded.full_url, 'http://127.0.0.1:11434/api/chat')
        self.assertFalse(json.loads(forwarded.data)['stream'])


if __name__ == '__main__':
    unittest.main()
