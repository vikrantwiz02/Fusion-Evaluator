from djongo import models
from django.contrib.auth.models import User

class CategoryChoices(models.TextChoices):
    CONVENTIONAL = 'CONV', 'Conventional'
    AI = 'AI', 'AI'

class Module(models.Model):
    name = models.CharField(max_length=255)
    week_num = models.IntegerField()
    assigned_leads = models.JSONField(default=list)

    def __str__(self):
        return f"{self.name} (Week {self.week_num})"

class AssignmentGroup(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='assignment_groups')
    category = models.CharField(max_length=4, choices=CategoryChoices.choices)
    pair_id = models.CharField(max_length=50)
    is_merged = models.BooleanField(default=False)
    partner_pair_id = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"Group {self.pair_id} - {self.category}"

class EvaluationDetail(models.Model):
    assignment_group = models.OneToOneField(AssignmentGroup, on_delete=models.CASCADE, related_name='evaluation')
    files_present = models.JSONField(default=dict) # e.g., {"models.py": True}
    function_metadata = models.JSONField(default=list) # List of function names
    api_endpoints = models.JSONField(default=list) # List of routes
    is_functional = models.BooleanField(default=False)

    def __str__(self):
        return f"Eval for {self.assignment_group.pair_id}"
