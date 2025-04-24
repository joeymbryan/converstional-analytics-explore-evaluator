import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  Heading,
  FieldText,
  TextArea,
  SpaceVertical,
  Paragraph,
  List,
  ListItem,
} from '@looker/components'
import { ExtensionContext } from '@looker/extension-sdk-react'

interface AnalysisResult {
  status: string
  grade?: number
  rationale?: string
  top_used_fields?: [string, number][]
  recommendations?: string[]
  agent_instructions?: string[]
}

export const ExploreAnalyzer: React.FC = () => {
  const [exploreName, setExploreName] = useState('')
  const [userDescription, setUserDescription] = useState('')
  const [commonQuestions, setCommonQuestions] = useState('')
  const [userGoals, setUserGoals] = useState('')
  const [topFields, setTopFields] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('http://localhost:8080/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: exploreName.split('/')[0],
          explore_name: exploreName.split('/')[1],
          user_description: userDescription,
          common_questions: commonQuestions,
          user_goals: userGoals,
          top_fields: topFields.split(',').map(f => f.trim()).filter(f => f),
        }),
      })
      
      const result = await response.json()
      setAnalysisResult(result)
    } catch (error) {
      console.error('Error analyzing explore:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Box>
      <SpaceVertical>
        <Heading>ExploreWise</Heading>
        <Paragraph>Analyze and optimize your Looker Explores for Conversational Analytics.</Paragraph>

        <Card>
          <SpaceVertical>
            <FieldText
              label="Looker Explore Name"
              placeholder="model/explore"
              value={exploreName}
              onChange={(e) => setExploreName(e.target.value)}
              description="Enter the name of the Looker Explore you want to analyze."
            />

            <TextArea
              label="User Description"
              placeholder="Users are trying to understand their sales history of given products..."
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              description="Provide a description of the users who will be using this explore."
            />

            <TextArea
              label="Common Questions"
              placeholder="What were my sales last week? Which were my top products?"
              value={commonQuestions}
              onChange={(e) => setCommonQuestions(e.target.value)}
              description="List the common questions that users ask when using this explore."
            />

            <TextArea
              label="User Goals"
              placeholder="User is trying to get a clear understanding..."
              value={userGoals}
              onChange={(e) => setUserGoals(e.target.value)}
              description="Describe the goals that users are trying to achieve when using this explore."
            />

            <FieldText
              label="Top Fields"
              placeholder="field1, field2, field3"
              value={topFields}
              onChange={(e) => setTopFields(e.target.value)}
              description="Specify the top fields to use for the agent, separated by commas."
            />

            <Button
              onClick={handleAnalyze}
              disabled={!exploreName.includes('/')}
              loading={isAnalyzing}
            >
              Generate Insights
            </Button>
          </SpaceVertical>
        </Card>

        {analysisResult && (
          <Card>
            <SpaceVertical>
              <Heading as="h3">Analysis Results</Heading>
              
              {analysisResult.grade && (
                <Box>
                  <Heading as="h4">Grade: {analysisResult.grade}/100</Heading>
                  <Paragraph>{analysisResult.rationale}</Paragraph>
                </Box>
              )}

              {analysisResult.top_used_fields && analysisResult.top_used_fields.length > 0 && (
                <Box>
                  <Heading as="h4">Top Used Fields</Heading>
                  <List>
                    {analysisResult.top_used_fields.map(([field, score]) => (
                      <ListItem key={field}>
                        {field}: {score}
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                <Box>
                  <Heading as="h4">Recommendations</Heading>
                  <List>
                    {analysisResult.recommendations.map((rec, index) => (
                      <ListItem key={index}>{rec}</ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {analysisResult.agent_instructions && analysisResult.agent_instructions.length > 0 && (
                <Box>
                  <Heading as="h4">Agent Instructions</Heading>
                  <List>
                    {analysisResult.agent_instructions.map((instruction, index) => (
                      <ListItem key={index}>{instruction}</ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </SpaceVertical>
          </Card>
        )}
      </SpaceVertical>
    </Box>
  )
} 