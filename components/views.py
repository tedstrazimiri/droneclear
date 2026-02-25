from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Count
from django.utils import timezone
from .models import Category, Component, DroneModel, BuildGuide, BuildGuideStep, BuildSession, StepPhoto
from .serializers import (
    CategorySerializer, ComponentSerializer, DroneModelSerializer,
    BuildGuideListSerializer, BuildGuideDetailSerializer,
    BuildSessionSerializer, StepPhotoSerializer,
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(count=Count('components')).order_by('name')
    serializer_class = CategorySerializer
    lookup_field = 'slug'

class ComponentViewSet(viewsets.ModelViewSet):
    serializer_class = ComponentSerializer
    lookup_field = 'pid'

    def get_queryset(self):
        queryset = Component.objects.all()
        category_slug = self.request.query_params.get('category', None)
        if category_slug is not None:
            queryset = queryset.filter(category__slug=category_slug)
        return queryset

class DroneModelViewSet(viewsets.ModelViewSet):
    queryset = DroneModel.objects.all()
    serializer_class = DroneModelSerializer
    lookup_field = 'pid'

import os
import json
import threading
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

# Basic lock to prevent concurrent read/writes to the singular json file
schema_lock = threading.Lock()

class SchemaView(APIView):
    """
    API endpoint to read and write the master drone_parts_schema_v3.json file.
    """
    def get_schema_path(self):
        return os.path.join(settings.BASE_DIR, 'drone_parts_schema_v3.json')

    def get(self, request):
        schema_path = self.get_schema_path()
        if not os.path.exists(schema_path):
            return Response({"error": "Schema file not found."}, status=status.HTTP_404_NOT_FOUND)

        with schema_lock:
            try:
                with open(schema_path, 'r', encoding='utf-8') as f:
                    schema_data = json.load(f)
                return Response(schema_data)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        schema_path = self.get_schema_path()
        new_schema = request.data

        # Validate basic schema structure before saving
        errors = []
        if not isinstance(new_schema, dict):
            errors.append("Schema must be a JSON object.")
        else:
            if 'schema_version' not in new_schema:
                errors.append("Missing 'schema_version' key.")
            if 'components' not in new_schema:
                errors.append("Missing 'components' key.")
            elif not isinstance(new_schema['components'], dict):
                errors.append("'components' must be an object.")
            else:
                for cat_name, cat_items in new_schema['components'].items():
                    if not isinstance(cat_items, list):
                        errors.append(f"Category '{cat_name}' must be an array.")
                    elif len(cat_items) == 0:
                        errors.append(f"Category '{cat_name}' must have at least one template entry.")
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        with schema_lock:
            try:
                with open(schema_path, 'w', encoding='utf-8') as f:
                    json.dump(new_schema, f, indent=2)
                return Response({"message": "Schema updated successfully."})
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import datetime
class RestartServerView(APIView):
    """
    Touches wsgi.py to force a runserver restart.
    """
    def post(self, request):
        try:
            wsgi_path = os.path.join(settings.BASE_DIR, 'droneclear_backend', 'wsgi.py')
            if os.path.exists(wsgi_path):
                os.utime(wsgi_path, None)
                return Response({"status": "Restarting server..."}, status=status.HTTP_200_OK)
            return Response({"error": "wsgi.py not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class BugReportView(APIView):
    """
    Saves a bug report to the bug_reports directory.
    """
    def post(self, request):
        try:
            title = request.data.get('title', 'Untitled Bug')
            description = request.data.get('description', '')
            logs = request.data.get('logs', '')

            reports_dir = os.path.join(settings.BASE_DIR, 'bug_reports')
            os.makedirs(reports_dir, exist_ok=True)

            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"bug_{timestamp}.txt"
            filepath = os.path.join(reports_dir, filename)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"Title: {title}\n")
                f.write(f"Time: {timestamp}\n")
                f.write(f"Description:\n{description}\n\n")
                if logs:
                    f.write(f"Logs:\n{logs}\n")

            return Response({"status": "Bug report saved", "file": filename}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ImportPartsView(APIView):
    """
    POST /api/import/parts/
    Accepts a JSON array of parts. Upserts by PID.
    Returns { created: N, updated: N, errors: [...] }
    """
    def post(self, request):
        parts = request.data
        if not isinstance(parts, list):
            return Response({"error": "Request body must be a JSON array of parts."},
                            status=status.HTTP_400_BAD_REQUEST)

        created = 0
        updated = 0
        errors = []

        for i, part in enumerate(parts):
            pid = part.get('pid')
            category_slug = part.get('category')
            name = part.get('name')

            if not pid or not category_slug or not name:
                errors.append({"index": i, "pid": pid, "error": "Missing required field: pid, category, or name."})
                continue

            try:
                category = Category.objects.get(slug=category_slug)
            except Category.DoesNotExist:
                errors.append({"index": i, "pid": pid, "error": f"Category '{category_slug}' not found."})
                continue

            # Extract core fields, everything else goes to schema_data
            core_keys = {'pid', 'category', 'name', 'manufacturer', 'description',
                         'link', 'approx_price', 'image_file', 'manual_link'}
            schema_data = {k: v for k, v in part.items() if k not in core_keys}

            defaults = {
                'category': category,
                'name': name,
                'manufacturer': part.get('manufacturer', 'Unknown'),
                'description': part.get('description', ''),
                'link': part.get('link', ''),
                'approx_price': part.get('approx_price', ''),
                'image_file': part.get('image_file', ''),
                'manual_link': part.get('manual_link', ''),
                'schema_data': schema_data,
            }

            try:
                obj, was_created = Component.objects.update_or_create(pid=pid, defaults=defaults)
                if was_created:
                    created += 1
                else:
                    updated += 1
            except Exception as e:
                errors.append({"index": i, "pid": pid, "error": str(e)})

        return Response({"created": created, "updated": updated, "errors": errors},
                        status=status.HTTP_200_OK)


class ExportPartsView(APIView):
    """
    GET /api/export/parts/
    Exports all parts (or ?category=slug) in re-importable JSON format.
    """
    def get(self, request):
        category_slug = request.query_params.get('category', None)
        queryset = Component.objects.select_related('category').all()
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        parts = []
        for comp in queryset:
            part = {
                'pid': comp.pid,
                'category': comp.category.slug,
                'name': comp.name,
                'manufacturer': comp.manufacturer,
                'description': comp.description,
                'link': comp.link,
                'approx_price': comp.approx_price,
                'image_file': comp.image_file,
                'manual_link': comp.manual_link,
            }
            # Merge schema_data fields at top level for flat import format
            if comp.schema_data:
                part.update(comp.schema_data)
            parts.append(part)

        return Response(parts, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Build Guide views
# ---------------------------------------------------------------------------

class BuildGuideViewSet(viewsets.ModelViewSet):
    """CRUD for build guides. List uses lightweight serializer; detail includes nested steps."""
    lookup_field = 'pid'

    def get_queryset(self):
        return BuildGuide.objects.annotate(step_count=Count('steps')).order_by('-updated_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return BuildGuideListSerializer
        return BuildGuideDetailSerializer


class BuildSessionViewSet(viewsets.ModelViewSet):
    """CRUD for build sessions. Serial number auto-generated on create."""
    serializer_class = BuildSessionSerializer
    lookup_field = 'serial_number'

    def get_queryset(self):
        qs = BuildSession.objects.select_related('guide').prefetch_related('photos').order_by('-started_at')
        guide_pid = self.request.query_params.get('guide', None)
        if guide_pid:
            qs = qs.filter(guide__pid=guide_pid)
        return qs

    def perform_create(self, serializer):
        today = timezone.now().strftime('%Y%m%d')
        prefix = f'DC-{today}-'
        last = (
            BuildSession.objects
            .filter(serial_number__startswith=prefix)
            .order_by('-serial_number')
            .first()
        )
        seq = 1
        if last:
            try:
                seq = int(last.serial_number.split('-')[-1]) + 1
            except ValueError:
                seq = 1
        sn = f'{prefix}{seq:04d}'
        serializer.save(serial_number=sn)


class StepPhotoUploadView(APIView):
    """
    GET  /api/build-sessions/<sn>/photos/  → list photos for session
    POST /api/build-sessions/<sn>/photos/  → upload a photo
    """
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, sn):
        try:
            session = BuildSession.objects.get(serial_number=sn)
        except BuildSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        photos = StepPhoto.objects.filter(session=session).order_by('captured_at')
        serializer = StepPhotoSerializer(photos, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, sn):
        try:
            session = BuildSession.objects.get(serial_number=sn)
        except BuildSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        step_id = request.data.get('step')
        image = request.FILES.get('image')
        notes = request.data.get('notes', '')

        if not step_id or not image:
            return Response({'error': 'step and image are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            step = BuildGuideStep.objects.get(id=step_id, guide=session.guide)
        except BuildGuideStep.DoesNotExist:
            return Response({'error': 'Step not found in this guide'}, status=status.HTTP_404_NOT_FOUND)

        photo = StepPhoto.objects.create(session=session, step=step, image=image, notes=notes)
        serializer = StepPhotoSerializer(photo, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
