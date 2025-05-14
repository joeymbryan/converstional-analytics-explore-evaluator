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
  Label,
  List,
  ListItem,
  FieldCheckbox,
  Text,
} from '@looker/components'
import { ExploreSelector } from './ExploreSelector'
import { ExploreDetails } from './ExploreDetails'
import { ArtifactStorage } from '../utils/artifactStorage'
import LoadingButton from './LoadingButton'
import ReactMarkdown from 'react-markdown'
import { CopyToClipboard } from 'react-copy-to-clipboard'

interface AnalysisResult {
  status: string
  grade?: number
  rationale?: string
  top_used_fields?: [string, number][]
  recommendations?: string[]
  agent_instructions?: string[]
  timestamp?: string
  raw_analysis?: string
  lookml_suggestions?: string
  model_name: string
  explore_name: string
  user_description: string
  common_questions: string
  user_goals: string
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
  const [caLookmlCode, setCaLookmlCode] = useState<string | null>(null)
  const [isGeneratingLookml, setIsGeneratingLookml] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const [isContinuing, setIsContinuing] = useState(false)
  const [sectionOutputs, setSectionOutputs] = useState<{
    [section: string]: {
      code: string | null,
      isLoading: boolean,
      isTruncated: boolean,
      lastPrompt: string | null,
      isContinuing: boolean,
      copySuccess: boolean,
    }
  }>({})
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [useExtends, setUseExtends] = useState(false)
  const [isGeneratingSequentially, setIsGeneratingSequentially] = useState(false)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [promptSize, setPromptSize] = useState(0)
  const [promptWarning, setPromptWarning] = useState(false)
  
  const extensionContext = useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK
  const storage = new ArtifactStorage(sdk)

