from rest_framework import serializers
from .models import Category, Component, DroneModel, BuildGuide, BuildGuideStep, BuildSession, StepPhoto

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
            'reference_image', 'stl_file', 'betaflight_cli', 'step_type',
            'estimated_time_minutes', 'required_components',
        ]


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
    drone_model = serializers.SlugRelatedField(
        slug_field='pid', queryset=DroneModel.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = BuildGuide
        fields = [
            'pid', 'name', 'description', 'difficulty', 'estimated_time_minutes',
            'drone_class', 'thumbnail', 'drone_model', 'required_tools',
            'settings', 'created_at', 'updated_at', 'steps',
        ]

    def create(self, validated_data):
        steps_data = validated_data.pop('steps', [])
        guide = BuildGuide.objects.create(**validated_data)
        for step_data in steps_data:
            BuildGuideStep.objects.create(guide=guide, **step_data)
        return guide

    def update(self, instance, validated_data):
        steps_data = validated_data.pop('steps', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if steps_data is not None:
            # Replace all steps with the new set
            instance.steps.all().delete()
            for step_data in steps_data:
                BuildGuideStep.objects.create(guide=instance, **step_data)

        return instance


class StepPhotoSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = StepPhoto
        fields = ['id', 'step', 'image', 'image_url', 'captured_at', 'notes']

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
            'current_step', 'status', 'notes', 'component_checklist',
            'builder_name', 'photos',
        ]
        read_only_fields = ['serial_number', 'started_at']
