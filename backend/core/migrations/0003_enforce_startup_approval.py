from django.db import migrations, models


def enforce_approval(apps, schema_editor):
    SiteSettings = apps.get_model('core', 'SiteSettings')
    SiteSettings.objects.all().update(require_startup_approval=True)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alter_sitesettings_require_startup_approval'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sitesettings',
            name='require_startup_approval',
            field=models.BooleanField(default=True, help_text='New startups stay hidden until an admin approves them.'),
        ),
        migrations.RunPython(enforce_approval, migrations.RunPython.noop),
    ]
