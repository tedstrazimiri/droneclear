from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'components', views.ComponentViewSet, basename='component')
router.register(r'drone-models', views.DroneModelViewSet, basename='dronemodel')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/schema/', views.SchemaView.as_view(), name='schema-view'),
    path('api/maintenance/restart/', views.RestartServerView.as_view(), name='restart-server'),
    path('api/maintenance/bug-report/', views.BugReportView.as_view(), name='bug-report'),
]
