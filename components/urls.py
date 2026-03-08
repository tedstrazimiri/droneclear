from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet, basename='category')
router.register(r'components', views.ComponentViewSet, basename='component')
router.register(r'drone-models', views.DroneModelViewSet, basename='dronemodel')
router.register(r'build-guides', views.BuildGuideViewSet, basename='buildguide')
router.register(r'build-sessions', views.BuildSessionViewSet, basename='buildsession')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/schema/', views.SchemaView.as_view(), name='schema-view'),
    path('api/import/parts/', views.ImportPartsView.as_view(), name='import-parts'),
    path('api/export/parts/', views.ExportPartsView.as_view(), name='export-parts'),
    path('api/maintenance/restart/', views.RestartServerView.as_view(), name='restart-server'),
    path('api/maintenance/bug-report/', views.BugReportView.as_view(), name='bug-report'),
    path('api/maintenance/reset-to-golden/', views.ResetToGoldenView.as_view(), name='reset-to-golden'),
    path('api/maintenance/reset-to-examples/', views.ResetToExamplesView.as_view(), name='reset-to-examples'),
    path('api/guide-media/upload/', views.GuideMediaUploadView.as_view(), name='guide-media-upload'),
    path('api/build-sessions/<str:sn>/photos/', views.StepPhotoUploadView.as_view(), name='session-photos'),
    path('api/build-sessions/<str:sn>/events/', views.BuildEventView.as_view(), name='session-events'),
    path('api/audit/<str:sn>/', views.BuildAuditView.as_view(), name='build-audit'),
]
