from django.contrib import admin
from .models import BuildGuide, BuildGuideStep, BuildSession, StepPhoto


class BuildGuideStepInline(admin.TabularInline):
    model = BuildGuideStep
    extra = 1
    ordering = ['order']


@admin.register(BuildGuide)
class BuildGuideAdmin(admin.ModelAdmin):
    list_display = ['pid', 'name', 'difficulty', 'drone_class', 'updated_at']
    list_filter = ['difficulty', 'drone_class']
    search_fields = ['name', 'pid']
    inlines = [BuildGuideStepInline]


@admin.register(BuildSession)
class BuildSessionAdmin(admin.ModelAdmin):
    list_display = ['serial_number', 'guide', 'builder_name', 'status', 'started_at']
    list_filter = ['status']
    search_fields = ['serial_number', 'builder_name']


@admin.register(StepPhoto)
class StepPhotoAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'step', 'captured_at']
    list_filter = ['captured_at']
