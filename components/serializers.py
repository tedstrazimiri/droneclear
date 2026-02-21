from rest_framework import serializers
from .models import Category, Component, DroneModel

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
