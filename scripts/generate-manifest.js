const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = isProduction 
  ? 'https://joeybryan.github.io/conversational-analytics-explore-evaluator'
  : 'http://localhost:8080';

const manifestContent = `project_name: "conversational-analytics-explore-evaluator"

application: ca_explore_evaluator {
  label: "CA Explore Evaluator"
  url: "${baseUrl}/bundle.js"
  # File containing the code
  file: "bundle.js"
  entitlements: {
    core_api_methods: ["all_lookml_models", "lookml_model_explore", "run_inline_query", "me"]
    navigation: yes
    use_form_submit: yes
    use_embeds: no
    use_iframes: yes
    external_api_urls: ["${baseUrl}"]
    oauth2_urls: []
    scoped_user_attributes: []
    global_user_attributes: []
  }
}`;

fs.writeFileSync(path.join(__dirname, '../manifest.lkml'), manifestContent);
console.log(`Generated manifest.lkml for ${isProduction ? 'production' : 'development'} environment`); 