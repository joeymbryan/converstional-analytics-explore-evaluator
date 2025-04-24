project_name: "explorewise"

application: explorewise {
  label: "ExploreWise"
  url: "https://localhost:8080/bundle.js"
  entitlements: {
    core_api_methods: ["lookml_model_explore", "run_inline_query"]
    navigation: yes
    use_form_submit: yes
    use_embeds: no
    external_api_urls: ["http://localhost:8080"]
    oauth2_urls: []
    scoped_user_attributes: []
    global_user_attributes: []
  }
} 