  useEffect(() => {
    const loadSavedAnalysis = async () => {
      if (!selectedExplore) {
        setAnalysisResult(null)
        setLastAnalyzed(null)
        setUserDescription('')
        setCommonQuestions('')
        setUserGoals('')
        return
      }
      
      setIsLoading(true)
      setError(null)
      
      try {
        const savedResult = await storage.getAnalysisResult(selectedExplore)
        if (savedResult) {
          setAnalysisResult(savedResult)
          setLastAnalyzed(savedResult.timestamp || 'Unknown date')
          setUserDescription(savedResult.user_description || '')
          setCommonQuestions(savedResult.common_questions || '')
          setUserGoals(savedResult.user_goals || '')
        } else {
          setAnalysisResult(null)
          setLastAnalyzed(null)
          setUserDescription('')
          setCommonQuestions('')
          setUserGoals('')
        }
      } catch (error) {
        console.error('Error loading saved analysis:', error)
        setError('Failed to load saved analysis')
        setUserDescription('')
        setCommonQuestions('')
        setUserGoals('')
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
          timestamp: new Date().toISOString(),
          user_description: userDescription,
          common_questions: commonQuestions,
          user_goals: userGoals,
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

  const handleGenerateCaLookml = async () => {
    if (!analysisResult) return
    setIsGeneratingLookml(true)
    setCopySuccess(false)
    try {
      const response = await fetch('http://localhost:8082/generate_ca_lookml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: analysisResult.model_name,
          explore_name: analysisResult.explore_name,
          recommendations: analysisResult.recommendations,
          weighted_fields: analysisResult.top_used_fields,
          user_description: userDescription,
          common_questions: commonQuestions,
          user_goals: userGoals,
        })
      })
      const data = await response.json()
      setCaLookmlCode(data.ca_lookml_code)
      setIsTruncated(data.is_truncated)
      setLastPrompt(data.prompt)
    } catch (err) {
      setCaLookmlCode('Error generating LookML. Please try again.')
      setIsTruncated(false)
    } finally {
      setIsGeneratingLookml(false)
    }
  }

  const handleContinueLookml = async () => {
    if (!lastPrompt || !caLookmlCode) return
    setIsContinuing(true)
    setCopySuccess(false)
    try {
      const response = await fetch('http://localhost:8082/generate_ca_lookml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          continue: true,
          previous_prompt: lastPrompt,
          previous_output: caLookmlCode,
        })
      })
      const data = await response.json()
      setCaLookmlCode(caLookmlCode + (data.ca_lookml_code || ''))
      setIsTruncated(data.is_truncated)
      setLastPrompt(data.prompt)
    } catch (err) {
      // Optionally show an error
    } finally {
      setIsContinuing(false)
    }
  }

  const getSections = () => {
    if (!analysisResult) return []
    const sections = new Set<string>()
    sections.add('explore')
    // Add all unique view names from top_used_fields
    if (analysisResult.top_used_fields) {
      analysisResult.top_used_fields.forEach(([field]) => {
        const parts = field.split('.')
        if (parts.length === 2) sections.add(parts[0])
      })
    }
    // Add base view and all join names/from from raw_analysis (if available and parseable)
    if (analysisResult.raw_analysis) {
      try {
        const exploreData = JSON.parse(analysisResult.raw_analysis)
        // Debug log: print the parsed exploreData
        // eslint-disable-next-line no-console
        console.log('DEBUG: parsed exploreData from raw_analysis:', exploreData)
        if (exploreData.view_name) sections.add(exploreData.view_name)
        if (exploreData.joins) {
          exploreData.joins.forEach((join: any) => {
            if (join.name) sections.add(join.name)
            if (join.from) sections.add(join.from)
          })
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    return Array.from(sections)
  }

  const handleSectionToggle = (section: string) => {
    const newSelectedSections = new Set(selectedSections)
    if (newSelectedSections.has(section)) {
      newSelectedSections.delete(section)
    } else {
      newSelectedSections.add(section)
    }
    setSelectedSections(newSelectedSections)
  }

  const handleGenerateAll = async () => {
    if (!analysisResult) return
    const sections = getSections()
    const selectedSectionsArray = Array.from(selectedSections)
    if (selectedSectionsArray.length === 0) {
      setError('Please select at least one section to generate')
      return
    }

    setIsGeneratingSequentially(true)
    setCurrentSectionIndex(0)
    setSectionOutputs({})

    for (let i = 0; i < selectedSectionsArray.length; i++) {
      setCurrentSectionIndex(i)
      await handleGenerateSectionLookml(selectedSectionsArray[i])
    }

    setIsGeneratingSequentially(false)
    setCurrentSectionIndex(0)
  }

  const handleGenerateSectionLookml = async (section: string) => {
    if (!analysisResult) return
    setSectionOutputs(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        isLoading: true,
        isTruncated: false,
        lastPrompt: null,
        isContinuing: false,
        copySuccess: false,
      }
    }))
    try {
      const payload = {
        model_name: analysisResult.model_name,
        explore_name: analysisResult.explore_name,
        recommendations: analysisResult.recommendations,
        weighted_fields: analysisResult.top_used_fields,
        user_description: userDescription,
        common_questions: commonQuestions,
        user_goals: userGoals,
        section,
        use_extends: useExtends,
      }
      console.log('[LookML Generation] Sending payload:', payload)
      const response = await fetch('http://localhost:8082/generate_ca_lookml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      console.log('[LookML Generation] Received response:', data)
      setSectionOutputs(prev => ({
        ...prev,
        [section]: {
          code: data.ca_lookml_code,
          isLoading: false,
          isTruncated: data.is_truncated,
          lastPrompt: data.prompt,
          isContinuing: false,
          copySuccess: false,
        }
      }))
    } catch (err) {
      console.error('[LookML Generation] Error:', err)
      setSectionOutputs(prev => ({
        ...prev,
        [section]: {
          code: 'Error generating LookML. Please try again.',
          isLoading: false,
          isTruncated: false,
          lastPrompt: null,
          isContinuing: false,
          copySuccess: false,
        }
      }))
    }
  }

  const handleContinueSectionLookml = async (section: string) => {
    const sectionState = sectionOutputs[section]
    if (!sectionState || !sectionState.lastPrompt || !sectionState.code) return
    setSectionOutputs(prev => ({
      ...prev,
      [section]: {
        ...sectionState,
        isContinuing: true,
        copySuccess: false,
      }
    }))
    try {
      const response = await fetch('http://localhost:8082/generate_ca_lookml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          continue: true,
          previous_prompt: sectionState.lastPrompt,
          previous_output: sectionState.code,
        })
      })
      const data = await response.json()
      setSectionOutputs(prev => ({
        ...prev,
        [section]: {
          ...sectionState,
          code: sectionState.code + (data.ca_lookml_code || ''),
          isTruncated: data.is_truncated,
          lastPrompt: data.prompt,
          isContinuing: false,
          copySuccess: false,
        }
      }))
    } catch (err) {
      setSectionOutputs(prev => ({
        ...prev,
        [section]: {
          ...sectionState,
          isContinuing: false,
        }
      }))
    }
  }

  const handleCopySection = (section: string) => {
    setSectionOutputs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        copySuccess: true,
      }
    }))
  }

  const isFormValid = selectedExplore && 
    selectedFields.length > 0 && 
    userDescription.trim() !== '' && 
    commonQuestions.trim() !== '' && 
    userGoals.trim() !== ''

  // Utility to estimate token count
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)

  // Update prompt size estimate when selected sections or inputs change
  useEffect(() => {
    if (!analysisResult) return
    // Build a sample prompt for the first selected section
    const selectedSectionsArray = Array.from(selectedSections)
    if (selectedSectionsArray.length === 0) {
      setPromptSize(0)
      setPromptWarning(false)
      return
    }
    const section = selectedSectionsArray[0]
    // Simulate the prompt as in backend
    let prompt = ''
    if (section === 'explore') {
      prompt = `You are an expert LookML developer. Generate the LookML for the explore '${analysisResult.explore_name}' in model '${analysisResult.model_name}', implementing as many of the summarized recommendations as possible for Conversational Analytics readiness. Use the weighted fields to prioritize which joins or explore-level settings to improve. Use the user context to inform labels and descriptions. Output only the LookML code for the explore, ready to copy/paste into a LookML project.\n\nUser Description: ${userDescription}\nCommon Questions: ${commonQuestions}\nUser Goals: ${userGoals}\nWeighted Fields (most important first): ${(analysisResult.top_used_fields || []).map(f=>f[0]).join(', ')}\nSummarized Recommendations:`
    } else {
      // Only fields for this view
      const viewFields = (analysisResult.top_used_fields || []).filter(f => f[0].startsWith(section + '.'))
      prompt = `You are an expert LookML developer. Generate the LookML for the view '${section}' in model '${analysisResult.model_name}', implementing as many of the summarized recommendations as possible for Conversational Analytics readiness. Use the weighted fields to prioritize which fields to improve. Use the user context to inform labels and descriptions. Output only the LookML code for the view, ready to copy/paste into a LookML project.\n\nUser Description: ${userDescription}\nCommon Questions: ${commonQuestions}\nUser Goals: ${userGoals}\nWeighted Fields (most important first): ${viewFields.map(f=>f[0]).join(', ')}\nSummarized Recommendations:`
    }
    const tokenCount = estimateTokens(prompt)
    setPromptSize(tokenCount)
    setPromptWarning(tokenCount > 30000) // Warning if over 30k tokens
  }, [analysisResult, selectedSections, userDescription, commonQuestions, userGoals])

  return (
    <Box p="large">
      <SpaceVertical gap="large">
        <Heading>Conversational Analytics Explore Evaluator</Heading>
        
        <Card>
          <SpaceVertical gap="medium">
            <ExploreSelector
              onExploreSelect={handleExploreSelect}
            />
            
            {selectedExplore && (
              <ExploreDetails
                exploreName={selectedExplore}
                onFieldsChange={setSelectedFields}
                onDescriptionChange={setUserDescription}
                onQuestionsChange={setCommonQuestions}
                onGoalsChange={setUserGoals}
                userDescription={userDescription}
                onUserDescriptionChange={e => setUserDescription(e.target.value)}
                commonQuestions={commonQuestions}
                onCommonQuestionsChange={e => setCommonQuestions(e.target.value)}
                userGoals={userGoals}
                onUserGoalsChange={e => setUserGoals(e.target.value)}
              />
            )}
            
            {error && (
              <MessageBar intent="critical">
                {error}
              </MessageBar>
            )}
            
            <Button
              disabled={!isFormValid || isAnalyzing}
              onClick={handleAnalyze}
            >
              {isAnalyzing ? 'Analyzing...' : 'Generate Insights'}
            </Button>
          </SpaceVertical>
        </Card>

        {analysisResult && (
          <Card>
            <SpaceVertical gap="medium">
              <Heading>Analysis Results</Heading>
              
              {lastAnalyzed && (
                <Text>Last analyzed: {new Date(lastAnalyzed).toLocaleString()}</Text>
              )}
              
              <SpaceVertical gap="small">
                <Heading as="h3">Grade: {analysisResult.grade}/10</Heading>
                <Paragraph>{analysisResult.rationale}</Paragraph>
              </SpaceVertical>

              {analysisResult.recommendations && (
                <SpaceVertical gap="small">
                  <Heading as="h3">Recommendations</Heading>
                  <List>
                    {analysisResult.recommendations.map((rec, i) => (
                      <ListItem key={i}>{rec}</ListItem>
                    ))}
                  </List>
                </SpaceVertical>
              )}

              {analysisResult.agent_instructions && (
                <SpaceVertical gap="small">
                  <Heading as="h3">Agent Instructions</Heading>
                  <List>
                    {analysisResult.agent_instructions.map((instruction, i) => (
                      <ListItem key={i}>{instruction}</ListItem>
                    ))}
                  </List>
                </SpaceVertical>
              )}

              <SpaceVertical gap="small">
                <Heading as="h3">Generate LookML</Heading>
                <Space gap="small">
                  <FieldCheckbox
                    label="Use extends instead of refinements"
                    checked={useExtends}
                    onChange={e => setUseExtends((e.target as HTMLInputElement).checked)}
                  />
                </Space>
                
                <SpaceVertical gap="small">
                  <Heading as="h4">Select Sections to Generate</Heading>
                  <Space gap="small">
                    {getSections().map(section => (
                      <FieldCheckbox
                        key={section}
                        label={section}
                        checked={selectedSections.has(section)}
                        onChange={() => handleSectionToggle(section)}
                      />
                    ))}
                  </Space>
                </SpaceVertical>

                {promptSize > 0 && (
                  <Text color={promptWarning ? "critical" : "text"}>
                    Estimated prompt size: {promptSize} tokens
                    {promptWarning && " (Warning: Large prompt may be truncated)"}
                  </Text>
                )}

                <Button
                  disabled={selectedSections.size === 0 || isGeneratingSequentially}
                  onClick={handleGenerateAll}
                >
                  {isGeneratingSequentially ? 'Generating...' : 'Generate Selected Sections'}
                </Button>

                {Object.entries(sectionOutputs).map(([section, state]) => (
                  <Card key={section}>
                    <SpaceVertical gap="small">
                      <Heading as="h4">{section}</Heading>
                      {state.isLoading ? (
                        <Spinner />
                      ) : state.code ? (
                        <>
                          <Box
                            p="medium"
                            bg="background"
                            border="1px solid #e0e0e0"
                            borderRadius="medium"
                            style={{ maxHeight: '400px', overflow: 'auto' }}
                          >
                            <ReactMarkdown>{state.code}</ReactMarkdown>
                          </Box>
                          <Space gap="small">
                            <CopyToClipboard
                              text={state.code}
                              onCopy={() => handleCopySection(section)}
                            >
                              <ButtonOutline>
                                {state.copySuccess ? 'Copied!' : 'Copy'}
                              </ButtonOutline>
                            </CopyToClipboard>
                            {state.isTruncated && (
                              <ButtonOutline
                                disabled={state.isContinuing}
                                onClick={() => handleContinueSectionLookml(section)}
                              >
                                {state.isContinuing ? 'Continuing...' : 'Continue'}
                              </ButtonOutline>
                            )}
                          </Space>
                        </>
                      ) : null}
                    </SpaceVertical>
                  </Card>
                ))}
              </SpaceVertical>
            </SpaceVertical>
          </Card>
        )}
      </SpaceVertical>
    </Box>
  )
}

export default ExploreAnalyzer
