"""
serializers.py — DRF serializers for all DroneClear models.

Note: CategorySerializer.count requires the queryset to have
annotate(count=Count('components')) applied (done in CategoryViewSet).
"""

from django.db import transaction
from rest_framework import serializers
from .models import Category, Component, DroneModel, BuildGuide, BuildGuideStep, BuildSession, StepPhoto


# ── Core Model Serializers ──────────────────────────────────

class ComponentSerializer(serializers.ModelSerializer):
    # Allow writing components by category slug
    category = serializers.SlugRelatedField(slug_field='slug', queryset=Category.objects.all())

    class Meta:
        model = Component
        fields = ['pid', 'category', 'name', 'manufacturer', 'description', 'link', 'approx_price', 'image_file', 'manual_link', 'schema_data']

class CategorySerializer(serializers.ModelSerializer):
    count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Category
        fields = ['slug', 'name', 'count']

class DroneModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = DroneModel
        fields = ['pid', 'name', 'description', 'image_file', 'pdf_file', 'vehicle_type', 'build_class', 'relations']


# ---------------------------------------------------------------------------
# Build Guide serializers
# ---------------------------------------------------------------------------

class BuildGuideStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = BuildGuideStep
        fields = [
            'id', 'order', 'title', 'description', 'safety_warning',
            'media', 'stl_file', 'betaflight_cli', 'step_type',
            'estimated_time_minutes', 'required_components',
        ]
        extra_kwargs = {
            'title': {'required': False, 'allow_blank': True, 'default': 'Untitled'},
            'description': {'required': False, 'allow_blank': True, 'default': ''},
        }


class BuildGuideListSerializer(serializers.ModelSerializer):
    step_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BuildGuide
        fields = [
            'pid', 'name', 'description', 'difficulty', 'estimated_time_minutes',
            'drone_class', 'thumbnail', 'required_tools', 'step_count',
            'created_at', 'updated_at',
        ]


class BuildGuideDetailSerializer(serializers.ModelSerializer):
    steps = BuildGuideStepSerializer(many=True)
    # Read: full nested drone model (includes relations with part PIDs)
    drone_model = DroneModelSerializer(read_only=True)
    # Write: accept drone model PID string
    drone_model_pid = serializers.SlugRelatedField(
        slug_field='pid', queryset=DroneModel.objects.all(),
        required=False, allow_null=True, source='drone_model',
        write_only=True,
    )

    class Meta:
        model = BuildGuide
        fields = [
            'pid', 'name', 'description', 'difficulty', 'estimated_time_minutes',
            'drone_class', 'thumbnail', 'drone_model', 'drone_model_pid',
            'required_tools', 'settings', 'created_at', 'updated_at', 'steps',
        ]

    def create(self, validated_data):
        steps_data = validated_data.pop('steps', [])
        guide = BuildGuide.objects.create(**validated_data)
        for step_data in steps_data:
            BuildGuideStep.objects.create(guide=guide, **step_data)
        return guide

    @transaction.atomic
    def update(self, instance, validated_data):
        steps_data = validated_data.pop('steps', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if steps_data is not None:
            existing_steps = {s.order: s for s in instance.steps.all()}
            incoming_orders = set()

            for step_data in steps_data:
                order = step_data.get('order')
                incoming_orders.add(order)

                if order in existing_steps:
                    step = existing_steps[order]
                    for attr, value in step_data.items():
                        setattr(step, attr, value)
                    step.save()
                else:
                    BuildGuideStep.objects.create(guide=instance, **step_data)

            # Remove steps no longer present (photos survive via SET_NULL)
            removed_orders = set(existing_steps.keys()) - incoming_orders
            if removed_orders:
                instance.steps.filter(order__in=removed_orders).delete()

        return instance


class StepPhotoSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = StepPhoto
        fields = ['id', 'step', 'image', 'image_url', 'captured_at', 'notes', 'sha256']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None


class BuildSessionSerializer(serializers.ModelSerializer):
    photos = StepPhotoSerializer(many=True, read_only=True)
    guide = serializers.SlugRelatedField(slug_field='pid', queryset=BuildGuide.objects.all())

    class Meta:
        model = BuildSession
        fields = [
            'serial_number', 'guide', 'started_at', 'completed_at',
            'current_step', 'status', 'notes', 'step_notes',
            'component_checklist', 'builder_name', 'photos',
            'step_timing', 'guide_snapshot', 'component_snapshot',
        ]
        read_only_fields = ['serial_number', 'started_at', 'guide_snapshot', 'component_snapshot']
