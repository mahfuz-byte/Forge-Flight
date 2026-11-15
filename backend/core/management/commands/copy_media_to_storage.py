"""Copy local uploads to cloud storage, preserving their database paths."""
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.core.files import File
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from accounts.models import User
from posts.models import Post
from startups.models import Document
from statistics_app.models import StartupStatisticsReport


FILE_FIELDS = (
    (User, 'avatar'),
    (User, 'resume'),
    (Post, 'media'),
    (Document, 'file'),
    (StartupStatisticsReport, 'file'),
)


class Command(BaseCommand):
    help = 'Copy all local media files from MEDIA_ROOT to Supabase Storage.'

    def add_arguments(self, parser):
        parser.add_argument('--source', default=str(settings.MEDIA_ROOT))
        parser.add_argument('--apply', action='store_true', help='Upload files; otherwise only report what would be copied.')

    def handle(self, *args, **options):
        if not settings.SUPABASE_S3_ENDPOINT:
            raise CommandError('Configure SUPABASE_S3_* before copying uploads.')
        source = Path(options['source']).resolve()
        if not source.is_dir():
            raise CommandError(f'Local media directory does not exist: {source}')

        referenced = set()
        for model, field in FILE_FIELDS:
            referenced.update(name for name in model.objects.exclude(**{field: ''}).values_list(field, flat=True) if name)
        names = referenced | {p.relative_to(source).as_posix() for p in source.rglob('*') if p.is_file()}

        copied = missing = existing = 0
        for name in sorted(names):
            parts = PurePosixPath(name).parts
            if not parts or name.startswith('/') or '..' in parts or '\\' in name:
                raise CommandError(f'Unsafe media path in database: {name}')
            local = (source / Path(*parts)).resolve()
            if not local.is_relative_to(source):
                raise CommandError(f'Media path leaves source directory: {name}')
            if default_storage.exists(name):
                existing += 1
                continue
            if not local.is_file():
                if name in referenced:
                    missing += 1
                    self.stderr.write(f'Missing local file referenced by the database: {name}')
                continue
            if options['apply']:
                with local.open('rb') as input_file:
                    saved_name = default_storage.save(name, File(input_file))
                if saved_name != name:
                    raise CommandError(f'Storage changed {name} to {saved_name}; stop and inspect the bucket.')
            copied += 1
            self.stdout.write(f'{"Copied" if options["apply"] else "Would copy"}: {name}')

        self.stdout.write(f'{copied} {"copied" if options["apply"] else "ready"}, {existing} already stored, {missing} missing locally.')
        if missing:
            raise CommandError('Some database-referenced files are missing; check them before deployment.')
