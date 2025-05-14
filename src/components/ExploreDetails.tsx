import React, { useEffect, useState } from 'react'
import { ExtensionContext } from '@looker/extension-sdk-react'
import {
  Box,
  Card,
  Heading,
  SpaceVertical,
  Text,
  FieldCheckbox,
  FieldTextArea,
  Label,
  List,
  ListItem,
} from '@looker/components'

interface WeightedField {
  name: string
  weight: number
}

interface QueryRecord {
  'query.fields': string
  'history.query_run_count': string
}

interface ExploreDetailsProps {
  exploreName: string
  onFieldsChange: (fields: string[]) => void
  onDescriptionChange: (description: string) => void
  onQuestionsChange: (questions: string) => void
  onGoalsChange: (goals: string) => void
  userDescription: string
  onUserDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  commonQuestions: string
  onCommonQuestionsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  userGoals: string
  onUserGoalsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  // Optionally pass description and lastUpdate if needed in the future
  // description?: string
  // lastUpdate?: string
}

export const ExploreDetails: React.FC<ExploreDetailsProps> = ({
  exploreName,
  onFieldsChange,
  onDescriptionChange,
  onQuestionsChange,
  onGoalsChange,
  userDescription,
  onUserDescriptionChange,
  commonQuestions,
  onCommonQuestionsChange,
  userGoals,
  onUserGoalsChange,
}) => {
  const [description, setDescription] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')
  const [weightedFields, setWeightedFields] = useState<WeightedField[]>([])
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const extensionContext = React.useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK

  useEffect(() => {
    let isMounted = true;
    console.log('[ExploreDetails] useEffect triggered. exploreName:', exploreName);
    const fetchExploreDetails = async () => {
      if (!exploreName) {
        console.log('[ExploreDetails] No exploreName provided, aborting fetch.');
        return
      }

      setIsLoading(true)
      setLoadError(null)
      console.log('[ExploreDetails] Loading fields for:', exploreName)
      try {
        const [modelName, explorePath] = exploreName.split('/')
        console.log('[ExploreDetails] modelName:', modelName, 'explorePath:', explorePath)
        const exploreData = await sdk.ok(
          sdk.lookml_model_explore(modelName, explorePath)
        )
        if (isMounted) {
          setDescription(exploreData.description || '')
          setLastUpdate(new Date().toISOString().split('T')[0]) // TODO: Get actual last update date
        }
        console.log('[ExploreDetails] Explore data loaded:', exploreData)

        // Fetch field weights
        const queryPayload = {
          result_format: 'json',
          body: {
            model: 'system__activity',
            view: 'history',
            fields: [
              'query.view',
              'history.query_run_count',
              'user.count',
              'query.model',
              'query.formatted_fields',
              'history.source'
            ],
            filters: {
              'query.model': modelName,   // selected model
              'query.view': explorePath,  // selected explore
              // Optionally add date filter, e.g. 'history.created_date': '90 days'
            },
            limit: '1000',
          },
        };
        console.log('[ExploreDetails] run_inline_query payload:', queryPayload);
        const weightedFieldsData = await sdk.ok(
          sdk.run_inline_query(queryPayload)
        )
        console.log('[ExploreDetails] weightedFieldsData:', weightedFieldsData);

        // Process weighted fields
        const fieldWeights = new Map<string, number>()
        if (Array.isArray(weightedFieldsData)) {
          weightedFieldsData.forEach((record: any) => {
            try {
              // Try both formatted_fields and fields for compatibility
              const parsedFields = record['query.formatted_fields']
                ? JSON.parse(record['query.formatted_fields'])
                : (record['query.fields'] ? JSON.parse(record['query.fields']) : []);
              const queryCount = parseInt(record['history.query_run_count'] || '0', 10)
              if (Array.isArray(parsedFields)) {
                parsedFields.forEach((field: string) => {
                  fieldWeights.set(field, (fieldWeights.get(field) || 0) + queryCount)
                })
              }
            } catch (error) {
              console.error('[ExploreDetails] Error processing record:', error)
            }
          })
        }

        const sortedFields = Array.from(fieldWeights.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([name, weight]) => ({ name, weight }))

        if (isMounted) {
          setWeightedFields(sortedFields)
          setSelectedFields(new Set(sortedFields.map(f => f.name)))
          onFieldsChange(sortedFields.map(f => f.name))
        }
        console.log('[ExploreDetails] Weighted fields set:', sortedFields)
      } catch (error: any) {
        if (isMounted) {
          console.error('[ExploreDetails] Error fetching explore details:', error)
          if (error && error.message && error.message.includes('Not found')) {
            setLoadError('This explore does not exist in Looker. Please check your LookML project or select a different explore.')
          } else {
            setLoadError('Failed to load explore details. Please try again.')
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
          console.log('[ExploreDetails] Field loading complete for:', exploreName)
        }
      }
    }

    fetchExploreDetails()
    return () => { isMounted = false }
  }, [exploreName, sdk])

  const handleFieldToggle = (fieldName: string) => {
    const newSelectedFields = new Set(selectedFields)
    if (newSelectedFields.has(fieldName)) {
      newSelectedFields.delete(fieldName)
    } else {
      newSelectedFields.add(fieldName)
    }
    setSelectedFields(newSelectedFields)
    onFieldsChange(Array.from(newSelectedFields))
  }

  if (isLoading) {
    return <Box>Loading fields...</Box>
  }
  if (loadError) {
    return <Box color="critical">{loadError}</Box>
  }

  return (
    <Box>
      <SpaceVertical gap="medium">
        <Card>
          <Label>User Description</Label>
          <FieldTextArea
            value={userDescription}
            onChange={onUserDescriptionChange}
            placeholder="Describe the user or audience for this explore"
          />
        </Card>
        <Card>
          <Label>Common Questions</Label>
          <FieldTextArea
            value={commonQuestions}
            onChange={onCommonQuestionsChange}
            placeholder="What are common questions users ask of this explore?"
          />
        </Card>
        <Card>
          <Label>User Goals</Label>
          <FieldTextArea
            value={userGoals}
            onChange={onUserGoalsChange}
            placeholder="What are the main goals users have when using this explore?"
          />
        </Card>
        {weightedFields.length === 0 ? (
          <Text fontSize="small" color="text2">No field usage data found for this explore.</Text>
        ) : (
          <List>
            {weightedFields.map(({ name, weight }) => (
              <ListItem key={name}>
                <Box>
                  <FieldCheckbox
                    label={name}
                    checked={selectedFields.has(name)}
                    onChange={() => handleFieldToggle(name)}
                  />
                  <Text fontSize="xsmall" color="text2" pl="large">
                    weighted score: {weight.toFixed(2)}
                  </Text>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </SpaceVertical>
    </Box>
  )
} 