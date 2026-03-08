"""
tests.py — DroneClear test suite.

Covers: models, core CRUD API, import/export round-trip, build session
serial numbers & snapshots, build event immutability, schema validation,
photo SHA-256 integrity, and audit endpoint.
"""

import io
import json
import hashlib
import tempfile
from unittest.mock import patch

from PIL import Image

from django.db import IntegrityError
from django.db.models import ProtectedError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Category, Component, DroneModel,
    BuildGuide, BuildGuideStep, BuildSession, StepPhoto, BuildEvent,
    GuideMediaFile,
)


# ── Helpers ────────────────────────────────────────────────

def make_category(name='Motors', slug='motors'):
    return Category.objects.create(name=name, slug=slug)


def make_component(category, pid='MTR-0001', name='Test Motor', **kwargs):
    defaults = {
        'manufacturer': 'TestMfg',
        'schema_data': {'weight_g': 30, 'kv': 2400},
    }
    defaults.update(kwargs)
    return Component.objects.create(pid=pid, category=category, name=name, **defaults)


def make_guide(pid='BG-TEST-01', name='Test Guide', **kwargs):
    defaults = {
        'difficulty': 'beginner',
        'estimated_time_minutes': 60,
        'drone_class': '5inch',
        'required_tools': ['Soldering iron'],
        'settings': {'checklist_fields': ['manufacturer', 'weight']},
    }
    defaults.update(kwargs)
    return BuildGuide.objects.create(pid=pid, name=name, **defaults)


def make_step(guide, order=1, title='Step 1', **kwargs):
    defaults = {
        'description': 'Do the thing.',
        'step_type': 'assembly',
        'estimated_time_minutes': 5,
    }
    defaults.update(kwargs)
    return BuildGuideStep.objects.create(guide=guide, order=order, title=title, **defaults)


