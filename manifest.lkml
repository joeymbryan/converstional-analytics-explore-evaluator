project_name: "conversational-analytics-explore-evaluator"

application: ca_explore_evaluator {
  label: "CA Explore Evaluator"
  url: "http://localhost:8080/bundle.js"
  # File containing the code
  file: "bundle.js"
  entitlements: {
    core_api_methods: ["all_lookml_models", "lookml_model_explore", "run_inline_query", "me"]
    navigation: yes
    use_form_submit: yes
    use_embeds: no
    use_iframes: yes
    external_api_urls: ["http://localhost:8080"]
    oauth2_urls: []
    scoped_user_attributes: []
    global_user_attributes: []
  }
}