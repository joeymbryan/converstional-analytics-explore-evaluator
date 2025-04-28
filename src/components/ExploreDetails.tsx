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
}

export const ExploreDetails: React.FC<ExploreDetailsProps> = ({
  exploreName,
  onFieldsChange,
  onDescriptionChange,
  onQuestionsChange,
  onGoalsChange,
}) => {
  const [description, setDescription] = useState('')
  const [lastUpdate, setLastUpdate] = useState('')
  const [weightedFields, setWeightedFields] = useState<WeightedField[]>([])
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [userDescription, setUserDescription] = useState('')
  const [commonQuestions, setCommonQuestions] = useState('')
  const [userGoals, setUserGoals] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const extensionContext = React.useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK

  useEffect(() => {
    let isMounted = true;
    const fetchExploreDetails = async () => {
      if (!exploreName) return

      setIsLoading(true)
      try {
        const [modelName, explorePath] = exploreName.split('/')
        const exploreData = await sdk.ok(
          sdk.lookml_model_explore(modelName, explorePath)
        )
        if (isMounted) {
          setDescription(exploreData.description || '')
          setLastUpdate(new Date().toISOString().split('T')[0]) // TODO: Get actual last update date
        }

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
        console.log('run_inline_query payload:', queryPayload);
        const weightedFieldsData = await sdk.ok(
          sdk.run_inline_query(queryPayload)
        )
        console.log('weightedFieldsData:', weightedFieldsData);

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
              console.error('Error processing record:', error)
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
      } catch (error) {
        if (isMounted) {
          console.error('Error fetching explore details:', error)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
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

  const handleUserDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserDescription(e.target.value)
    onDescriptionChange(e.target.value)
  }

  const handleCommonQuestionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommonQuestions(e.target.value)
    onQuestionsChange(e.target.value)
  }

  const handleUserGoalsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserGoals(e.target.value)
    onGoalsChange(e.target.value)
  }

  if (isLoading) {
    return <Box>Loading explore details...</Box>
  }

  return (
    <Box p="large" maxWidth="800px" mx="auto">
      <SpaceVertical gap="large">
        <Card>
          <Box p="large">
            <SpaceVertical gap="medium">
              <Heading as="h3" fontSize="small">Explore Details</Heading>
              <Box>
                <Label fontSize="small">Description</Label>
                <Text fontSize="small">{description || 'No description available'}</Text>
              </Box>
              <Box>
                <Label fontSize="small">Last LookML Update</Label>
                <Text fontSize="small">{lastUpdate}</Text>
              </Box>
            </SpaceVertical>
          </Box>
        </Card>

        <Card>
          <Box p="large">
            <SpaceVertical gap="medium">
              <Heading as="h3" fontSize="small">Fields</Heading>
              {weightedFields.length === 0 ? (
                <Text fontSize="small" color="text2">No field usage data found for this explore.</Text>
              ) : (
                <List>
                  {weightedFields.map(({ name, weight }) => (
                    <ListItem key={name}>
                      <FieldCheckbox
                        label={`${name} (weight: ${weight.toFixed(2)})`}
                        checked={selectedFields.has(name)}
                        onChange={() => handleFieldToggle(name)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </SpaceVertical>
          </Box>
        </Card>

        <Card>
          <Box p="large">
            <SpaceVertical gap="medium">
              <FieldTextArea
                label="User Description"
                value={userDescription}
                onChange={handleUserDescriptionChange}
                description="Provide a description of the users who will be using this explore."
              />
              <FieldTextArea
                label="Common Questions"
                value={commonQuestions}
                onChange={handleCommonQuestionsChange}
                description="List the common questions that users ask when using this explore."
              />
              <FieldTextArea
                label="User Goals"
                value={userGoals}
                onChange={handleUserGoalsChange}
                description="Describe the goals that users are trying to achieve when using this explore."
              />
            </SpaceVertical>
          </Box>
        </Card>
      </SpaceVertical>
    </Box>
  )
} 