def make_test_image(width=100, height=100, color='red', fmt='PNG'):
    """Return an in-memory image file suitable for upload."""
    img = Image.new('RGB', (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    buf.name = 'test_photo.png'
    return buf


# =====================================================================
# Model Tests
# =====================================================================

class CategoryModelTests(TestCase):
    def test_str(self):
        cat = make_category()
        self.assertEqual(str(cat), 'Motors')

    def test_slug_unique(self):
        make_category(slug='motors')
        with self.assertRaises(Exception):
            make_category(name='Motors 2', slug='motors')

    def test_verbose_name_plural(self):
        self.assertEqual(Category._meta.verbose_name_plural, 'Categories')


class ComponentModelTests(TestCase):
    def test_str(self):
        cat = make_category()
        comp = make_component(cat)
        self.assertEqual(str(comp), 'MTR-0001 - Test Motor')

    def test_pid_unique(self):
        cat = make_category()
        make_component(cat, pid='MTR-0001')
        with self.assertRaises(Exception):
            make_component(cat, pid='MTR-0001', name='Duplicate')

    def test_schema_data_default(self):
        cat = make_category()
        comp = Component.objects.create(pid='X-001', category=cat, name='Bare')
        self.assertEqual(comp.schema_data, {})

    def test_cascade_delete_category(self):
        cat = make_category()
        make_component(cat)
        self.assertEqual(Component.objects.count(), 1)
        cat.delete()
        self.assertEqual(Component.objects.count(), 0)


class DroneModelTests(TestCase):
    def test_str(self):
        dm = DroneModel.objects.create(pid='DM-001', name='Freestyle 5"')
        self.assertEqual(str(dm), 'DM-001 - Freestyle 5"')

    def test_relations_default(self):
        dm = DroneModel.objects.create(pid='DM-002', name='Empty')
        self.assertEqual(dm.relations, {})


class BuildGuideModelTests(TestCase):
    def test_str(self):
        g = make_guide()
        self.assertEqual(str(g), 'BG-TEST-01 - Test Guide')

    def test_step_ordering(self):
        g = make_guide()
        make_step(g, order=3, title='Third')
        make_step(g, order=1, title='First')
        make_step(g, order=2, title='Second')
        titles = list(g.steps.values_list('title', flat=True))
        self.assertEqual(titles, ['First', 'Second', 'Third'])

    def test_step_unique_order_per_guide(self):
        g = make_guide()
        make_step(g, order=1)
        with self.assertRaises(Exception):
            make_step(g, order=1, title='Duplicate order')


class BuildSessionModelTests(TestCase):
    def test_str(self):
        g = make_guide()
        s = BuildSession.objects.create(serial_number='DC-20260306-0001', guide=g)
        self.assertIn('DC-20260306-0001', str(s))

    def test_status_default(self):
        g = make_guide()
        s = BuildSession.objects.create(serial_number='DC-TEST-0001', guide=g)
        self.assertEqual(s.status, 'in_progress')


class BuildEventModelTests(TestCase):
    def test_str(self):
        g = make_guide()
        s = BuildSession.objects.create(serial_number='DC-TEST-0001', guide=g)
        e = BuildEvent.objects.create(session=s, event_type='session_started')
        self.assertIn('session_started', str(e))

    def test_ordering_by_timestamp(self):
        g = make_guide()
        s = BuildSession.objects.create(serial_number='DC-TEST-0001', guide=g)
        BuildEvent.objects.create(session=s, event_type='session_started')
        BuildEvent.objects.create(session=s, event_type='step_started', step_order=1)
        events = list(BuildEvent.objects.filter(session=s).values_list('event_type', flat=True))
        self.assertEqual(events[0], 'session_started')


# =====================================================================
# Core CRUD API Tests
# =====================================================================

class CategoryAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_list_categories(self):
        make_category(name='Motors', slug='motors')
        make_category(name='ESCs', slug='escs')
        resp = self.client.get('/api/categories/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_category_count_annotation(self):
        cat = make_category()
        make_component(cat, pid='MTR-0001')
        make_component(cat, pid='MTR-0002', name='Motor 2')
        resp = self.client.get('/api/categories/')
        self.assertEqual(resp.status_code, 200)
        cat_data = resp.data[0]
        self.assertEqual(cat_data['count'], 2)

    def test_category_lookup_by_slug(self):
        make_category(name='Frames', slug='frames')
        resp = self.client.get('/api/categories/frames/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'Frames')


class ComponentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat = make_category()

    def test_create_component(self):
        resp = self.client.post('/api/components/', {
            'pid': 'MTR-NEW',
            'category': 'motors',
            'name': 'New Motor',
            'manufacturer': 'TestCo',
            'schema_data': {'kv': 1800},
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Component.objects.count(), 1)
        self.assertEqual(Component.objects.first().pid, 'MTR-NEW')

    def test_get_component_by_pid(self):
        make_component(self.cat, pid='MTR-0001')
        resp = self.client.get('/api/components/MTR-0001/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'Test Motor')

    def test_filter_by_category(self):
        cat2 = make_category(name='ESCs', slug='escs')
        make_component(self.cat, pid='MTR-0001')
        make_component(cat2, pid='ESC-0001', name='Test ESC')
        resp = self.client.get('/api/components/?category=motors')
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['pid'], 'MTR-0001')

    def test_batch_pid_filter(self):
        make_component(self.cat, pid='MTR-0001')
        make_component(self.cat, pid='MTR-0002', name='Motor 2')
        make_component(self.cat, pid='MTR-0003', name='Motor 3')
        resp = self.client.get('/api/components/?pids=MTR-0001,MTR-0003')
        self.assertEqual(len(resp.data), 2)
        pids = {c['pid'] for c in resp.data}
        self.assertEqual(pids, {'MTR-0001', 'MTR-0003'})

    def test_update_component(self):
        make_component(self.cat, pid='MTR-0001')
        resp = self.client.put('/api/components/MTR-0001/', {
            'pid': 'MTR-0001',
            'category': 'motors',
            'name': 'Updated Motor',
            'schema_data': {'kv': 2600},
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Component.objects.get(pid='MTR-0001').name, 'Updated Motor')

    def test_delete_component(self):
        make_component(self.cat, pid='MTR-0001')
        resp = self.client.delete('/api/components/MTR-0001/')
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(Component.objects.count(), 0)


class DroneModelAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_drone_model(self):
        resp = self.client.post('/api/drone-models/', {
            'pid': 'DM-001',
            'name': 'Freestyle 5"',
            'relations': {'motors': 'MTR-0001'},
        }, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_lookup_by_pid(self):
        DroneModel.objects.create(pid='DM-001', name='Test Build')
        resp = self.client.get('/api/drone-models/DM-001/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['name'], 'Test Build')


# =====================================================================
# Import / Export Round-Trip Tests
# =====================================================================

class ImportExportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.cat = make_category(name='Motors', slug='motors')

    def test_import_creates_components(self):
        parts = [
            {'pid': 'MTR-0001', 'category': 'motors', 'name': 'Motor A', 'manufacturer': 'BrandA', 'kv': 2400},
            {'pid': 'MTR-0002', 'category': 'motors', 'name': 'Motor B', 'manufacturer': 'BrandB', 'kv': 1800},
        ]
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 2)
        self.assertEqual(resp.data['updated'], 0)
        self.assertEqual(Component.objects.count(), 2)

    def test_import_upserts_existing(self):
        make_component(self.cat, pid='MTR-0001', name='Old Name')
        parts = [{'pid': 'MTR-0001', 'category': 'motors', 'name': 'New Name'}]
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.data['updated'], 1)
        self.assertEqual(Component.objects.get(pid='MTR-0001').name, 'New Name')

    def test_import_missing_required_fields(self):
        parts = [{'pid': 'MTR-0001'}]  # missing category and name
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.data['created'], 0)
        self.assertEqual(len(resp.data['errors']), 1)

    def test_import_missing_category(self):
        parts = [{'pid': 'MTR-0001', 'category': 'nonexistent', 'name': 'Motor'}]
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.data['created'], 0)
        self.assertIn('not found', resp.data['errors'][0]['error'])

    def test_import_rejects_non_list(self):
        resp = self.client.post('/api/import/parts/', {'not': 'a list'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_export_all(self):
        make_component(self.cat, pid='MTR-0001', name='Motor A')
        make_component(self.cat, pid='MTR-0002', name='Motor B')
        resp = self.client.get('/api/export/parts/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_export_by_category(self):
        cat2 = make_category(name='ESCs', slug='escs')
        make_component(self.cat, pid='MTR-0001')
        make_component(cat2, pid='ESC-0001', name='Test ESC')
        resp = self.client.get('/api/export/parts/?category=motors')
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['pid'], 'MTR-0001')

    def test_import_export_round_trip(self):
        """Import parts, export them, re-import — data should be stable."""
        original = [
            {
                'pid': 'MTR-0001', 'category': 'motors', 'name': 'Motor A',
                'manufacturer': 'BrandA', 'kv': 2400, 'weight_g': 30,
            },
        ]
        self.client.post('/api/import/parts/', original, format='json')

        # Export
        exported = self.client.get('/api/export/parts/').data
        self.assertEqual(len(exported), 1)
        self.assertEqual(exported[0]['pid'], 'MTR-0001')
        self.assertEqual(exported[0]['name'], 'Motor A')
        self.assertEqual(exported[0]['kv'], 2400)
        self.assertEqual(exported[0]['weight_g'], 30)

        # Re-import should upsert (0 created, 1 updated)
        resp = self.client.post('/api/import/parts/', exported, format='json')
        self.assertEqual(resp.data['updated'], 1)
        self.assertEqual(resp.data['created'], 0)


# =====================================================================
# Build Guide API Tests
# =====================================================================

class BuildGuideAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_create_guide_with_steps(self):
        resp = self.client.post('/api/build-guides/', {
            'pid': 'BG-001',
            'name': 'Test Guide',
            'difficulty': 'beginner',
            'estimated_time_minutes': 60,
            'drone_class': '5inch',
            'required_tools': ['Soldering iron'],
            'settings': {},
            'steps': [
                {'order': 1, 'title': 'Step 1', 'description': 'First step', 'step_type': 'assembly', 'estimated_time_minutes': 10},
                {'order': 2, 'title': 'Step 2', 'description': 'Second step', 'step_type': 'soldering', 'estimated_time_minutes': 15},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        guide = BuildGuide.objects.get(pid='BG-001')
        self.assertEqual(guide.steps.count(), 2)

    def test_list_guides(self):
        make_guide(pid='BG-001', name='Guide 1')
        make_guide(pid='BG-002', name='Guide 2')
        resp = self.client.get('/api/build-guides/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_detail_includes_steps(self):
        g = make_guide()
        make_step(g, order=1, title='First')
        make_step(g, order=2, title='Second')
        resp = self.client.get(f'/api/build-guides/{g.pid}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['steps']), 2)

    def test_update_guide_replaces_steps(self):
        g = make_guide()
        make_step(g, order=1, title='Old Step')
        self.assertEqual(g.steps.count(), 1)

        resp = self.client.put(f'/api/build-guides/{g.pid}/', {
            'pid': g.pid,
            'name': g.name,
            'difficulty': g.difficulty,
            'estimated_time_minutes': g.estimated_time_minutes,
            'settings': g.settings,
            'required_tools': g.required_tools,
            'steps': [
                {'order': 1, 'title': 'New Step A', 'description': 'A', 'step_type': 'assembly', 'estimated_time_minutes': 5},
                {'order': 2, 'title': 'New Step B', 'description': 'B', 'step_type': 'firmware', 'estimated_time_minutes': 10},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        g.refresh_from_db()
        self.assertEqual(g.steps.count(), 2)
        self.assertEqual(list(g.steps.values_list('title', flat=True)), ['New Step A', 'New Step B'])

    def test_guide_with_drone_model_pid(self):
        dm = DroneModel.objects.create(pid='DM-001', name='Test Build')
        resp = self.client.post('/api/build-guides/', {
            'pid': 'BG-DM',
            'name': 'Linked Guide',
            'difficulty': 'intermediate',
            'estimated_time_minutes': 90,
            'drone_model_pid': 'DM-001',
            'required_tools': [],
            'settings': {},
            'steps': [],
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        guide = BuildGuide.objects.get(pid='BG-DM')
        self.assertEqual(guide.drone_model, dm)


# =====================================================================
# Build Session & Serial Number Tests
# =====================================================================

class BuildSessionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        make_step(self.guide, order=1, title='Step 1')

    def test_create_session_generates_serial(self):
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        sn = resp.data['serial_number']
        self.assertTrue(sn.startswith('DC-'))
        self.assertEqual(len(sn.split('-')), 3)  # DC-YYYYMMDD-NNNN

    def test_serial_number_increments(self):
        resp1 = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        resp2 = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        sn1 = resp1.data['serial_number']
        sn2 = resp2.data['serial_number']
        seq1 = int(sn1.split('-')[-1])
        seq2 = int(sn2.split('-')[-1])
        self.assertEqual(seq2, seq1 + 1)

    def test_session_creates_guide_snapshot(self):
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        session = BuildSession.objects.get(serial_number=resp.data['serial_number'])
        self.assertIn('pid', session.guide_snapshot)
        self.assertEqual(session.guide_snapshot['pid'], self.guide.pid)
        self.assertIn('steps', session.guide_snapshot)

    def test_session_creates_component_snapshot(self):
        cat = make_category(name='Frames', slug='frames')
        comp = make_component(cat, pid='FRM-0001', name='Test Frame')
        step = self.guide.steps.first()
        step.required_components = ['FRM-0001']
        step.save()

        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        session = BuildSession.objects.get(serial_number=resp.data['serial_number'])
        self.assertIn('FRM-0001', session.component_snapshot)
        self.assertEqual(session.component_snapshot['FRM-0001']['name'], 'Test Frame')

    def test_session_emits_session_started_event(self):
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        session = BuildSession.objects.get(serial_number=resp.data['serial_number'])
        events = BuildEvent.objects.filter(session=session)
        self.assertEqual(events.count(), 1)
        self.assertEqual(events.first().event_type, 'session_started')

    def test_patch_session(self):
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid,
            'builder_name': 'Tester',
        }, format='json')
        sn = resp.data['serial_number']
        patch_resp = self.client.patch(f'/api/build-sessions/{sn}/', {
            'current_step': 3,
            'status': 'completed',
            'step_notes': {'1': 'Went well'},
        }, format='json')
        self.assertEqual(patch_resp.status_code, 200)
        session = BuildSession.objects.get(serial_number=sn)
        self.assertEqual(session.current_step, 3)
        self.assertEqual(session.status, 'completed')
        self.assertEqual(session.step_notes['1'], 'Went well')

    def test_filter_by_status(self):
        self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'A',
        }, format='json')
        resp2 = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'B',
        }, format='json')
        # Complete the second session
        sn2 = resp2.data['serial_number']
        self.client.patch(f'/api/build-sessions/{sn2}/', {'status': 'completed'}, format='json')

        resp = self.client.get('/api/build-sessions/?status=completed')
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['serial_number'], sn2)

    def test_snapshots_are_read_only(self):
        """guide_snapshot and component_snapshot cannot be overwritten via PATCH."""
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Tester',
        }, format='json')
        sn = resp.data['serial_number']
        original_snapshot = BuildSession.objects.get(serial_number=sn).guide_snapshot

        self.client.patch(f'/api/build-sessions/{sn}/', {
            'guide_snapshot': {'hacked': True},
        }, format='json')
        session = BuildSession.objects.get(serial_number=sn)
        self.assertEqual(session.guide_snapshot, original_snapshot)


# =====================================================================
# Build Event Tests (Append-Only Immutability)
# =====================================================================

class BuildEventAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        make_step(self.guide, order=1)
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Tester',
        }, format='json')
        self.sn = resp.data['serial_number']

    def test_post_event(self):
        resp = self.client.post(f'/api/build-sessions/{self.sn}/events/', {
            'event_type': 'step_started',
            'step_order': 1,
            'data': {'from_step': 0},
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['event_type'], 'step_started')

    def test_list_events(self):
        self.client.post(f'/api/build-sessions/{self.sn}/events/', {
            'event_type': 'step_started', 'step_order': 1,
        }, format='json')
        resp = self.client.get(f'/api/build-sessions/{self.sn}/events/')
        self.assertEqual(resp.status_code, 200)
        # session_started (auto) + step_started (manual)
        self.assertEqual(len(resp.data), 2)

    def test_invalid_event_type_rejected(self):
        resp = self.client.post(f'/api/build-sessions/{self.sn}/events/', {
            'event_type': 'hacked_event',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_no_put_on_events(self):
        """Events endpoint should not support PUT (no update)."""
        resp = self.client.put(f'/api/build-sessions/{self.sn}/events/', {
            'event_type': 'step_started',
        }, format='json')
        self.assertEqual(resp.status_code, 405)

    def test_no_delete_on_events(self):
        """Events endpoint should not support DELETE."""
        resp = self.client.delete(f'/api/build-sessions/{self.sn}/events/')
        self.assertEqual(resp.status_code, 405)

    def test_event_for_nonexistent_session(self):
        resp = self.client.post('/api/build-sessions/DC-FAKE-9999/events/', {
            'event_type': 'step_started',
        }, format='json')
        self.assertEqual(resp.status_code, 404)


# =====================================================================
# Photo Upload & SHA-256 Integrity Tests
# =====================================================================

TEMP_MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class PhotoUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        self.step = make_step(self.guide, order=1)
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Tester',
        }, format='json')
        self.sn = resp.data['serial_number']

    def test_upload_photo(self):
        img = make_test_image()
        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
            'image': img,
            'notes': 'Test photo',
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertIn('sha256', resp.data)
        self.assertEqual(len(resp.data['sha256']), 64)

    def test_sha256_matches_file_content(self):
        img = make_test_image()
        raw_bytes = img.read()
        expected_hash = hashlib.sha256(raw_bytes).hexdigest()
        img.seek(0)

        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
            'image': img,
        }, format='multipart')
        self.assertEqual(resp.data['sha256'], expected_hash)

    def test_photo_creates_event(self):
        img = make_test_image()
        self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
            'image': img,
        }, format='multipart')
        session = BuildSession.objects.get(serial_number=self.sn)
        photo_events = BuildEvent.objects.filter(session=session, event_type='photo_captured')
        self.assertEqual(photo_events.count(), 1)
        self.assertIn('sha256', photo_events.first().data)

    def test_upload_missing_step(self):
        img = make_test_image()
        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'image': img,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_upload_missing_image(self):
        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_list_photos(self):
        img = make_test_image()
        self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id, 'image': img,
        }, format='multipart')
        resp = self.client.get(f'/api/build-sessions/{self.sn}/photos/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)


# =====================================================================
# Schema Validation Tests
# =====================================================================

class SchemaAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.valid_schema = {
            'schema_version': '3.0',
            'components': {
                'motors': [{'pid': 'MTR-0001', 'name': 'Example Motor'}],
            },
        }

    @patch('components.views.SchemaView.get_schema_path')
    def test_get_schema(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.valid_schema, f)
            f.flush()
            mock_path.return_value = f.name
        resp = self.client.get('/api/schema/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['schema_version'], '3.0')

    @patch('components.views.SchemaView.get_schema_path')
    def test_save_valid_schema(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            mock_path.return_value = f.name
        resp = self.client.post('/api/schema/', self.valid_schema, format='json')
        self.assertEqual(resp.status_code, 200)

    def test_reject_non_object_schema(self):
        with patch('components.views.SchemaView.get_schema_path'):
            resp = self.client.post('/api/schema/', [1, 2, 3], format='json')
            self.assertEqual(resp.status_code, 400)

    @patch('components.views.SchemaView.get_schema_path')
    def test_reject_missing_schema_version(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            mock_path.return_value = f.name
        resp = self.client.post('/api/schema/', {
            'components': {'motors': [{'pid': 'X'}]},
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('schema_version', str(resp.data['errors']))

    @patch('components.views.SchemaView.get_schema_path')
    def test_reject_missing_components(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            mock_path.return_value = f.name
        resp = self.client.post('/api/schema/', {
            'schema_version': '3.0',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('components.views.SchemaView.get_schema_path')
    def test_reject_empty_category(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            mock_path.return_value = f.name
        resp = self.client.post('/api/schema/', {
            'schema_version': '3.0',
            'components': {'motors': []},
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('components.views.SchemaView.get_schema_path')
    def test_reject_non_array_category(self, mock_path):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            mock_path.return_value = f.name
        resp = self.client.post('/api/schema/', {
            'schema_version': '3.0',
            'components': {'motors': 'not an array'},
        }, format='json')
        self.assertEqual(resp.status_code, 400)


# =====================================================================
# Build Audit Endpoint Tests
# =====================================================================

@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class BuildAuditAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        self.step = make_step(self.guide, order=1)
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Auditor',
        }, format='json')
        self.sn = resp.data['serial_number']

    def test_audit_endpoint_returns_full_record(self):
        # Add an event
        self.client.post(f'/api/build-sessions/{self.sn}/events/', {
            'event_type': 'step_started', 'step_order': 1,
        }, format='json')

        resp = self.client.get(f'/api/audit/{self.sn}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.data
        self.assertEqual(data['serial_number'], self.sn)
        self.assertEqual(data['builder_name'], 'Auditor')
        self.assertIn('guide_snapshot', data)
        self.assertIn('component_snapshot', data)
        self.assertIn('events', data)
        self.assertIn('photos', data)
        # session_started (auto) + step_started (manual) = 2 events
        self.assertEqual(len(data['events']), 2)

    def test_audit_nonexistent_session(self):
        resp = self.client.get('/api/audit/DC-FAKE-9999/')
        self.assertEqual(resp.status_code, 404)

    def test_audit_with_photo(self):
        img = make_test_image()
        self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id, 'image': img,
        }, format='multipart')

        resp = self.client.get(f'/api/audit/{self.sn}/')
        self.assertEqual(len(resp.data['photos']), 1)
        photo = resp.data['photos'][0]
        self.assertEqual(photo['step_order'], 1)
        self.assertEqual(len(photo['sha256']), 64)

    def test_audit_snapshot_immutable_after_guide_edit(self):
        """Editing the guide after session start should not affect the audit snapshot."""
        session = BuildSession.objects.get(serial_number=self.sn)
        original_guide_name = session.guide_snapshot['name']

        # Edit the guide
        self.guide.name = 'Completely Changed Name'
        self.guide.save()

        # Audit should still show the original name
        resp = self.client.get(f'/api/audit/{self.sn}/')
        self.assertEqual(resp.data['guide_snapshot']['name'], original_guide_name)


# =====================================================================
# Maintenance Endpoint Tests
# =====================================================================

class MaintenanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_bug_report(self):
        resp = self.client.post('/api/maintenance/bug-report/', {
            'title': 'Test Bug',
            'description': 'Something broke',
            'logs': 'Error at line 42',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertIn('file', resp.data)


# =====================================================================
# Data Integrity Tests (BUG-001 through BUG-004)
# =====================================================================

@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class GuideUpdatePreservesPhotosTests(TestCase):
    """BUG-001: Editing a guide must not cascade-delete session photos."""

    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        self.step = make_step(self.guide, order=1, title='Original Step')
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Tester',
        }, format='json')
        self.sn = resp.data['serial_number']
        # Upload a photo to step 1
        img = make_test_image()
        self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id, 'image': img,
        }, format='multipart')
        self.assertEqual(StepPhoto.objects.count(), 1)

    def test_guide_update_preserves_photos(self):
        """Photos survive when guide steps are edited."""
        self.client.put(f'/api/build-guides/{self.guide.pid}/', {
            'pid': self.guide.pid,
            'name': self.guide.name,
            'difficulty': self.guide.difficulty,
            'estimated_time_minutes': self.guide.estimated_time_minutes,
            'settings': self.guide.settings,
            'required_tools': self.guide.required_tools,
            'steps': [
                {'order': 1, 'title': 'Updated Step', 'description': 'Changed', 'step_type': 'assembly', 'estimated_time_minutes': 5},
                {'order': 2, 'title': 'New Step', 'description': 'Added', 'step_type': 'firmware', 'estimated_time_minutes': 10},
            ],
        }, format='json')
        # Photo must still exist (step FK set to NULL, not cascade-deleted)
        self.assertEqual(StepPhoto.objects.count(), 1)
        photo = StepPhoto.objects.first()
        self.assertEqual(photo.session.serial_number, self.sn)

    def test_step_delete_nullifies_photo_fk(self):
        """Deleting a step sets StepPhoto.step to NULL instead of deleting the photo."""
        self.client.put(f'/api/build-guides/{self.guide.pid}/', {
            'pid': self.guide.pid,
            'name': self.guide.name,
            'difficulty': self.guide.difficulty,
            'estimated_time_minutes': self.guide.estimated_time_minutes,
            'settings': self.guide.settings,
            'required_tools': self.guide.required_tools,
            'steps': [
                {'order': 2, 'title': 'Replacement', 'description': 'Only step', 'step_type': 'assembly', 'estimated_time_minutes': 5},
            ],
        }, format='json')
        photo = StepPhoto.objects.first()
        self.assertIsNone(photo.step)

    def test_update_in_place_preserves_step_ids(self):
        """Updating an existing step order reuses the step record."""
        original_step_id = self.step.id
        self.client.put(f'/api/build-guides/{self.guide.pid}/', {
            'pid': self.guide.pid,
            'name': self.guide.name,
            'difficulty': self.guide.difficulty,
            'estimated_time_minutes': self.guide.estimated_time_minutes,
            'settings': self.guide.settings,
            'required_tools': self.guide.required_tools,
            'steps': [
                {'order': 1, 'title': 'Updated Title', 'description': 'Updated', 'step_type': 'assembly', 'estimated_time_minutes': 5},
            ],
        }, format='json')
        step = BuildGuideStep.objects.get(guide=self.guide, order=1)
        self.assertEqual(step.id, original_step_id)
        self.assertEqual(step.title, 'Updated Title')


class BuildEventProtectTests(TestCase):
    """BUG-003: BuildEvent PROTECT prevents session deletion when events exist."""

    def setUp(self):
        self.guide = make_guide()
        self.session = BuildSession.objects.create(
            serial_number='DC-TEST-PROTECT', guide=self.guide,
        )
        BuildEvent.objects.create(
            session=self.session, event_type='session_started',
        )

    def test_cannot_delete_session_with_events(self):
        """Deleting a session that has audit events raises ProtectedError."""
        with self.assertRaises(ProtectedError):
            self.session.delete()

    def test_can_delete_session_after_events_removed(self):
        """Session can be deleted once all events are explicitly removed."""
        BuildEvent.objects.filter(session=self.session).delete()
        self.session.delete()
        self.assertEqual(BuildSession.objects.filter(serial_number='DC-TEST-PROTECT').count(), 0)

    def test_guide_deletion_preserves_sessions(self):
        """Deleting a guide sets session.guide to NULL, preserving the session and its audit trail."""
        self.guide.delete()
        self.session.refresh_from_db()
        self.assertIsNone(self.session.guide)
        self.assertEqual(BuildEvent.objects.filter(session=self.session).count(), 1)


class SerialNumberAtomicityTests(TestCase):
    """BUG-002: Serial number generation uses select_for_update within a transaction."""

    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        make_step(self.guide, order=1)

    def test_serial_numbers_unique_sequential(self):
        """Multiple rapid session creates produce unique sequential serial numbers."""
        serial_numbers = []
        for _ in range(5):
            resp = self.client.post('/api/build-sessions/', {
                'guide': self.guide.pid, 'builder_name': 'Racer',
            }, format='json')
            self.assertEqual(resp.status_code, 201)
            serial_numbers.append(resp.data['serial_number'])

        # All unique
        self.assertEqual(len(set(serial_numbers)), 5)
        # Sequential
        seqs = [int(sn.split('-')[-1]) for sn in serial_numbers]
        self.assertEqual(seqs, list(range(1, 6)))

    def test_session_and_event_created_atomically(self):
        """Session creation and session_started event are in the same transaction."""
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Atomic',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        session = BuildSession.objects.get(serial_number=resp.data['serial_number'])
        events = BuildEvent.objects.filter(session=session, event_type='session_started')
        self.assertEqual(events.count(), 1)


class ImportPartsTransactionTests(TestCase):
    """BUG-004: ImportPartsView uses per-item savepoints."""

    def setUp(self):
        self.client = APIClient()
        self.cat = make_category()

    def test_valid_items_persist_despite_later_errors(self):
        """Good items are committed even if later items have errors."""
        parts = [
            {'pid': 'MTR-0001', 'category': 'motors', 'name': 'Good Motor'},
            {'pid': 'MTR-0002', 'category': 'nonexistent', 'name': 'Bad Motor'},
            {'pid': 'MTR-0003', 'category': 'motors', 'name': 'Another Good Motor'},
        ]
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.data['created'], 2)
        self.assertEqual(len(resp.data['errors']), 1)
        self.assertEqual(Component.objects.count(), 2)

    def test_single_item_failure_does_not_corrupt_others(self):
        """A database-level error on one item doesn't roll back others."""
        make_component(self.cat, pid='MTR-EXIST', name='Existing')
        parts = [
            {'pid': 'MTR-NEW', 'category': 'motors', 'name': 'New Motor'},
            {'pid': 'MTR-EXIST', 'category': 'motors', 'name': 'Updated Existing'},
        ]
        resp = self.client.post('/api/import/parts/', parts, format='json')
        self.assertEqual(resp.data['created'], 1)
        self.assertEqual(resp.data['updated'], 1)
        self.assertEqual(Component.objects.count(), 2)


# =====================================================================
# Guide Media Upload Tests (FEAT-007)
# =====================================================================

@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class GuideMediaUploadTests(TestCase):
    """FEAT-007: Direct file upload for guide step media."""

    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()

    def test_upload_image_success(self):
        """Valid image upload returns URL, type, filename, and creates DB record."""
        img = make_test_image()
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
            'guide_pid': self.guide.pid,
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertIn('url', resp.data)
        self.assertEqual(resp.data['type'], 'image')
        self.assertEqual(resp.data['filename'], 'test_photo.png')
        self.assertIn('id', resp.data)
        # DB record created
        self.assertEqual(GuideMediaFile.objects.count(), 1)
        media = GuideMediaFile.objects.first()
        self.assertEqual(media.guide, self.guide)
        self.assertEqual(media.media_type, 'image')
        self.assertEqual(media.original_filename, 'test_photo.png')

    def test_upload_no_file_rejected(self):
        resp = self.client.post('/api/guide-media/upload/', {
            'guide_pid': self.guide.pid,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.data)

    def test_upload_no_guide_pid_rejected(self):
        img = make_test_image()
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('guide_pid', resp.data['error'].lower())

    def test_upload_invalid_guide_rejected(self):
        img = make_test_image()
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
            'guide_pid': 'NONEXISTENT',
        }, format='multipart')
        self.assertEqual(resp.status_code, 404)

    def test_upload_disallowed_mime_rejected(self):
        """Non-image/video MIME types should be rejected."""
        buf = io.BytesIO(b'not a real image')
        buf.name = 'malicious.exe'
        resp = self.client.post('/api/guide-media/upload/', {
            'file': buf,
            'guide_pid': self.guide.pid,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(GuideMediaFile.objects.count(), 0)

    def test_upload_path_traversal_prevented(self):
        """Uploaded files use UUID filenames — original name never used in path."""
        img = make_test_image()
        img.name = '../../etc/passwd.png'
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
            'guide_pid': self.guide.pid,
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertNotIn('passwd', resp.data['url'])
        self.assertNotIn('..', resp.data['url'])

    def test_upload_compartmentalized_by_guide(self):
        """File URL contains the guide PID for compartmentalization."""
        img = make_test_image()
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
            'guide_pid': self.guide.pid,
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertIn(self.guide.pid, resp.data['url'])

    def test_uploaded_file_exists_on_disk(self):
        """The file should actually be written to disk."""
        img = make_test_image()
        resp = self.client.post('/api/guide-media/upload/', {
            'file': img,
            'guide_pid': self.guide.pid,
        }, format='multipart')
        media = GuideMediaFile.objects.first()
        self.assertTrue(media.file.storage.exists(media.file.name))


# =====================================================================
# StepPhoto Validation Tests (SEC-003 fix)
# =====================================================================

@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class StepPhotoValidationTests(TestCase):
    """SEC-003: StepPhotoUploadView now validates uploaded files."""

    def setUp(self):
        self.client = APIClient()
        self.guide = make_guide()
        self.step = make_step(self.guide, order=1)
        resp = self.client.post('/api/build-sessions/', {
            'guide': self.guide.pid, 'builder_name': 'Tester',
        }, format='json')
        self.sn = resp.data['serial_number']

    def test_step_photo_rejects_non_image(self):
        """Non-image files should be rejected by the step photo endpoint."""
        buf = io.BytesIO(b'this is not an image')
        buf.name = 'fake.txt'
        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
            'image': buf,
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(StepPhoto.objects.count(), 0)

    def test_step_photo_accepts_valid_image(self):
        """Valid images should still be accepted after adding validation."""
        img = make_test_image()
        resp = self.client.post(f'/api/build-sessions/{self.sn}/photos/', {
            'step': self.step.id,
            'image': img,
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(StepPhoto.objects.count(), 1)
