"""Upload safety tests (SEC-06)."""
import io
import shutil
import tempfile
import zipfile

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import User
from core.uploads import validate_post_media, validate_resume
from posts.models import Post

PW = 'c0rrect-Horse-battery'


def png_bytes():
    buf = io.BytesIO()
    Image.new('RGB', (4, 4), 'red').save(buf, 'PNG')
    return buf.getvalue()


def docx_bytes(macro=False):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr('[Content_Types].xml', '<Types/>')
        zf.writestr('word/document.xml', '<w:document/>')
        if macro:
            zf.writestr('word/vbaProject.bin', b'\x00' * 16)
    return buf.getvalue()


def upload(name, content, content_type='application/octet-stream'):
    return SimpleUploadedFile(name, content, content_type=content_type)


class ValidatorTests(SimpleTestCase):
    def assertRejected(self, validator, f):
        with self.assertRaises(ValidationError):
            validator(f)

    def test_accepts_real_files(self):
        validate_post_media(upload('photo.PNG', png_bytes(), 'image/png'))
        validate_post_media(upload('deck.pdf', b'%PDF-1.7\n...', 'application/pdf'))
        validate_resume(upload('cv.docx', docx_bytes()))

    def test_rejects_dangerous_types(self):
        for name, body in [
            ('page.html', b'<html><script>alert(1)</script></html>'),
            ('logo.svg', b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
            ('run.exe', b'MZ\x90\x00'),
            ('script.js', b'alert(1)'),
            ('archive.zip', b'PK\x03\x04'),
            ('noext', b'%PDF-1.7'),
        ]:
            with self.subTest(name=name):
                self.assertRejected(validate_post_media, upload(name, body))

    def test_rejects_content_that_does_not_match_extension(self):
        self.assertRejected(validate_post_media, upload('cat.png', b'<html><script>x</script></html>'))
        self.assertRejected(validate_post_media, upload('cv.pdf', b'MZ\x90\x00 not a pdf'))
        self.assertRejected(validate_post_media, upload('cat.jpg', png_bytes()))

    def test_rejects_corrupt_image(self):
        self.assertRejected(validate_post_media, upload('cat.png', png_bytes()[:20]))

    def test_rejects_office_files_with_macros_or_fake_zip(self):
        self.assertRejected(validate_resume, upload('cv.docx', docx_bytes(macro=True)))
        self.assertRejected(validate_resume, upload('cv.docx', b'PK\x03\x04garbage'))

    def test_size_limits(self):
        self.assertRejected(validate_resume, upload('cv.pdf', b'%PDF-' + b'0' * (10 * 1024 * 1024)))
        self.assertRejected(validate_resume, upload('cv.pdf', b''))


class UploadApiTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media = tempfile.mkdtemp()
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user = User.objects.create_user('up@example.com', PW, first_name='Up')
        self.client.force_authenticate(self.user)

    def test_post_media_html_is_rejected(self):
        res = self.client.post('/api/posts/', {
            'title': 'x', 'media': upload('evil.html', b'<script>alert(1)</script>', 'text/html'),
        }, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('media', res.data)
        self.assertFalse(Post.objects.exists())

    def test_post_media_image_is_stored_under_random_name(self):
        res = self.client.post('/api/posts/', {
            'title': 'x', 'media': upload('../../my photo.png', png_bytes(), 'image/png'),
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.data)
        name = Post.objects.get().media.name
        self.assertRegex(name, r'^post_media/[0-9a-f]{32}\.png$')

    def test_avatar_must_be_a_real_image(self):
        res = self.client.patch('/api/auth/me/', {'avatar': upload('me.png', b'GIF89a<script>')}, format='multipart')
        self.assertEqual(res.status_code, 400)
        res = self.client.patch('/api/auth/me/', {'avatar': upload('me.png', png_bytes())}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)

    def test_resume_rejects_svg(self):
        res = self.client.patch('/api/auth/me/', {
            'resume': upload('cv.svg', b'<svg onload="alert(1)"/>', 'image/svg+xml'),
        }, format='multipart')
        self.assertEqual(res.status_code, 400)
