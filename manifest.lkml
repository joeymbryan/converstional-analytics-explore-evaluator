project_name: "cloud_function_project"

application: cloud_function_project {
  label: "Cloud Function Project"
  url: "http://localhost:8080/index.html"
  # File containing the code
  file: "bundle.js"
  entitlements: {
    core_api_methods: ["all_connections","all_users","me"]
    navigation: yes
    new_window: yes
    new_window_external_urls: []
    use_form_submit: yes
    use_embeds: yes
    use_iframes: yes
    external_api_urls: []
    oauth2_urls: []
  }
} 