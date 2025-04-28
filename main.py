import flask
import functions_framework
from looker_ca_analyzer import analyze_lookml

@functions_framework.http
def hello(request: flask.Request) -> flask.typing.ResponseReturnValue:
    """HTTP Cloud Function that analyzes Looker LookML for Conversational Analytics readiness.
    
    Args:
        request (flask.Request): The request object.
        {
            "model_name": "your_model_name",
            "explore_name": "your_explore_name",
            "user_description": "your_user_description",
            "common_questions": "your_common_questions",
            "user_goals": "your_user_goals"
        }
    Returns:
        Analysis results as JSON
    """
    # Get parameters from request
    request_json = request.get_json(silent=True)
    
    if not request_json:
        return {"error": "No JSON data in request"}, 400
        
    model_name = request_json.get("model_name")
    explore_name = request_json.get("explore_name")
    user_description = request_json.get("user_description")
    common_questions = request_json.get("common_questions")
    user_goals = request_json.get("user_goals")
    
    if not model_name or not explore_name:
        return {"error": "Missing required parameters: model_name and explore_name"}, 400
    
    # Analyze the LookML
    result = analyze_lookml(
        explore_name=explore_name,
        model_name=model_name,
        user_description=user_description,
        common_questions=common_questions,
        user_goals=user_goals
    )
    
    return result 