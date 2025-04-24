project_name: "conversational-analytics-explore-evaluator"

application: ca_explore_evaluator {
  label: "CA Explore Evaluator"
  url: "https://joeymbryan.github.io/converstional-analytics-explore-evaluator/bundle.js"
  # File containing the code
  file: "bundle.js"
  entitlements: {
    core_api_methods: ["lookml_model_explore", "run_inline_query", "me"]
    navigation: yes
    use_form_submit: yes
    use_embeds: no
    external_api_urls: ["https://joeymbryan.github.io"]
    oauth2_urls: []
    scoped_user_attributes: []
    global_user_attributes: []
  }
} 