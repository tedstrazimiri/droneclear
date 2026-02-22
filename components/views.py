from rest_framework import viewsets
from django.db.models import Count
from .models import Category, Component, DroneModel
from .serializers import CategorySerializer, ComponentSerializer, DroneModelSerializer

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
    API endpoint to read and write the master drone_parts_schema_v2.json file.
    """
    def get_schema_path(self):
        return os.path.join(settings.BASE_DIR, 'drone_parts_schema_v2.json')

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
        
        with schema_lock:
            try:
                with open(schema_path, 'w', encoding='utf-8') as f:
                    json.dump(new_schema, f, indent=4)
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
