from google.cloud import secretmanager
import os
import looker_sdk
import configparser
import vertexai
from vertexai.generative_models import GenerativeModel, Part, FinishReason
import vertexai.preview.generative_models as generative_models
import sys
import json
import time
import collections
import typing
import textwrap
import re
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configuration constants
LOOKER_PROJECT_ID = "joey-looker"
LOOKER_SECRET_NAME = "looker_ini"
LOOKER_SECRET_VERSION = "latest"
VERTEX_PROJECT_ID = "joey-looker"
VERTEX_LOCATION = "us-central1"
GEMINI_MODEL_NAME = "gemini-2.5-pro-exp-03-25"
API_CALL_DELAY = 1
TOP_N_FIELDS = 15
AGENT_INSTRUCTION_TOP_FIELDS = 5
CA_SUFFIX = "_ca"

# Source weights for different query types
SOURCE_WEIGHTS = {
    "explore": 3.0,
    "drill_modal": 3.0,
    "suggest": 2.0,
    "merge_query": 2.0,
    "api": 1.5,
    "sql_runner": 3.0,
    "dashboard": 1.0,
    "look": 1.0,
    "scheduled_task": 0.5,
    "cache": 0.0,
    "embed": 1.0,
}
DEFAULT_WEIGHT = 0.5

def get_looker_config_from_secret_manager(project_id, secret_name, version):
    """Fetches Looker config from Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    secret_id = f"projects/{project_id}/secrets/{secret_name}/versions/{version}"
    response = client.access_secret_version(request={"name": secret_id})
    secret_string = response.payload.data.decode("UTF-8")
    
    config = configparser.ConfigParser()
    config.read_string(secret_string)
    
    if 'Looker' not in config or not all(k in config['Looker'] for k in ['base_url', 'client_id', 'client_secret']):
        raise ValueError(f"Missing required keys in [Looker] section of the secret.")
    
    return config['Looker']

def initialize_looker_sdk(config):
    """Initializes the Looker SDK using config."""
    os.environ["LOOKERSDK_BASE_URL"] = config['base_url']
    os.environ["LOOKERSDK_CLIENT_ID"] = config['client_id']
    os.environ["LOOKERSDK_CLIENT_SECRET"] = config['client_secret']
    os.environ["LOOKERSDK_VERIFY_SSL"] = config.get('verify_ssl', "true").lower()
    os.environ["LOOKERSDK_TIMEOUT"] = config.get('timeout', "120")
    
    sdk = looker_sdk.init40()
    return sdk

def initialize_vertex_ai(project_id, location):
    """Initializes Vertex AI."""
    vertexai.init(project=project_id, location=location)
    return GenerativeModel(GEMINI_MODEL_NAME)

def generate_gemini_prompt(model_name, explore_name, explore_lookml_json):
    """Generates a prompt for Gemini to analyze LookML explore definition for CA readiness."""
    prompt = f"""
You are an expert LookML developer optimizing Looker Explores specifically for Looker's Conversational Analytics feature (Gemini in Looker). This feature translates natural language questions into Looker API queries based on LookML metadata (fields, labels, descriptions) and data values. Your goal is to evaluate the provided Explore definition for CA readiness and suggest actionable improvements based on CA best practices.

**Analyze the following LookML Explore definition:**

* **Model:** `{model_name}`
* **Explore:** `{explore_name}`

**Explore Definition (JSON representation from Looker SDK):**
```json
{explore_lookml_json}
```

**Analysis Task:**

Evaluate the readiness of this Explore for Conversational Analytics, focusing on common pitfalls and best practices:

1.  **Clarity for Natural Language:**
    * **Labels:** Are field `label` values clear, concise, business-friendly, and unambiguous? Do they reflect terms users would naturally use? Suggest improved labels where needed.
    * **Descriptions:** Are `description` attributes thorough and helpful? **Descriptions are CRITICAL for CA.** They should define the field, provide business context, list synonyms or common terms users might use for this field, and explain calculations if applicable. Identify fields lacking good descriptions or needing more detail/synonyms for CA.
    * **Naming Conflicts:** Are there fields with similar names or labels that could cause ambiguity for CA when mapping user questions? Suggest specific ways to resolve ambiguity (e.g., better labels/descriptions, hiding one field).

