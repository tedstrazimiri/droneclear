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


# =====================================================================
# Build Guide Models — Step-by-step drone assembly workflow
# =====================================================================

class BuildGuide(models.Model):
    """A predefined assembly guide template."""
    DIFFICULTY_CHOICES = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
    ]

    pid = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='beginner')
    estimated_time_minutes = models.IntegerField(default=60)
    drone_class = models.CharField(max_length=50, blank=True)
    thumbnail = models.CharField(max_length=500, blank=True)
    drone_model = models.ForeignKey(
        DroneModel, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='guides'
    )
    required_tools = models.JSONField(default=list, blank=True)
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.pid} - {self.name}"


class BuildGuideStep(models.Model):
    """Individual step in a build guide."""
    STEP_TYPE_CHOICES = [
        ('assembly', 'Assembly'),
        ('soldering', 'Soldering'),
        ('firmware', 'Firmware'),
        ('3d_print', '3D Print'),
        ('inspection', 'Inspection'),
    ]

    guide = models.ForeignKey(BuildGuide, related_name='steps', on_delete=models.CASCADE)
    order = models.IntegerField()
    title = models.CharField(max_length=255)
    description = models.TextField()
    safety_warning = models.TextField(blank=True)
    reference_image = models.CharField(max_length=500, blank=True)
    stl_file = models.CharField(max_length=500, blank=True)
    betaflight_cli = models.TextField(blank=True)
    step_type = models.CharField(max_length=50, choices=STEP_TYPE_CHOICES, default='assembly')
    estimated_time_minutes = models.IntegerField(default=5)
    required_components = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['order']
        unique_together = ['guide', 'order']

    def __str__(self):
        return f"Step {self.order}: {self.title}"


class BuildSession(models.Model):
    """An active or completed build session with serial number tracking."""
    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]

    serial_number = models.CharField(max_length=50, unique=True)
    guide = models.ForeignKey(BuildGuide, on_delete=models.CASCADE, related_name='sessions')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    current_step = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    notes = models.TextField(blank=True)
    component_checklist = models.JSONField(default=dict, blank=True)
    builder_name = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.serial_number} ({self.status})"


class StepPhoto(models.Model):
    """Photo captured at a build step — for audit trail and CV training."""
    session = models.ForeignKey(BuildSession, related_name='photos', on_delete=models.CASCADE)
    step = models.ForeignKey(BuildGuideStep, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='build_photos/%Y/%m/%d/')
    captured_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Photo for {self.session.serial_number} step {self.step.order}"
