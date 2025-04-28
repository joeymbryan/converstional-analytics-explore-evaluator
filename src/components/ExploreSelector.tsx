import React, { useEffect, useState } from 'react'
import { ExtensionContext } from '@looker/extension-sdk-react'
import { Box, FieldText, Heading, Label, Select, SelectProps, Space, SpaceVertical, Spinner } from '@looker/components'
import { ILookmlModel, ILookmlModelExplore } from '@looker/sdk'

interface ExploreOption {
  label: string
  value: string
}

interface ExploreSelectorProps {
  onExploreSelect: (explore: string) => void
}

export const ExploreSelector: React.FC<ExploreSelectorProps> = ({ onExploreSelect }) => {
  const [options, setOptions] = useState<ExploreOption[]>([])
  const [selectedExplore, setSelectedExplore] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const extensionContext = React.useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK

  useEffect(() => {
    const fetchExplores = async () => {
      try {
        console.log('Fetching explores...')
        setIsLoading(true)
        setError(null)
        
        const models = await sdk.ok(sdk.all_lookml_models({}))
        console.log('Fetched models:', models)
        
        const exploreOptions: ExploreOption[] = []
        
        for (const model of models) {
          if (model.name && model.explores) {
            console.log(`Processing model ${model.name} with ${model.explores.length} explores`)
            model.explores.forEach((explore: ILookmlModelExplore) => {
              if (explore.name) {
                exploreOptions.push({
                  label: `${model.name}/${explore.name}`,
                  value: `${model.name}/${explore.name}`
                })
              }
            })
          }
        }
        
        const sortedOptions = exploreOptions.sort((a, b) => a.label.localeCompare(b.label))
        console.log('Final explore options:', sortedOptions)
        setOptions(sortedOptions)
      } catch (error) {
        console.error('Error fetching explores:', error)
        setError('Failed to load explores. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchExplores()
  }, [sdk])

  const handleChange: SelectProps['onChange'] = (value) => {
    const newValue = value as string
    setSelectedExplore(newValue)
    onExploreSelect(newValue)
  }

  if (error) {
    return (
      <Box color="critical">
        {error}
      </Box>
    )
  }

  return (
    <SpaceVertical gap="small">
      <Label>Looker Explore Name</Label>
      {isLoading ? (
        <Space>
          <Spinner />
          <Box>Loading explores...</Box>
        </Space>
      ) : (
        <>
          <Select
            options={options}
            value={selectedExplore}
            onChange={handleChange}
            placeholder="Select a model/explore"
            width="100%"
          />
          <Box fontSize="small" color="text2">
            Enter the name of the Looker Explore you want to analyze.
          </Box>
        </>
      )}
    </SpaceVertical>
  )
} 