2.  **Field Curation:**
    * **Field Bloat:** Does the explore expose too many fields? Are technical fields (Primary Keys, Foreign Keys, intermediate calculations) potentially visible and not hidden?
    * **Relevance:** Are the exposed fields relevant for typical conversational questions users might ask of this data? Suggest hiding fields that are irrelevant for conversational use (`hidden: yes`).

3.  **Structure & Simplicity:**
    * **Joins:** Are the joins relatively simple and logical? Highly complex joins can hinder CA performance. Note if joins seem overly complex.
    * **Group Labels:** Are fields logically grouped using `group_label` or `group_item_label` for better organization in the UI, which aids discoverability? Suggest adding group labels where appropriate.

4.  **Data Representation:**
    * **Data Types:** Are field types (`type`) appropriate for the data (e.g., number, date_*, string, yesno)?
    * **Persistent Logic:** Is essential business logic (commonly found in dashboard table calculations or custom fields) defined persistently within LookML dimensions or measures so CA can access it? Identify potential opportunities to convert such logic.

**Output Requirements:**

Provide your analysis in the following structured format using these exact Markdown headers:

### GRADE
Assign an overall readiness grade from 0 (Not Ready) to 100 (Excellent). **Output only the integer number.**

### RATIONALE
Briefly explain the reasoning behind the grade, highlighting key strengths and weaknesses based on the CA best practices above (especially description quality, labeling, field curation, and clarity).

### RECOMMENDATIONS
Provide a numbered list of specific, actionable recommendations focused on improving this explore *for Conversational Analytics*. Prioritize high-impact changes. Be specific about *which* view/field needs changing and *what* change is needed.

