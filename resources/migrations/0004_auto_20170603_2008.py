# -*- coding: utf-8 -*-
# Generated by Django 1.11.2 on 2017-06-04 03:08
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0003_auto_20170603_1957'),
    ]

    operations = [
        migrations.AlterField(
            model_name='asset',
            name='mesh',
            field=models.FileField(upload_to=b'meshes'),
        ),
    ]
