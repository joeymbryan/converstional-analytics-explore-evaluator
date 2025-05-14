import React, { useEffect, useState, useMemo } from 'react'
import { ExtensionContext } from '@looker/extension-sdk-react'
import { Box, Label, Select, SelectOptionGroupProps, SelectOptionObject, Space, SpaceVertical, Spinner } from '@looker/components'
import { ILookmlModel, ILookmlModelExplore } from '@looker/sdk'

interface ExploreSelectorProps {
  onExploreSelect: (explore: string) => void
}

export const ExploreSelector: React.FC<ExploreSelectorProps> = ({ onExploreSelect }) => {
  const [groupedOptions, setGroupedOptions] = useState<SelectOptionGroupProps[]>([])
  const [selectedExplore, setSelectedExplore] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const extensionContext = React.useContext(ExtensionContext)
  const sdk = extensionContext.core40SDK

  useEffect(() => {
    const fetchExplores = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const models = await sdk.ok(sdk.all_lookml_models({}))
        const groups: SelectOptionGroupProps[] = models
          .filter(model => model.explores && model.explores.length)
          .map(model => ({
            label: model.label || model.name || '',
            options: (model.explores || [])
              .filter(explore => explore.name && !explore.hidden)
              .map(explore => ({
                label: explore.label || explore.name || '',
                value: `${model.name}/${explore.name}`
              }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          }))
          .filter(group => group.options.length > 0)
          .sort((a, b) => String(a.label).localeCompare(String(b.label)))
        setGroupedOptions(groups)
      } catch (error) {
        setError('Failed to load explores. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchExplores()
  }, [sdk])

  // Filtered options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return groupedOptions
    const lower = search.toLowerCase()
    return groupedOptions
      .map(group => ({
        ...group,
        options: group.options.filter(option =>
          (option.label ? option.label.toLowerCase() : '').includes(lower) ||
          option.value.toLowerCase().includes(lower)
        )
      }))
      .filter(group => group.options.length > 0)
  }, [groupedOptions, search])

  const handleChange = (value: string | undefined) => {
    if (value) {
      setSelectedExplore(value)
      onExploreSelect(value)
    }
  }

  if (error) {
    return <Box color="critical">{error}</Box>
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
            options={filteredOptions}
            value={selectedExplore}
            onChange={handleChange}
            placeholder="Select a model/explore"
            width="100%"
            isFilterable
            onFilter={setSearch}
          />
          <Box fontSize="small" color="text2">
            Enter the name of the Looker Explore you want to analyze.
          </Box>
        </>
      )}
    </SpaceVertical>
  )
} 