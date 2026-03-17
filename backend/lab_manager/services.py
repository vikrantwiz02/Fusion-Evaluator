import os
import ast

class ProjectEvaluatorService:
    def __init__(self, project_path, frontend_api_path=None):
        self.project_path = project_path
        self.frontend_api_path = frontend_api_path
        self.required_files = ['apps.py', 'admin.py', 'models.py', 'services.py', 'selectors.py']

    def check_file_existence(self):
        """Check for required files and api/ folder."""
        files_present = {}
        for file_name in self.required_files:
            file_path = os.path.join(self.project_path, file_name)
            files_present[file_name] = os.path.isfile(file_path)
            
        api_folder_path = os.path.join(self.project_path, 'api')
        files_present['api_folder'] = os.path.isdir(api_folder_path)
        
        return files_present

    def analyze_views(self):
        """Count and list functions in views.py."""
        views_path = os.path.join(self.project_path, 'api', 'views.py')
        function_metadata = []
        
        if os.path.isfile(views_path):
            with open(views_path, 'r', encoding='utf-8') as file:
                try:
                    tree = ast.parse(file.read())
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            function_metadata.append(node.name)
                        elif isinstance(node, ast.ClassDef):
                            # Also capture methods in class-based views
                            for class_node in node.body:
                                if isinstance(class_node, ast.FunctionDef):
                                    function_metadata.append(f"{node.name}.{class_node.name}")
                except SyntaxError:
                    pass # Handle syntax errors in student code
                    
        return function_metadata

    def analyze_urls(self):
        """List all API endpoints defined in api/urls.py."""
        urls_path = os.path.join(self.project_path, 'api', 'urls.py')
        api_endpoints = []
        
        if os.path.isfile(urls_path):
            with open(urls_path, 'r', encoding='utf-8') as file:
                try:
                    tree = ast.parse(file.read())
                    for node in ast.walk(tree):
                        # Very basic AST extraction for url patterns
                        if isinstance(node, ast.Call):
                            if isinstance(node.func, ast.Name) and node.func.id == 'path':
                                if node.args and isinstance(node.args[0], ast.Constant):
                                    api_endpoints.append(node.args[0].value)
                except SyntaxError:
                    pass
                    
        return api_endpoints

    def check_frontend_backend_sync(self, backend_endpoints):
        """Scan frontend api.js for Axios strings matching backend urls."""
        if not self.frontend_api_path or not os.path.isfile(self.frontend_api_path):
            return False
            
        sync_status = {}
        with open(self.frontend_api_path, 'r', encoding='utf-8') as file:
            content = file.read()
            # Simple check to find URLs in the frontend file
            for endpoint in backend_endpoints:
                sync_status[endpoint] = endpoint in content
                
        return sync_status

    def evaluate_project(self):
        """Run full evaluation."""
        files_present = self.check_file_existence()
        function_metadata = self.analyze_views()
        api_endpoints = self.analyze_urls()
        
        # Basic functionality check heuristic
        is_functional = all(files_present.values()) and len(function_metadata) > 0 and len(api_endpoints) > 0
        
        return {
            'files_present': files_present,
            'function_metadata': function_metadata,
            'api_endpoints': api_endpoints,
            'is_functional': is_functional
        }

def merge_assignment_groups(poor_pair_id, high_performing_pair_id):
    """Service to merge a poor performing pair with a high performing one."""
    from .models import AssignmentGroup
    
    try:
        poor_group = AssignmentGroup.objects.get(pair_id=poor_pair_id)
        high_group = AssignmentGroup.objects.get(pair_id=high_performing_pair_id)
        
        if poor_group.category != high_group.category:
            raise ValueError("Cannot merge pairs from different categories.")
            
        poor_group.is_merged = True
        poor_group.partner_pair_id = high_performing_pair_id
        poor_group.save()
        
        return True
    except AssignmentGroup.DoesNotExist:
        return False
