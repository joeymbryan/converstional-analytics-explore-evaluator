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
    // Always include the explore
    sections.add('explore')
    // Add all unique view names from top_used_fields
    if (analysisResult.top_used_fields) {
      analysisResult.top_used_fields.forEach(([field]) => {
        const parts = field.split('.')
        if (parts.length === 2) sections.add(parts[0])
      })
    }
    // Add all join names from raw_analysis (if available and parseable)
    if (analysisResult.raw_analysis) {
      try {
        const exploreData = JSON.parse(analysisResult.raw_analysis)
        if (exploreData.joins) {
          exploreData.joins.forEach((join: any) => {
            if (join.name) sections.add(join.name)
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
          section,
          use_extends: useExtends,
        })
      })
      const data = await response.json()
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
      prompt = `You are an expert LookML developer. Generate the LookML for the view '${section}' in model '${analysisResult.model_name}', implementing as many of the summarized recommendations as possible for Conversational Analytics readiness. Use the weighted fields to prioritize which fields to improve. Use the user context to inform labels and descriptions.\n\nIMPORTANT RULES:\n1. Keep all synonyms within the description parameter, do not add a separate synonym parameter\n2. Always generate as an extends view and only include relevant fields\n\nOutput only the LookML code for the view, ready to copy/paste into a LookML project.\n\nUser Description: ${userDescription}\nCommon Questions: ${commonQuestions}\nUser Goals: ${userGoals}\nWeighted Fields (most important first): ${viewFields.map(f=>f[0]).join(', ')}\nSummarized Recommendations:`
    }
    const tokens = estimateTokens(prompt)
    setPromptSize(tokens)
    setPromptWarning(tokens > 6000)
  }, [analysisResult, selectedSections, userDescription, commonQuestions, userGoals])

  return (
    <Box p="xxlarge" maxWidth="1200px" mx="auto">
      <SpaceVertical gap="large">
        <Heading fontSize="xlarge">Conversational Analytics Explore Evaluator</Heading>
        <Paragraph fontSize="large">Analyze and optimize your Looker Explores for Conversational Analytics.</Paragraph>

        {/* Explore Selector and Explore Details side by side */}
        <Box display="flex" alignItems="flex-start" mb="xlarge">
          <Box flex="1 1 400px" mr="xlarge">
            <ExploreSelector onExploreSelect={handleExploreSelect} />
          </Box>
          {selectedExplore && (
            <Card minWidth="260px" maxWidth="420px" p="large">
              <Heading as="h4" fontSize="medium" mb="medium">Explore Details</Heading>
              <Box>
                <strong>Description</strong>
                <Paragraph>{/* You can add a prop to pass the description here if needed */}No description available</Paragraph>
              </Box>
              <Box mt="small">
                <strong>Last LookML Update</strong>
                <Paragraph>{new Date().toISOString().split('T')[0]}</Paragraph>
              </Box>
            </Card>
          )}
        </Box>

        <Box display="flex" flexWrap="wrap" alignItems="flex-start">
          {/* Fields Selection Card */}
          <Card minWidth="340px" flex="1 1 340px" maxWidth="420px" p="large" mr="xlarge">
            <Heading as="h4" fontSize="medium" mb="medium">Fields</Heading>
            <Box maxHeight="400px" overflowY="auto">
              {selectedExplore && (
                <ExploreDetails
                  exploreName={selectedExplore}
                  onFieldsChange={setSelectedFields}
                  onDescriptionChange={setUserDescription}
                  onQuestionsChange={setCommonQuestions}
                  onGoalsChange={setUserGoals}
                />
              )}
            </Box>
          </Card>

          {/* User Input Card */}
          <Card minWidth="340px" flex="1 1 340px" maxWidth="420px" p="large" mr="xlarge">
            <Heading as="h4" fontSize="medium" mb="medium">User Context</Heading>
            <SpaceVertical gap="medium">
              <Box mb="medium">
                <label htmlFor="user-description"><strong>User Description</strong></label>
                <textarea
                  id="user-description"
                  value={userDescription}
                  onChange={e => setUserDescription(e.target.value)}
                  placeholder="Provide a description of the users who will be using this explore."
                  style={{ width: '100%', minHeight: 60, marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </Box>
              <Box mb="medium">
                <label htmlFor="common-questions"><strong>Common Questions</strong></label>
                <textarea
                  id="common-questions"
                  value={commonQuestions}
                  onChange={e => setCommonQuestions(e.target.value)}
                  placeholder="List the common questions that users ask when using this explore."
                  style={{ width: '100%', minHeight: 60, marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </Box>
              <Box mb="medium">
                <label htmlFor="user-goals"><strong>User Goals</strong></label>
                <textarea
                  id="user-goals"
                  value={userGoals}
                  onChange={e => setUserGoals(e.target.value)}
                  placeholder="Describe the goals that users are trying to achieve when using this explore."
                  style={{ width: '100%', minHeight: 60, marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </Box>
            </SpaceVertical>
          </Card>
        </Box>

        <Box mt="xlarge">
          <Space>
            <LoadingButton
              is_loading={isAnalyzing}
              onClick={handleAnalyze}
              disabled={!isFormValid || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Generate Insights'}
            </LoadingButton>

            {lastAnalyzed && (
              <ButtonOutline disabled>
                Last analyzed: {new Date(lastAnalyzed).toLocaleString()}
              </ButtonOutline>
            )}
          </Space>
        </Box>

        {error && (
          <MessageBar intent="critical">
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <Box p="large" display="flex" justifyContent="center">
            <Spinner size={80} />
          </Box>
        ) : analysisResult && (
          <Box maxWidth="1200px" mx="auto">
            <Card mt="xlarge">
              <Box p="large">
                <SpaceVertical gap="large">
                  <Heading as="h3">Analysis Results</Heading>
                  {/* Grade at the top, above rationale */}
                  {analysisResult.grade !== undefined && (
                    <Box>
                      <Heading as="h4">Grade: {analysisResult.grade} / 100</Heading>
                    </Box>
                  )}
                  {analysisResult.rationale && (
                    <Paragraph>
                      {analysisResult.rationale.split('. ')[0] + (analysisResult.rationale.includes('.') ? '.' : '')}
                    </Paragraph>
                  )}
                  {/* Agent Instructions */}
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
                  {/* Step 2: Section-based LookML Generation */}
                  {analysisResult && (
                    <Box mt="xlarge">
                      <Heading as="h4">Generate LookML</Heading>
                      <SpaceVertical gap="large">
                        <Box>
                          <SpaceVertical gap="small">
                            <Label>Select Sections to Generate</Label>
                            <List>
                              {getSections().map(section => (
                                <ListItem key={section}>
                                  <FieldCheckbox
                                    label={section === 'explore' ? 'Explore' : `View: ${section}`}
                                    checked={selectedSections.has(section)}
                                    onChange={() => handleSectionToggle(section)}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </SpaceVertical>
                        </Box>

                        <Box>
                          <SpaceVertical gap="small">
                            <Label>Generation Options</Label>
                            <FieldCheckbox
                              label="Generate as extends (will hide unnecessary fields)"
                              checked={useExtends}
                              onChange={() => setUseExtends(!useExtends)}
                            />
                          </SpaceVertical>
                        </Box>

                        {selectedSections.size > 0 && (
                          <Box mb="small">
                            <Text fontSize="small" color={promptWarning ? 'critical' : 'text2'}>
                              Prompt size: {promptSize} tokens / 8192{promptWarning ? ' (Warning: may exceed Gemini limit!)' : ''}
                            </Text>
                          </Box>
                        )}

                        <Button
                          onClick={handleGenerateAll}
                          disabled={selectedSections.size === 0 || isGeneratingSequentially}
                        >
                          {isGeneratingSequentially 
                            ? `Generating ${currentSectionIndex + 1}/${selectedSections.size}...` 
                            : 'Generate LookML'}
                        </Button>

                        {Object.entries(sectionOutputs).map(([section, state]) => (
                          <Card key={section} p="large">
                            <Heading as="h5" fontSize="medium" mb="small">
                              {section === 'explore' ? 'Explore' : `View: ${section}`}
                            </Heading>
                            {state.code && (
                              <Box mt="medium">
                                <CopyToClipboard text={state.code} onCopy={() => handleCopySection(section)}>
                                  <Button mb="small">Copy</Button>
                                </CopyToClipboard>
                                {state.copySuccess && <span style={{ color: 'green', marginLeft: 8 }}>Copied!</span>}
                                {state.isTruncated && (
                                  <Button mt="small" onClick={() => handleContinueSectionLookml(section)} disabled={state.isContinuing}>
                                    {state.isContinuing ? 'Continuing...' : 'Continue'}
                                  </Button>
                                )}
                                <pre style={{ background: '#f6f8fa', padding: '16px', borderRadius: '6px', marginTop: '8px', overflowX: 'auto', fontSize: '0.95em' }}>
                                  {state.code}
                                </pre>
                              </Box>
                            )}
                          </Card>
                        ))}
                      </SpaceVertical>
                    </Box>
                  )}
                </SpaceVertical>
              </Box>
            </Card>
          </Box>
        )}
      </SpaceVertical>
    </Box>
  )
} 