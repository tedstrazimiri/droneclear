from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.CharField(max_length=100, unique=True)
    
    def __str__(self):
        return self.name

class Component(models.Model):
    pid = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='components')
    name = models.CharField(max_length=255)
    manufacturer = models.CharField(max_length=255, default="Unknown", blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    link = models.URLField(max_length=500, blank=True, null=True)
    approx_price = models.CharField(max_length=100, blank=True, null=True)
    image_file = models.CharField(max_length=500, blank=True, null=True)
    manual_link = models.CharField(max_length=500, blank=True, null=True)
    
    # Store all dynamically variable data (Specs, Compatibility, Notes) here
    schema_data = models.JSONField(default=dict, blank=True)
    
    def __str__(self):
        return f"{self.pid} - {self.name}"

class DroneModel(models.Model):
    pid = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    image_file = models.CharField(max_length=255, blank=True, null=True)
    pdf_file = models.CharField(max_length=255, blank=True, null=True)
    vehicle_type = models.CharField(max_length=100, blank=True, null=True)
    build_class = models.CharField(max_length=100, blank=True, null=True)
    
    # Stores the relations object containing all the linked components
    relations = models.JSONField(default=dict, blank=True)
    
    def __str__(self):
        return f"{self.pid} - {self.name}"
