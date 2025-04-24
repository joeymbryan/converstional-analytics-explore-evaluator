# ExploreWise - Conversational Analytics Explore Evaluator

## Current State
- Built a backend cloud function that:
  - Connects to Looker API (v4.0)
  - Analyzes field usage history
  - Uses Gemini to evaluate CA readiness
  - Provides recommendations for improvement
  - Generates agent instructions
  - Can be run locally or as a Cloud Function

## Ultimate Goal
Create a Looker Extension (ExploreWise) that helps users optimize their Looker Explores for Conversational Analytics by providing:
- CA readiness scoring
- Usage analysis
- Smart recommendations
- Agent instruction generation and management

### Problem Statement
Looker's Conversational Analytics feature requires well-structured and documented Explores to work effectively. Currently, there's no easy way for users to:
1. Evaluate how "CA-ready" their Explores are
2. Get actionable recommendations for improvement
3. Generate and maintain agent instructions
4. Track changes and updates over time

### Target Users
- Looker developers/administrators
- Data analysts responsible for LookML development
- Teams implementing Conversational Analytics

### Workflow
1. User accesses ExploreWise through Looker UI
2. Selects an Explore to analyze
3. System analyzes:
   - Explore metadata
   - Field usage patterns
   - Query history
4. User provides additional context:
   - User descriptions
   - Common questions
   - Business goals
5. System generates:
   - CA readiness score
   - Recommendations
   - Draft agent instructions
6. User can:
   - Review and modify recommendations
   - Adjust top fields
   - Customize agent instructions
   - Save and track changes

## Key Requirements

### Technical Requirements
- Looker Extension built with React
- Cloud Function backend (existing)
- Secure authentication and authorization
- Version tracking for Explore changes
- Persistent storage for agent instructions and metadata

### Performance Requirements
- Quick Explore analysis (< 30 seconds)
- Responsive UI
- Handle multiple concurrent users
- Support large Explores with many fields

### Security Requirements
- Secure authentication between extension and cloud function
- Respect Looker user permissions
- Secure storage of agent instructions
- Audit logging of changes

### Integration Requirements
- Seamless integration with Looker UI
- API compatibility with Looker 4.0+
- Integration with Vertex AI/Gemini
- Potential integration with version control systems

### User Experience Requirements
- Clean, intuitive interface matching Looker design
- Clear visualization of CA readiness score
- Easy-to-understand recommendations
- Simple workflow for reviewing and updating agent instructions
- History/tracking of changes

## Technical Considerations

### Deployment Environment
- Extension: Hosted within Looker
- Backend: Google Cloud Function
- Storage: Cloud Firestore or similar for persistence
- Authentication: Looker OAuth

### Scalability
- Handle multiple Explores
- Support concurrent users
- Efficient storage and retrieval of historical data
- Caching of analysis results

### Integration Points
- Looker API
- Vertex AI/Gemini API
- Cloud Storage
- Authentication services

### Data Privacy/Security
- Secure handling of Looker credentials
- Protection of analysis history
- Access control based on Looker permissions
- Secure storage of agent instructions

## Success Criteria
- Adoption by Looker developers
- Improved CA performance in optimized Explores
- Reduced time to implement CA
- Positive user feedback
- Measurable improvement in Explore documentation

## Next Steps
1. Set up Looker Extension project structure
   - Create React application
   - Set up build pipeline
   - Configure Looker extension framework
2. Design and implement UI components
   - Explore selector
   - Analysis display
   - Input forms for user context
   - Recommendations display
   - Agent instructions editor
3. Integrate with existing cloud function
   - Set up authentication
   - Create API client
   - Handle data flow
4. Implement storage solution
   - Design schema for storing agent instructions
   - Set up versioning system
   - Create APIs for data access
5. Add monitoring and tracking
   - LookML change detection
   - Usage analytics
   - Performance monitoring
6. Testing and documentation
   - Unit tests
   - Integration tests
   - User documentation
   - Developer guide