### GENERATED LOOKML SUGGESTIONS
Provide 1-2 concise LookML code snippets demonstrating *how* to implement a key recommendation, focusing on adding descriptions or labels.
"""
    return prompt

def analyze_with_gemini(model, prompt, model_name, explore_name):
    """Sends a prompt to the Gemini model and returns the response text."""
    try:
        # Configure safety settings and generation parameters
        generation_config = generative_models.GenerationConfig(
            max_output_tokens=8192,
            temperature=0.2,
            top_p=0.95,
            top_k=40
        )
        safety_settings = {
            generative_models.HarmCategory.HARM_CATEGORY_HATE_SPEECH: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_HARASSMENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }

        response = model.generate_content(
            [prompt],
            generation_config=generation_config,
            safety_settings=safety_settings,
            stream=False,
        )

        if not response.candidates:
            return "Error: No response candidates returned by Gemini."

        candidate = response.candidates[0]

        if candidate.finish_reason != FinishReason.STOP:
            finish_reason_name = candidate.finish_reason.name
            if candidate.finish_reason == FinishReason.SAFETY:
                return f"Error: Gemini response blocked due to safety filters."
            elif candidate.finish_reason == FinishReason.MAX_TOKENS:
                if candidate.content and candidate.content.parts:
                    return f"Warning: Response truncated (MAX_TOKENS). Analysis might be incomplete.\n\n{candidate.content.parts[0].text}"
                else:
                    return "Error: Response truncated (MAX_TOKENS) and no content returned."
            else:
                return f"Error: Gemini generation stopped unexpectedly ({finish_reason_name})."

        if not candidate.content or not candidate.content.parts:
            return f"Error: No text content found in Gemini response."

        return candidate.content.parts[0].text

    except Exception as e:
        return f"Error: Unexpected error during Gemini analysis: {str(e)}"

def fetch_and_process_history(sdk, weights: dict, default_weight: float):
    """Fetches Looker history data via API and processes it to calculate weighted field usage."""
    print("Fetching and processing history data via Looker API...")

    # Define the parameters for the inline query based on the provided URL
    model_name = "system__activity"
    explore_name = "history" # Use explore name as 'view' for run_inline_query
    fields = [
        "query.view",             # Explore name used in the query
        "history.query_run_count",# Number of times the query ran
        "query.model",            # Model name used
        "query.fields",           # List of fields used (view_name.field_name)
        "history.source",         # Source of the query (dashboard, explore, etc.)
        "user.count"              # *** ADDED user.count field ***
    ]
    filters = {
        "history.created_date": "90 days",       # Filter for the last 90 days
        "query.model": "-NULL,-system__activity" # Exclude NULL models and system__activity itself
    }
    sorts = ["history.query_run_count desc"] # Sort by run count descending
    limit = "5000" # API expects limit as string

    # Construct the query body as a dictionary
    query_body_dict = {
        "model": model_name,
        "view": explore_name,
        "fields": fields,
        "filters": filters,
        "sorts": sorts,
        "limit": limit
    }

    # Execute the inline query
    try:
        print(f"Running inline query on {model_name}/{explore_name}...")
        response_json_str = sdk.run_inline_query(result_format="json", body=query_body_dict)
        history_data = json.loads(response_json_str)
        print(f"Successfully fetched {len(history_data)} history records via API.")
    except Exception as e:
        print(f"ERROR: Failed to fetch history data: {e}")
        return None

    # Process the fetched data
    usage_scores = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(float)))
    processed_records = 0
    skipped_records = 0

    for record in history_data:
        processed_records += 1
        model = record.get("query.model")
        explore = record.get("query.view")
        fields_str = record.get("query.fields")
        source = record.get("history.source")
        run_count = record.get("history.query_run_count", 0)
        user_count = record.get("user.count", 0)

        if not model or not explore or run_count == 0 or user_count == 0:
            skipped_records += 1
            continue

        # Parse fields list
        try:
            fields_list = json.loads(fields_str) if isinstance(fields_str, str) else fields_str
            if not isinstance(fields_list, list):
                skipped_records += 1
                continue
        except:
            skipped_records += 1
            continue

        # Calculate weighted score
        weight = weights.get(source, default_weight) if source else default_weight
        query_score = float(run_count) * float(user_count) * weight

        # Add score to each field
        for field in fields_list:
            if isinstance(field, str) and field:
                usage_scores[model][explore][field] += query_score

    print(f"Processed {processed_records} records ({skipped_records} skipped)")
    return usage_scores

def generate_synonyms(field_part: str, label: str) -> list:
    """Generates potential synonyms based on field name and label."""
    words = set()
    # Split field name by underscore
    for word in field_part.split('_'):
        if len(word) > 2 and word not in ['id', 'pk', 'fk', 'key', 'date', 'time', 'ts', 'at', 'count', 'sum', 'avg', 'min', 'max', 'p50', 'p90', 'p99']:
            words.add(word.lower())
    # Split label by space
    if label:
        for word in label.split(' '):
            cleaned_word = re.sub(r'[^\w]', '', word)
            if len(cleaned_word) > 2:
                words.add(cleaned_word.lower())

    return sorted(list(words))

def generate_agent_instructions(top_used_fields: list, recommendations: list, user_description: str = None, common_questions: str = None, user_goals: str = None) -> list:
    """Generates suggested agent instructions based on analysis results and user input."""
    instructions = []

    if user_description:
        instructions.append(f"User Description: {user_description}")
    if common_questions:
        instructions.append(f"Common Questions: {common_questions}")
    if user_goals:
        instructions.append(f"User Goals: {user_goals}")

    if top_used_fields:
        top_field_names = [field_data[0] for field_data in top_used_fields[:AGENT_INSTRUCTION_TOP_FIELDS]]
        if top_field_names:
            instructions.append(f"Most Common Fields: {', '.join(top_field_names)}")

    if not instructions:
        instructions.append("No specific agent instructions generated automatically. Review recommendations and top fields manually.")

    return instructions

def generate_ca_lookml_file_content(explore_key: str, parsed_data: dict, explore_definition_json: str) -> str:
    """Generates the content for a LookML file containing CA-specific extended views and explore."""
    model_name, explore_name = explore_key.split('/', 1)
    lines = []
    indent = "  "
    ca_explore_name = explore_name + CA_SUFFIX

    # Header Comments
    lines.append(f"# LookML File for CA-Optimized Explore: {explore_key}")
    lines.append(f"# Generated by Conversational Readiness Analyzer")
    lines.append("#")
    lines.append("# Purpose: This file defines extended Views and a new Explore based on")
    lines.append(f"#          '{explore_name}', curated for Conversational Analytics (CA).")
    lines.append("#")
    lines.append("# Instructions:")
    lines.append("# 1. Save this file in your LookML project")
    lines.append("# 2. Replace 'CONNECTION_NAME_PLACEHOLDER' with your actual connection name")
    lines.append("# 3. Verify the 'include:' paths point correctly to your original view files")
    lines.append("# 4. Review and refine the auto-generated labels and descriptions")
    lines.append("")

    # Basic Configuration
    lines.append('connection: "CONNECTION_NAME_PLACEHOLDER"')
    
    # Parse explore definition
    try:
        explore_def = json.loads(explore_definition_json)
        base_view = explore_def.get('view_name')
        joins = explore_def.get('joins', [])
    except:
        explore_def = {}
        base_view = None
        joins = []

    # Extended Views
    if base_view:
        lines.append(f"\nview: {base_view}{CA_SUFFIX} extends: [{base_view}] {{")
        lines.append(f"{indent}# Add CA-specific refinements here")
        lines.append("}")

    # Extended Explore
    lines.append(f"\nexplore: {ca_explore_name} {{")
    if base_view:
        lines.append(f"{indent}from: {base_view}{CA_SUFFIX}")
    
    # Add joins
    for join in joins:
        join_view = join.get('name')
        if join_view:
            lines.append(f"\n{indent}join: {join_view}{CA_SUFFIX} {{")
            lines.append(f"{indent}{indent}from: {join_view}{CA_SUFFIX}")
            if join.get('type'): lines.append(f"{indent}{indent}type: {join['type']}")
            if join.get('relationship'): lines.append(f"{indent}{indent}relationship: {join['relationship']}")
            if join.get('sql_on'): lines.append(f"{indent}{indent}sql_on: {join['sql_on']} ;;")
            lines.append(f"{indent}}}")

    lines.append("}")

    return "\n".join(lines)

def analyze_lookml(explore_name, model_name=None, user_description=None, common_questions=None, user_goals=None):
    """Main function to analyze LookML for CA readiness."""
    try:
        # Initialize services
        looker_config = get_looker_config_from_secret_manager(
            LOOKER_PROJECT_ID, LOOKER_SECRET_NAME, LOOKER_SECRET_VERSION
        )
        sdk = initialize_looker_sdk(looker_config)
        gemini_model = initialize_vertex_ai(VERTEX_PROJECT_ID, VERTEX_LOCATION)
        
        # Get explore details
        explore_details = sdk.lookml_model_explore(
            lookml_model_name=model_name,
            explore_name=explore_name,
            fields="name,label,description,hidden,group_label,view_name,joins,fields"
        )
        
        # Convert explore_details to a dictionary before serializing
        explore_dict = {
            "name": explore_details.name,
            "label": explore_details.label,
            "description": explore_details.description,
            "hidden": explore_details.hidden,
            "group_label": explore_details.group_label,
            "view_name": explore_details.view_name,
            "joins": [{"name": j.name, "type": j.type, "relationship": j.relationship, "sql_on": j.sql_on} for j in explore_details.joins] if explore_details.joins else [],
            "fields": {
                "dimensions": [{"name": f.name, "label": f.label, "description": f.description} for f in explore_details.fields.dimensions] if explore_details.fields.dimensions else [],
                "measures": [{"name": f.name, "label": f.label, "description": f.description} for f in explore_details.fields.measures] if explore_details.fields.measures else [],
                "filters": [{"name": f.name, "label": f.label, "description": f.description} for f in explore_details.fields.filters] if explore_details.fields.filters else []
            }
        }
        explore_definition_json = json.dumps(explore_dict)
        
        # Get field usage history
        history_scores = fetch_and_process_history(sdk, SOURCE_WEIGHTS, DEFAULT_WEIGHT)
        explore_usage_scores = history_scores.get(model_name, {}).get(explore_name, {})
        sorted_fields = sorted(explore_usage_scores.items(), key=lambda item: item[1], reverse=True)
        top_fields = [[field, round(score, 2)] for field, score in sorted_fields[:TOP_N_FIELDS]]
        
        # Generate analysis using Gemini
        prompt = generate_gemini_prompt(model_name, explore_name, explore_definition_json)
        analysis = analyze_with_gemini(gemini_model, prompt, model_name, explore_name)
        
        # Parse the analysis results
        result = {
            "status": "success",
            "model_name": model_name,
            "explore_name": explore_name,
            "raw_analysis": analysis,
            "top_used_fields": top_fields
        }
        
        # Try to parse structured sections if analysis was successful
        if not analysis.startswith("Error:"):
            try:
                sections = analysis.split("###")
                for section in sections:
                    if section.strip().startswith("GRADE"):
                        grade = int(section.split("\n")[1].strip())
                        result["grade"] = grade
                    elif section.strip().startswith("RATIONALE"):
                        rationale = section.split("\n", 1)[1].strip()
                        # Make rationale concise: use only the first sentence
                        concise_rationale = rationale.split('. ')[0] + ('.' if '.' in rationale else '')
                        result["rationale"] = concise_rationale
                    elif section.strip().startswith("RECOMMENDATIONS"):
                        recs = section.split("\n", 1)[1].strip()
                        # Make recommendations short and actionable (first sentence or imperative phrase)
                        short_recs = []
                        for r in recs.split("\n"):
                            r = r.strip().lstrip('0123456789. ')
                            if r:
                                short_recs.append(r.split('. ')[0] + ('.' if '.' in r else ''))
                        result["recommendations"] = short_recs
                    elif section.strip().startswith("GENERATED LOOKML SUGGESTIONS"):
                        lookml = section.split("\n", 1)[1].strip()
                        result["lookml_suggestions"] = lookml
                # Generate additional content
                result["agent_instructions"] = generate_agent_instructions(
                    top_fields,
                    result.get("recommendations", []),
                    user_description=user_description,
                    common_questions=common_questions,
                    user_goals=user_goals
                )
                result["ca_lookml_file"] = generate_ca_lookml_file_content(
                    f"{model_name}/{explore_name}",
                    result,
                    explore_definition_json
                )
            except Exception as parse_error:
                result["parsing_error"] = str(parse_error)
        
        return result
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

def summarize_recommendations_with_gemini(gemini_model, recommendations):
    prompt = (
        "Summarize the following recommendations for LookML improvements into a concise, actionable list. "
        "Group similar actions and focus on the most impactful changes. Use as few words as possible while preserving meaning.\n\n"
        "Recommendations:\n"
    )
    for rec in recommendations:
        prompt += f"- {rec}\n"
    prompt += "\nSummarized Recommendations:"
    summary = analyze_with_gemini(gemini_model, prompt, '', '')
    # Extract the summary list (remove any extra text before/after)
    if isinstance(summary, str):
        lines = summary.strip().split('\n')
        # Only keep lines that look like summary items
        summary_lines = [line.lstrip('-*0123456789. ').strip() for line in lines if line.strip()]
        return summary_lines
    return []

def filter_recommendations_for_section(recommendations, section):
    section_lower = section.lower()
    # For 'explore', include general/explore-level recs
    if section_lower == 'explore':
        return [rec for rec in recommendations if 'explore' in rec.lower() or 'join' in rec.lower() or 'all' in rec.lower()]
    # For a view, include recs that mention the view name or are general
    return [rec for rec in recommendations if section_lower in rec.lower() or 'all' in rec.lower()]

def filter_fields_for_section(weighted_fields, section):
    section_lower = section.lower()
    # For 'explore', include fields that look like joins or are not view-specific
    if section_lower == 'explore':
        return [f for f in weighted_fields if '.' not in f[0] or 'join' in f[0].lower()]
    # For a view, include fields that start with the view name
    return [f for f in weighted_fields if f[0].lower().startswith(section_lower + '.')]

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.route('/generate_ca_lookml', methods=['POST', 'OPTIONS'])
def generate_ca_lookml():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    model_name = data.get('model_name')
    explore_name = data.get('explore_name')
    section = data.get('section', 'explore')  # 'explore' or view name
    MAX_RECOMMENDATIONS = 7
    MAX_WEIGHTED_FIELDS = 10
    recommendations = data.get('recommendations', [])[:MAX_RECOMMENDATIONS]
    weighted_fields = data.get('weighted_fields', [])[:MAX_WEIGHTED_FIELDS]
    user_description = (data.get('user_description', '') or '')[:300]
    common_questions = (data.get('common_questions', '') or '')[:300]
    user_goals = (data.get('user_goals', '') or '')[:300]
    is_continue = data.get('continue', False)
    previous_prompt = data.get('previous_prompt', '')
    previous_output = data.get('previous_output', '')
    use_extends = data.get('use_extends', False)

    looker_config = get_looker_config_from_secret_manager(LOOKER_PROJECT_ID, LOOKER_SECRET_NAME, LOOKER_SECRET_VERSION)
    gemini_model = initialize_vertex_ai(VERTEX_PROJECT_ID, VERTEX_LOCATION)

    # Filter recommendations and fields for this section
    filtered_recs = filter_recommendations_for_section(recommendations, section)
    filtered_fields = filter_fields_for_section(weighted_fields, section)

    # Filter lookml_suggestions for this section (if present)
    lookml_suggestions = data.get('lookml_suggestions', '')
    relevant_lookml_suggestions = ''
    if lookml_suggestions and isinstance(lookml_suggestions, str):
        # Only include suggestions that mention the section name
        section_lower = section.lower()
        relevant_lines = [line for line in lookml_suggestions.split('\n') if section_lower in line.lower() or 'explore' in line.lower()]
        relevant_lookml_suggestions = '\n'.join(relevant_lines)

    # For view generation, only send weighted fields that belong to that view
    if section.lower() != 'explore':
        filtered_fields = [f for f in filtered_fields if f[0].lower().startswith(section.lower() + '.')]
        use_extends = True  # Always generate as extends for views

    if is_continue and previous_prompt and previous_output:
        last_lines = '\n'.join(previous_output.strip().split('\n')[-30:])
        prompt = previous_prompt + (
            "\n\nHere are the last lines you generated. Do NOT repeat any code already provided. Only generate new code that comes after these lines.\n"
            f"LAST_LINES:\n{last_lines}\n"
        )
    else:
        # Step 1: Summarize recommendations with Gemini
        summarized_recs = summarize_recommendations_with_gemini(gemini_model, filtered_recs)
        # Step 2: Use summary in LookML generation prompt
        if section.lower() == 'explore':
            prompt = f"""
