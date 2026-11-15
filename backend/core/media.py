import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.http import require_safe


@require_safe
def serve_media(request, path):
    """Stream files from the mounted persistent disk on Render."""
    root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (root / path).resolve()
    if not file_path.is_relative_to(root) or not file_path.is_file():
        raise Http404

    content_type = mimetypes.guess_type(file_path.name)[0] or 'application/octet-stream'
    inline = content_type.startswith('image/') or content_type == 'application/pdf'
    return FileResponse(
        file_path.open('rb'), content_type=content_type,
        as_attachment=not inline, filename=file_path.name,
    )
