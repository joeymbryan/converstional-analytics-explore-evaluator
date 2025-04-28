import React, { useState, useEffect, useContext } from 'react'
import { ExtensionContext } from '@looker/extension-sdk-react'
import {
  Box,
  Button,
  Card,
  Heading,
  SpaceVertical,
  Paragraph,
  MessageBar,
  Spinner,
  ButtonOutline,
  Space,
} from '@looker/components'
import { ExploreSelector } from './ExploreSelector'
import { ExploreDetails } from './ExploreDetails'
import { ArtifactStorage } from '../utils/artifactStorage'

interface AnalysisResult {
  status: string
  grade?: number
  rationale?: string
  top_used_fields?: [string, number][]
  recommendations?: string[]
  agent_instructions?: string[]
  timestamp?: string
}

export const ExploreAnalyzer: React.FC = () => {
  const [selectedExplore, setSelectedExplore] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [userDescription, setUserDescription] = useState('')
  const [commonQuestions, setCommonQuestions] = useState('')
  const [userGoals, setUserGoals] = useState('')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null)
  
  const extensionContext = useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK
  const storage = new ArtifactStorage(sdk)

  useEffect(() => {
    const loadSavedAnalysis = async () => {
      if (!selectedExplore) {
        setAnalysisResult(null)
        setLastAnalyzed(null)
        return
      }
      
      setIsLoading(true)
      setError(null)
      
      try {
        const savedResult = await storage.getAnalysisResult(selectedExplore)
        if (savedResult) {
          setAnalysisResult(savedResult)
          setLastAnalyzed(savedResult.timestamp || 'Unknown date')
        } else {
          setAnalysisResult(null)
          setLastAnalyzed(null)
        }
      } catch (error) {
        console.error('Error loading saved analysis:', error)
        setError('Failed to load saved analysis')
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedAnalysis()
  }, [selectedExplore])

  const handleExploreSelect = (explore: string) => {
    setSelectedExplore(explore)
    setAnalysisResult(null)
    setError(null)
    setLastAnalyzed(null)
    // Reset form fields when explore changes
    setSelectedFields([])
    setUserDescription('')
    setCommonQuestions('')
    setUserGoals('')
  }

  const handleAnalyze = async () => {
    if (!selectedExplore || !selectedFields.length || !userDescription || !commonQuestions || !userGoals) {
      setError('Please fill in all required fields before generating insights')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    
    try {
      const [modelName, exploreName] = selectedExplore.split('/')
      const response = await fetch('http://localhost:8082/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: modelName,
          explore_name: exploreName,
          user_description: userDescription,
          common_questions: commonQuestions,
          user_goals: userGoals,
          top_fields: selectedFields,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.status === 'success') {
        const analysisWithTimestamp = {
          ...result,
          timestamp: new Date().toISOString()
        }
        setAnalysisResult(analysisWithTimestamp)
        setLastAnalyzed(analysisWithTimestamp.timestamp)
        
        try {
          await storage.saveAnalysisResult(selectedExplore, analysisWithTimestamp)
        } catch (storageError) {
          console.error('Error saving analysis:', storageError)
          setError('Analysis completed but failed to save results')
        }
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (error) {
      console.error('Error analyzing explore:', error)
      setError('Failed to analyze explore. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const isFormValid = selectedExplore && 
    selectedFields.length > 0 && 
    userDescription.trim() !== '' && 
    commonQuestions.trim() !== '' && 
    userGoals.trim() !== ''

  return (
    <Box p="large" maxWidth="1200px" mx="auto">
      <SpaceVertical gap="large">
        <Heading>ExploreWise</Heading>
        <Paragraph>Analyze and optimize your Looker Explores for Conversational Analytics.</Paragraph>

        <ExploreSelector onExploreSelect={handleExploreSelect} />

        {error && (
          <MessageBar intent="critical">
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <Box p="large" display="flex" justifyContent="center">
            <Spinner size={80} />
          </Box>
        ) : selectedExplore && (
          <>
            <ExploreDetails
              exploreName={selectedExplore}
              onFieldsChange={setSelectedFields}
              onDescriptionChange={setUserDescription}
              onQuestionsChange={setCommonQuestions}
              onGoalsChange={setUserGoals}
            />

            <Space>
              <Button
                onClick={handleAnalyze}
                disabled={!isFormValid || isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Generate Insights'}
              </Button>

              {lastAnalyzed && (
                <ButtonOutline disabled>
                  Last analyzed: {new Date(lastAnalyzed).toLocaleString()}
                </ButtonOutline>
              )}
            </Space>
          </>
        )}

        {analysisResult && (
          <Card>
            <Box p="large">
              <SpaceVertical gap="large">
                <Heading as="h3">Analysis Results</Heading>
                
                {analysisResult.grade && (
                  <Box>
                    <Heading as="h4">Grade: {analysisResult.grade}/100</Heading>
                    <Paragraph>{analysisResult.rationale}</Paragraph>
                  </Box>
                )}

                {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                  <Box>
                    <Heading as="h4">Recommendations</Heading>
                    <ul>
                      {analysisResult.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </Box>
                )}

                {analysisResult.agent_instructions && analysisResult.agent_instructions.length > 0 && (
                  <Box>
                    <Heading as="h4">Agent Instructions</Heading>
                    <ul>
                      {analysisResult.agent_instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ul>
                  </Box>
                )}
              </SpaceVertical>
            </Box>
          </Card>
        )}
      </SpaceVertical>
    </Box>
  )
} 