You are an expert LookML developer. Generate the LookML for the explore '{explore_name}' in model '{model_name}', implementing as many of the summarized recommendations as possible for Conversational Analytics readiness. Use the weighted fields to prioritize which joins or explore-level settings to improve. Use the user context to inform labels and descriptions. Output only the LookML code for the explore, ready to copy/paste into a LookML project.

User Description: {user_description}
Common Questions: {common_questions}
User Goals: {user_goals}

Weighted Fields (most important first): {filtered_fields}

Summarized Recommendations:\n"""
        else:
            prompt = f"""
You are an expert LookML developer. Generate an extends view for '{section}' in model '{model_name}', including ONLY the relevant fields below. Implement as many of the summarized recommendations as possible for Conversational Analytics readiness. Use the weighted fields to prioritize which fields to improve. Use the user context to inform labels and descriptions.

IMPORTANT RULES:
1. Keep all synonyms within the description parameter, do not add a separate synonym parameter
2. Only include the relevant fields listed below in the extends view
3. Output only the LookML code for the extends view, ready to copy/paste into a LookML project.

User Description: {user_description}
Common Questions: {common_questions}
User Goals: {user_goals}

Relevant Fields (most important first): {filtered_fields}

Summarized Recommendations:\n"""
        for rec in summarized_recs:
            prompt += f"- {rec}\n"
        if relevant_lookml_suggestions:
            prompt += f"\nRelevant LookML Suggestions:\n{relevant_lookml_suggestions}\n"
        prompt += "\nGenerate only the LookML code for this extends view. Do not include other views or explores."

    lookml_code = analyze_with_gemini(gemini_model, prompt, model_name, explore_name)

    # Post-process to remove duplicate lines at the join if this is a continue request
    if is_continue and previous_output and isinstance(lookml_code, str):
        prev_lines = previous_output.strip().split('\n')
        new_lines = lookml_code.strip().split('\n')
        max_overlap = min(30, len(prev_lines), len(new_lines))
        overlap = 0
        for i in range(max_overlap, 0, -1):
            if prev_lines[-i:] == new_lines[:i]:
                overlap = i
                break
        if overlap > 0:
            lookml_code = '\n'.join(new_lines[overlap:])
        lookml_code = previous_output + ('\n' if not previous_output.endswith('\n') else '') + lookml_code

    is_truncated = False
    if isinstance(lookml_code, str) and 'Warning: Response truncated (MAX_TOKENS)' in lookml_code:
        is_truncated = True

    return jsonify({
        "ca_lookml_code": lookml_code,
        "is_truncated": is_truncated,
        "prompt": prompt
    })

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    result = analyze_lookml(
        explore_name=data.get('explore_name'),
        model_name=data.get('model_name'),
        user_description=data.get('user_description'),
        common_questions=data.get('common_questions'),
        user_goals=data.get('user_goals')
    )
    return jsonify(result) 