"""Upload safety (SEC-06).

Every user-supplied file goes through an allowlist: the extension must be on
the list for that upload kind, the file's first bytes must match that type's
real signature, and the size must be under the kind's limit. Anything else
(HTML, SVG, scripts, executables, archives, renamed files) is rejected.

Stored names are random UUIDs so an upload can never choose its own path,
overwrite another file, or carry a misleading name.
"""
import os
import uuid
import zipfile

from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible

MB = 1024 * 1024

# --- signatures -------------------------------------------------------------

_OLE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'  # legacy .doc/.xls/.ppt container
_ZIP = b'PK\x03\x04'                         # .docx/.xlsx/.pptx container


def _is_jpeg(h):
    return h.startswith(b'\xff\xd8\xff')


def _is_png(h):
    return h.startswith(b'\x89PNG\r\n\x1a\n')


def _is_gif(h):
    return h[:6] in (b'GIF87a', b'GIF89a')


def _is_webp(h):
    return h[:4] == b'RIFF' and h[8:12] == b'WEBP'


def _is_pdf(h):
    return h.startswith(b'%PDF-')


def _is_iso_media(h):  # mp4 / mov / m4v
    return h[4:8] == b'ftyp'


def _is_webm(h):
    return h.startswith(b'\x1a\x45\xdf\xa3')


def _is_ole(h):
    return h.startswith(_OLE)


def _is_zip(h):
    return h.startswith(_ZIP)


SIGNATURES = {
    'jpg': _is_jpeg, 'jpeg': _is_jpeg, 'png': _is_png, 'gif': _is_gif, 'webp': _is_webp,
    'mp4': _is_iso_media, 'mov': _is_iso_media, 'm4v': _is_iso_media, 'webm': _is_webm,
    'pdf': _is_pdf,
    'doc': _is_ole, 'xls': _is_ole, 'ppt': _is_ole,
    'docx': _is_zip, 'xlsx': _is_zip, 'pptx': _is_zip,
}

IMAGE_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
VIDEO_EXTS = {'mp4', 'mov', 'm4v', 'webm'}
DOCUMENT_EXTS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}

# Office Open XML parts that must be present / must never be present.
_OOXML_REQUIRED = '[Content_Types].xml'
_OOXML_MACRO_MARKERS = ('vbaproject.bin', 'vbadata.xml')


def _extension(name):
    return os.path.splitext(name or '')[1].lower().lstrip('.')


def _read_head(f, n=64):
    pos = f.tell() if hasattr(f, 'tell') else 0
    f.seek(0)
    head = f.read(n)
    f.seek(pos)
    return head


def _check_ooxml(f):
    pos = f.tell()
    f.seek(0)
    try:
        with zipfile.ZipFile(f) as zf:
            names = [n.lower() for n in zf.namelist()]
    except zipfile.BadZipFile:
        raise ValidationError('This document is damaged or not a real Office file.')
    finally:
        f.seek(pos)
    if _OOXML_REQUIRED.lower() not in names:
        raise ValidationError('This document is not a real Office file.')
    if any(n.endswith(m) for n in names for m in _OOXML_MACRO_MARKERS):
        raise ValidationError('Documents containing macros are not allowed.')


def _check_image(f):
    from PIL import Image

    pos = f.tell()
    f.seek(0)
    try:
        with Image.open(f) as img:
            img.verify()  # parses the whole file; raises on corrupt or bomb images
    except Exception:
        raise ValidationError('This image is damaged or not a supported image.')
    finally:
        f.seek(pos)


@deconstructible
class FileTypeValidator:
    """Validate an upload against an extension allowlist, its magic bytes and a size cap."""

    def __init__(self, allowed, max_bytes, label='file'):
        self.allowed = frozenset(allowed)
        self.max_bytes = max_bytes
        self.label = label

    def __call__(self, f):
        # A file already in storage (e.g. the admin re-validating an unchanged
        # model) was checked when it was uploaded.
        if getattr(f, '_committed', False):
            return
        ext = _extension(f.name)
        if ext not in self.allowed:
            allowed = ', '.join(sorted(self.allowed))
            raise ValidationError(f'Unsupported {self.label} type. Allowed: {allowed}.')
        size = getattr(f, 'size', None)
        if size is not None and size > self.max_bytes:
            raise ValidationError(f'{self.label.capitalize()} is too large (max {self.max_bytes // MB} MB).')
        if size == 0:
            raise ValidationError(f'The {self.label} is empty.')
        if not SIGNATURES[ext](_read_head(f)):
            raise ValidationError(f'The file content does not match its .{ext} extension.')
        if ext in IMAGE_EXTS:
            _check_image(f)
        elif ext in ('docx', 'xlsx', 'pptx'):
            _check_ooxml(f)

    def __eq__(self, other):
        return (
            isinstance(other, FileTypeValidator)
            and self.allowed == other.allowed
            and self.max_bytes == other.max_bytes
            and self.label == other.label
        )


@deconstructible
class RandomFilename:
    """``upload_to`` that stores files as ``<folder>/<uuid>.<ext>``."""

    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = _extension(filename)
        name = uuid.uuid4().hex + (f'.{ext}' if ext in SIGNATURES else '')
        return f'{self.folder}/{name}'

    def __eq__(self, other):
        return isinstance(other, RandomFilename) and self.folder == other.folder


validate_avatar = FileTypeValidator(IMAGE_EXTS, 5 * MB, 'image')
validate_resume = FileTypeValidator({'pdf', 'doc', 'docx'}, 10 * MB, 'resume')
validate_post_media = FileTypeValidator(IMAGE_EXTS | VIDEO_EXTS | DOCUMENT_EXTS, 50 * MB, 'attachment')
validate_startup_document = FileTypeValidator(DOCUMENT_EXTS | IMAGE_EXTS, 20 * MB, 'document')
