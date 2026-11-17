from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('startups', '0005_phase6'),
    ]

    operations = [
        migrations.AddField(
            model_name='startup',
            name='trade_license',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='startup',
            name='tin_number',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='startup',
            name='review_status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('suspended', 'Suspended'),
                ],
                db_index=True,
                default='pending',
                max_length=10,
            ),
        ),
    ]
